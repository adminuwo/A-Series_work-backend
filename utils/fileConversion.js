import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const officeParser = require('officeparser');
import PptxGenJS from 'pptxgenjs';
import Tesseract from 'tesseract.js';

/**
 * File Conversion Service for AISA
 * Handles Universal Document Conversions
 */

/**
 * Detect file type from buffer and extension
 */
function detectFileType(buffer, fileName = '') {
    const ext = fileName.split('.').pop().toLowerCase();

    if (buffer.toString('utf8', 0, 4) === '%PDF' || ext === 'pdf') {
        return 'pdf';
    }

    if ((buffer[0] === 0x50 && buffer[1] === 0x4B) || ext === 'docx' || ext === 'doc' || ext === 'pptx' || ext === 'xlsx') {
        if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
        if (ext === 'pptx' || ext === 'ppt') return 'pptx';
        return 'docx';
    }

    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        return 'image';
    }

    return 'unknown';
}

/**
 * Validate if conversion is supported
 */
function validateConversionRequest(sourceType, targetType) {
    const validTargetTypes = ['pdf', 'docx', 'pptx', 'xlsx'];
    const validSourceTypes = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'csv'];

    const source = sourceType.toLowerCase();
    const target = targetType.toLowerCase();

    // Universal support if source and target are in our supported lists
    return validSourceTypes.includes(source) && validTargetTypes.includes(target);
}

// --- TEXT EXTRACTION HELPERS ---

async function extractTextFromPdf(buffer) {
    const data = await pdfParse(buffer);
    return data.text;
}

async function extractTextFromDocx(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

async function extractTextFromPptx(buffer) {
    return new Promise((resolve, reject) => {
        officeParser.parseOffice(buffer, (data, err) => {
            if (err) return reject(err);
            resolve(data);
        });
    });
}

async function extractTextFromXlsx(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';
    workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        text += XLSX.utils.sheet_to_csv(sheet) + '\n';
    });
    return text;
}

async function extractTextFromImage(buffer) {
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    return text;
}

// --- FILE GENERATION HELPERS ---

async function createPdfFromText(text) {
    if (!text) return null;
    const cleanText = text.replace(/[^\x00-\x7F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]/g, '?');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    const fontSize = 11;
    const lineHeight = fontSize * 1.4;
    const maxWidth = pageWidth - (margin * 2);

    const paragraphs = cleanText.split('\n');
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    for (const para of paragraphs) {
        const cleanPara = para.trim();
        if (cleanPara.length === 0) {
            yPosition -= lineHeight * 0.5;
            if (yPosition < margin) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = pageHeight - margin;
            }
            continue;
        }

        const words = cleanPara.split(/\s+/);
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
                if (yPosition < margin) {
                    page = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPosition = pageHeight - margin;
                }
                page.drawText(currentLine, { x: margin, y: yPosition, size: fontSize, font });
                currentLine = word;
                yPosition -= lineHeight;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            if (yPosition < margin) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = pageHeight - margin;
            }
            page.drawText(currentLine, { x: margin, y: yPosition, size: fontSize, font });
            yPosition -= lineHeight;
        }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

async function createDocxFromText(text) {
    const paragraphs = text.split('\n').filter(line => line.trim().length > 0);
    const doc = new Document({
        sections: [{
            children: paragraphs.map(para => new Paragraph({ children: [new TextRun(para)] }))
        }]
    });
    return await Packer.toBuffer(doc);
}

async function createXlsxFromText(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const wb = XLSX.utils.book_new();
    const wsData = lines.map(line => [line]);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function createPptxFromText(text) {
    const paragraphs = text.split('\n').filter(line => line.trim().length > 0);
    const pres = new PptxGenJS();
    let slide = pres.addSlide();
    let yPos = 0.5;

    paragraphs.forEach(para => {
        if (yPos > 5.0) {
            slide = pres.addSlide();
            yPos = 0.5;
        }
        slide.addText(para, { x: 0.5, y: yPos, w: '90%', fontSize: 12, color: '363636' });
        yPos += 0.6;
    });

    return await pres.write({ outputType: 'nodebuffer' });
}

// --- MAIN ENGINE ---

export async function convertFile(fileBuffer, sourceFormat, targetFormat) {
    const source = sourceFormat.toLowerCase();
    const target = targetFormat.toLowerCase();

    if (!validateConversionRequest(source, target)) {
        throw new Error(`Conversion from ${source} to ${target} is not supported`);
    }

    try {
        let extractedText = '';

        // 1. Extract Text Phase
        if (source === 'pdf') {
            extractedText = await extractTextFromPdf(fileBuffer);
        } else if (source === 'docx' || source === 'doc') {
            extractedText = await extractTextFromDocx(fileBuffer);
        } else if (source === 'pptx' || source === 'ppt') {
            extractedText = await extractTextFromPptx(fileBuffer);
        } else if (source === 'xlsx' || source === 'xls' || source === 'csv') {
            extractedText = await extractTextFromXlsx(fileBuffer);
        } else if (['jpg', 'jpeg', 'png', 'webp'].includes(source)) {
            extractedText = await extractTextFromImage(fileBuffer);
        } else if (source === 'txt') {
            extractedText = fileBuffer.toString('utf8');
        }

        // 2. Generation Phase
        if (target === 'pdf') {
            // Special case for Images -> PDF: High fidelity embed
            if (['jpg', 'jpeg', 'png', 'webp'].includes(source)) {
                return await convertImageToPdf(fileBuffer, source);
            }
            return await createPdfFromText(extractedText);
        } else if (target === 'docx') {
            return await createDocxFromText(extractedText);
        } else if (target === 'xlsx') {
            return await createXlsxFromText(extractedText);
        } else if (target === 'pptx') {
            return await createPptxFromText(extractedText);
        }

        throw new Error('Unsupported target format');
    } catch (err) {
        console.error('Universal Conversion Error:', err);
        throw new Error(`Conversion failed: ${err.message}`);
    }
}

// High fidelity image to pdf embed
async function convertImageToPdf(imageBuffer, format) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    let image;
    if (format.toLowerCase() === 'png') image = await pdfDoc.embedPng(imageBuffer);
    else image = await pdfDoc.embedJpg(imageBuffer);
    const dims = image.scaleToFit(width - 40, height - 40);
    page.drawImage(image, { x: width / 2 - dims.width / 2, y: height / 2 - dims.height / 2, width: dims.width, height: dims.height });
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

export { detectFileType, validateConversionRequest };

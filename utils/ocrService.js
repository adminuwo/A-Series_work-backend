import Tesseract from 'tesseract.js';
import logger from './logger.js';

/**
 * OCR Service to handle image text extraction reliably
 * Uses manual worker management to better catch asynchronous crashes
 */
export const performOCR = async (imageBuffer, language = 'eng') => {
    if (!imageBuffer || imageBuffer.length === 0) {
        logger.error('[OCR] Received empty buffer');
        return '';
    }

    // Safety: Check if this is actually a PDF (Tesseract/Leptonica will crash on PDF data)
    const isPDF = imageBuffer.slice(0, 4).toString() === '%PDF';
    if (isPDF) {
        logger.warn('[OCR] Attempted to run OCR on a PDF file. Redirecting to PDF parser is recommended.');
        return '';
    }

    let worker = null;
    try {
        logger.info(`[OCR] Initializing worker (Lang: ${language})...`);

        // Manual worker creation gives us more control over the lifecycle and error events
        worker = await Tesseract.createWorker(language);

        logger.info(`[OCR] Starting recognition...`);
        // Convert Buffer to Uint8Array for maximum compatibility
        const uint8Array = new Uint8Array(imageBuffer);

        const { data: { text } } = await worker.recognize(uint8Array);

        await worker.terminate();
        logger.info(`[OCR] Success: Extracted ${text.length} characters.`);
        return text || '';
    } catch (error) {
        logger.error(`[OCR] Extraction Error: ${error.message}`);

        // Ensure worker is terminated even on error to prevent memory leaks
        if (worker) {
            try {
                await worker.terminate();
            } catch (termErr) {
                // Ignore termination errors if worker already died
            }
        }

        return ''; // Return empty string instead of crashing
    }
};

export default { performOCR };

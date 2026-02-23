import { convertFile } from '../utils/fileConversion.js';
import vertexService from '../services/vertex.service.js';
import logger from '../utils/logger.js';

/**
 * Handle File Conversion requests.
 */
export const convert = async (req, res, next) => {
    try {
        const { source_format, target_format, base64Data, fileName } = req.body;

        if (!base64Data || !target_format) {
            return res.status(400).json({ success: false, message: 'Base64 data and target format are required' });
        }

        logger.info(`[CONVERSION TOOL] ${source_format || 'auto'} -> ${target_format}`);

        const fileBuffer = Buffer.from(base64Data, 'base64');
        const convertedBuffer = await convertFile(fileBuffer, source_format, target_format);

        if (!convertedBuffer) {
            throw new Error("File conversion failed");
        }

        const convertedBase64 = convertedBuffer.toString('base64');

        // Use Vertex AI to give a "completion" message
        const aiMessage = await vertexService.askVertex(
            `Confirm that the file ${fileName || 'document'} has been converted to ${target_format}.`,
            null,
            { systemInstruction: "You are a professional file conversion assistant. Provide a very brief, helpful confirmation message." }
        );

        res.status(200).json({
            success: true,
            reply: aiMessage,
            file: convertedBase64,
            fileName: `${(fileName || 'document').split('.')[0]}_converted.${target_format}`,
            mimeType: `application/${target_format === 'pdf' ? 'pdf' : 'octet-stream'}`
        });

    } catch (error) {
        logger.error(`[CONVERSION TOOL ERROR] ${error.message}`);
        next(error);
    }
};

import vertexService from '../services/vertex.service.js';
import logger from '../utils/logger.js';

/**
 * Handle Reminder requests using Vertex AI.
 */
export const setReminder = async (req, res, next) => {
    try {
        const { title, datetime, isAlarm, language } = req.body;

        if (!title || !datetime) {
            return res.status(400).json({ success: false, message: 'Title and datetime are required' });
        }

        logger.info(`[REMINDER TOOL] Setting: "${title}" at ${datetime}`);

        // Logic for setting reminder would go here (saving to DB, etc.)
        // But for "Vertex API reply", we focus on the AI response.

        const timeStr = new Date(datetime).toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        const aiResponse = await vertexService.askVertex(
            `I have set a ${isAlarm ? 'alarm' : 'reminder'} for "${title}" at ${timeStr} on ${new Date(datetime).toLocaleDateString()}.`,
            null,
            { systemInstruction: "You are a helpful personal assistant. Confirm the reminder in a friendly way." }
        );

        res.status(200).json({
            success: true,
            reply: aiResponse,
            reminder: { title, datetime, isAlarm }
        });

    } catch (error) {
        logger.error(`[REMINDER TOOL ERROR] ${error.message}`);
        next(error);
    }
};

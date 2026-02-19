import axios from 'axios';
import logger from '../utils/logger.js';
import { GoogleAuth } from 'google-auth-library';
import { uploadToCloudinary } from '../services/cloudinary.service.js';

/**
 * Generate music using Google's Lyria model on Vertex AI
 * @param {string} prompt - The music generation prompt
 * @param {number} duration - Desired duration in seconds (default 30)
 * @returns {Promise<string|null>} - Cloudinary URL of the generated audio or null
 */
export const generateMusicFromPrompt = async (prompt, duration = 30) => {
    try {
        logger.info(`[LYRIA] Generating music for prompt: ${prompt.substring(0, 50)}...`);

        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
            projectId: process.env.GCP_PROJECT_ID || process.env.PROJECT_ID
        });
        const client = await auth.getClient();
        const projectId = await auth.getProjectId();
        const accessTokenResponse = await client.getAccessToken();
        const token = accessTokenResponse.token || accessTokenResponse;

        // Lyria model ID and location
        const modelId = 'lyria-002'; // Latest Lyria model
        const location = 'us-central1'; // Lyria is primarily available in us-central1
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

        // Truncate prompt if it's too long to avoid 400 errors
        const safePrompt = prompt.length > 500 ? prompt.substring(0, 500) : prompt;

        const payload = {
            instances: [
                {
                    prompt: safePrompt
                }
            ],
            parameters: {
                sample_count: 1,
                audio_length_seconds: duration || 30
            }
        };

        const response = await axios.post(
            endpoint,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000 // Music generation can take up to 2 minutes
            }
        );

        if (response.data && response.data.predictions && response.data.predictions[0]) {
            const prediction = response.data.predictions[0];

            // Lyria typically returns base64 encoded audio
            const base64Data = prediction.bytesBase64Encoded || prediction.audio?.bytesBase64Encoded || (typeof prediction === 'string' ? prediction : null);

            if (base64Data) {
                const buffer = Buffer.from(base64Data, 'base64');

                // Upload to Cloudinary
                const uploadResult = await uploadToCloudinary(buffer, {
                    resource_type: 'video', // Cloudinary handles audio as resource_type 'video'
                    folder: 'aisa_generated_music',
                    format: 'mp3'
                });

                logger.info(`[LYRIA] Music generated and uploaded successfully: ${uploadResult.secure_url}`);
                return uploadResult.secure_url;
            } else {
                logger.warn("[LYRIA] No audio data found in prediction response.");
            }
        }

        throw new Error('Lyria did not return a valid audio payload.');

    } catch (error) {
        logger.error(`[LYRIA ERROR] ${error.message}`);
        if (error.response) {
            const errorData = JSON.stringify(error.response.data);
            logger.error(`[LYRIA API ERROR] Status: ${error.response.status}, Data: ${errorData}`);

            // Specific handling for common errors
            if (error.response.status === 400) {
                throw new Error(`Invalid request to music generator. This usually happens if the prompt is too long or contains invalid characters. Details: ${errorData}`);
            }
            if (error.response.status === 404) {
                throw new Error('Lyria model not found in this region. Music generation is currently in limited preview.');
            }
            if (error.response.status === 403) {
                throw new Error('Access to Lyria model is restricted. Please check your Google Cloud permissions.');
            }
        }
        throw error;
    }
};

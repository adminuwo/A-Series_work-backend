import { uploadToCloudinary } from '../services/cloudinary.service.js';
import axios from 'axios';
import logger from '../utils/logger.js';
import { GoogleAuth } from 'google-auth-library';

// Helper function to generate image using Vertex AI Imagen (NOT Gemini API)
export const generateImageFromPrompt = async (prompt) => {
    try {
        console.log(`[VERTEX IMAGE] Triggered for: "${prompt}"`);

        // Verify we have GCP Project ID for Vertex AI
        if (!process.env.GCP_PROJECT_ID) {
            throw new Error("GCP_PROJECT_ID is required for Vertex AI. Please set it in your .env file.");
        }

        console.log(`[VERTEX IMAGE] Authenticating with Vertex AI...`);
        console.log(`[VERTEX IMAGE] Project ID: ${process.env.GCP_PROJECT_ID}`);
        console.log(`[VERTEX IMAGE] Using Application Default Credentials (ADC)`);

        // Use GoogleAuth for Vertex AI (this uses ADC or service account JSON)
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            projectId: process.env.GCP_PROJECT_ID
        });

        const client = await auth.getClient();
        const projectId = process.env.GCP_PROJECT_ID;

        console.log(`[VERTEX IMAGE] Getting access token...`);
        const accessTokenResponse = await client.getAccessToken();
        const token = accessTokenResponse.token || accessTokenResponse;

        if (!token) {
            throw new Error("Failed to obtain access token from Google Auth. Please check your credentials.");
        }

        console.log(`[VERTEX IMAGE] Token obtained successfully`);

        // Both chat and images now use us-central1 for consistency and model availability
        const location = 'us-central1';
        // Use Imagen 3.0 Generate 002 (Latest stable)
        const modelId = 'imagen-3.0-generate-002';
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

        console.log(`[VERTEX IMAGE] Calling endpoint: ${endpoint.substring(0, 60)}...`);

        const response = await axios.post(
            endpoint,
            {
                instances: [{ prompt: prompt }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "1:1",
                    safetyFilterLevel: "block_none",
                    personGeneration: "allow_all"
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        if (response.data && response.data.predictions && response.data.predictions[0]) {
            const prediction = response.data.predictions[0];
            const base64Data = prediction.bytesBase64Encoded || (typeof prediction === 'string' ? prediction : null);

            if (base64Data) {
                console.log(`[VERTEX IMAGE] Image received successfully. Size: ${base64Data.length}`);
                const buffer = Buffer.from(base64Data, 'base64');
                const cloudResult = await uploadToCloudinary(buffer, {
                    folder: 'generated_images',
                    public_id: `gen_${Date.now()}`
                });
                return cloudResult.secure_url;
            }
        }

        throw new Error('Vertex AI response format unexpected or empty.');

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message || "Unknown error";
        console.error(`[VERTEX IMAGE ERROR] ${errorMsg}`);
        console.error(`[VERTEX IMAGE ERROR] Full error:`, error.response?.data || error);

        // Return detailed error instead of falling back to Pollinations
        throw new Error(`Vertex AI Image Generation failed: ${errorMsg}`);
    }
};

// Helper function to modify image using Vertex AI (Image to Image / Inpainting)
export const modifyImageFromPrompt = async (prompt, base64Image) => {
    try {
        console.log(`[VERTEX IMAGE EDIT] Triggered for: "${prompt.substring(0, 50)}..."`);

        if (!process.env.GCP_PROJECT_ID) {
            throw new Error("GCP_PROJECT_ID is required for Vertex AI.");
        }

        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            projectId: process.env.GCP_PROJECT_ID
        });

        const client = await auth.getClient();
        const projectId = process.env.GCP_PROJECT_ID;
        const accessTokenResponse = await client.getAccessToken();
        const token = accessTokenResponse.token || accessTokenResponse;

        if (!token) throw new Error("Failed to obtain access token.");

        // For image editing, us-central1 is the standard location
        const location = 'us-central1';
        // Use Imagen 3.0 Capability model for editing to resolve EOL issues with imagegeneration@006
        // Use imagen-3.0-capability-001 - The modern editing model for us-central1
        const modelId = 'imagen-3.0-capability-001';
        // Use v1beta1 for the most inclusive support of Imagen 3 features
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

        console.log(`[VERTEX IMAGE EDIT] Calling ${modelId} endpoint for task...`);

        // Clean base64 image (strip data:image/...;base64, prefix if present)
        const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;

        // Detect if the user wants background removal or general removal
        const lowerPrompt = prompt.toLowerCase();
        const isBackgroundRemoval = lowerPrompt.includes('remove background') ||
            lowerPrompt.includes('bg removal') ||
            lowerPrompt.includes('background remove');

        const isGenericRemoval = lowerPrompt.includes('remove') || lowerPrompt.includes('erase') || lowerPrompt.includes('delete') || lowerPrompt.includes('hata') || lowerPrompt.includes('nikal');

        const payload = {
            instances: [
                {
                    prompt: isBackgroundRemoval
                        ? "remove background and make it transparent"
                        : (isGenericRemoval ? `${prompt}. Ensure the removed areas are seamlessly filled with matching background textures.` : prompt),
                    referenceImages: []
                }
            ],
            parameters: {
                sampleCount: 1,
                includeTransparentBackground: true,
                addWatermark: false,
                safetyFilterLevel: "block_none",
                guidanceScale: 75, // High guidance for strict adherence
                negativePrompt: isGenericRemoval ? "text, characters, letters, words, watermark, blurry, distorted" : "blurry, distorted, low quality"
            }
        };

        // Add the primary RAW image (Required for all edits)
        payload.instances[0].referenceImages.push({
            referenceId: 0,
            referenceType: "REFERENCE_TYPE_RAW",
            referenceImage: {
                bytesBase64Encoded: cleanBase64,
                mimeType: "image/png"
            }
        });

        // Specialized logic for background removal
        if (isBackgroundRemoval) {
            payload.parameters.editMode = "EDIT_MODE_BGSWAP";
            payload.instances[0].referenceImages.push({
                referenceId: 1,
                referenceType: "REFERENCE_TYPE_MASK",
                maskImageConfig: {
                    maskMode: "MASK_MODE_BACKGROUND"
                }
            });
            console.log(`[VERTEX IMAGE EDIT] Strategy: MASK_BASED_BG_REMOVAL`);
        } else {
            // For all other edits (including "remove text"), we use MASK-FREE mode
            // This allows Imagen 3 to intelligently apply the prompt everywhere to the image.
            console.log(`[VERTEX IMAGE EDIT] Strategy: MASK_FREE_GENERAL_EDIT`);
        }

        const response = await axios.post(
            endpoint,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // Image editing can take longer
            }
        );

        if (response.data && response.data.predictions && response.data.predictions[0]) {
            const prediction = response.data.predictions[0];
            const resultBase64 = prediction.bytesBase64Encoded || (typeof prediction === 'string' ? prediction : null);

            if (resultBase64) {
                console.log(`[VERTEX IMAGE EDIT] Modifed image received successfully.`);
                const buffer = Buffer.from(resultBase64, 'base64');
                const cloudResult = await uploadToCloudinary(buffer, {
                    folder: 'edited_images',
                    public_id: `edit_${Date.now()}`
                });
                return cloudResult.secure_url;
            }
        }

        throw new Error('Vertex AI Edit response format unexpected or empty.');

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message || "Unknown error";
        console.error(`[VERTEX IMAGE EDIT ERROR] ${errorMsg}`);
        throw new Error(`Vertex AI Image Editing failed: ${errorMsg}`);
    }
};

// @desc    Generate Image
// @route   POST /api/image/generate
// @access  Public
export const generateImage = async (req, res, next) => {
    try {
        const { prompt } = req.body || {};

        if (!prompt) {
            return res.status(400).json({ success: false, message: 'Prompt is required' });
        }

        if (logger && logger.info) logger.info(`[Image Generation] Processing: "${prompt}"`);
        else console.log(`[Image Generation] Processing: "${prompt}"`);

        const imageUrl = await generateImageFromPrompt(prompt);

        if (!imageUrl) {
            throw new Error("Failed to retrieve image URL from any source.");
        }

        // Use Vertex AI to narrate the result
        const aiResponse = await vertexService.askVertex(
            `I have generated an image for your prompt: "${prompt}".`,
            null,
            { systemInstruction: "You are a creative digital artist assistant. Briefly describe the generated image based on the prompt." }
        );

        res.status(200).json({
            success: true,
            reply: aiResponse,
            data: imageUrl
        });
    } catch (error) {
        if (logger && logger.error) logger.error(`[Image Generation] Critical Error: ${error.message}`);
        else console.error(`[Image Generation] Critical Error`, error);

        res.status(500).json({
            success: false,
            message: `Image generation failed: ${error.message}`
        });
    }
};

import vertexService from '../services/vertex.service.js';


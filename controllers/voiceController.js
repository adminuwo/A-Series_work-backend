import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the service account key file
const keyFilename = path.join(__dirname, '../Google_Cloud_API/a-series.json');

// Initialize the client
const client = new textToSpeech.TextToSpeechClient({ keyFilename });

export const synthesizeSpeech = async (req, res) => {
    try {
        const { text, languageCode = 'en-US', gender = 'FEMALE' } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Preferred voices map structure: [Language][Gender]
        const voiceMap = {
            'hi-IN': {
                'FEMALE': 'hi-IN-Neural2-A',
                'MALE': 'hi-IN-Neural2-B'
            },
            'en-US': {
                'FEMALE': 'en-US-Neural2-F', // Premium Female
                'MALE': 'en-US-Neural2-D'    // Premium Male
            },
            'en-IN': {
                'FEMALE': 'en-IN-Neural2-A',
                'MALE': 'en-IN-Neural2-B'
            }
        };

        // Fallback logic
        let voiceName = `${languageCode}-Neural2-A`; // Default fallback
        if (voiceMap[languageCode] && voiceMap[languageCode][gender]) {
            voiceName = voiceMap[languageCode][gender];
        } else {
            // Try to construct a likely name if not in map (e.g. B is often male, A female)
            const suffix = gender === 'MALE' ? 'B' : 'A';
            voiceName = `${languageCode}-Neural2-${suffix}`;
        }

        const request = {
            input: { text: text },
            voice: {
                languageCode: languageCode,
                name: voiceName,
            },
            // Select the type of audio encoding
            audioConfig: { audioEncoding: 'MP3' },
        };

        // Fallback logic for languages that might not have Neural2-A or exact match
        // For production, a more robust voice selection logic might be needed
        // But let's try to default to Neural2 if available.

        // Perform the text-to-speech request
        const [response] = await client.synthesizeSpeech(request);

        // Return the audio content
        // response.audioContent is a Buffer

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': response.audioContent.length,
        });

        res.send(response.audioContent);

    } catch (error) {
        console.error('ERROR:', error);
        res.status(500).json({ error: 'Failed to synthesize speech', details: error.message });
    }
};

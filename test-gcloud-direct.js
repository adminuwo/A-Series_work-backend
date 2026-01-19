import textToSpeech from '@google-cloud/text-to-speech';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyFilename = path.join(__dirname, 'Google_Cloud_API/a-series.json');
console.log("Using key file:", keyFilename);

const client = new textToSpeech.TextToSpeechClient({ keyFilename });

async function test() {
    const request = {
        input: { text: "Hello, testing API." },
        voice: { languageCode: 'en-US', name: 'en-US-Neural2-A' },
        audioConfig: { audioEncoding: 'MP3' },
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        console.log("Success! Audio content length:", response.audioContent.length);
    } catch (error) {
        console.log("Error Code:", error.code);
        console.log("Error Message:", error.message);
    }
}

test();

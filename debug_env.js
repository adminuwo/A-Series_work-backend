
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

console.log('Current directory:', process.cwd());
console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
if (process.env.GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY prefix:', process.env.GEMINI_API_KEY.substring(0, 5) + '...');
    console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY.length);
} else {
    console.log('GEMINI_API_KEY is undefined');
}

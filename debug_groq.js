import dotenv from 'dotenv';
dotenv.config();
import groqService from './services/groq.service.js';

async function testGroq() {
    try {
        console.log("Testing Groq Service...");
        console.log("API Key present:", !!process.env.GROQ_API_KEY);
        if (process.env.GROQ_API_KEY) {
            console.log("API Key length:", process.env.GROQ_API_KEY.length);
        }

        const response = await groqService.askGroq("Hello, are you working?");
        console.log("Response:", response);
    } catch (error) {
        console.error("Test Failed:", error);
        if (error.response) {
            console.error("Response Data:", error.response.data);
        }
    }
}

testGroq();

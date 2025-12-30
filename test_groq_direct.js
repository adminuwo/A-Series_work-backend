import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

async function testGroqDirect() {
    const apiKey = process.env.GROQ_API_KEY;

    console.log("=== GROQ API TEST ===");
    console.log("API Key exists:", !!apiKey);
    console.log("API Key length:", apiKey ? apiKey.length : 0);

    if (!apiKey) {
        console.error("GROQ_API_KEY not found!");
        return;
    }

    try {
        console.log("Sending test request to Groq...");
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Say hello!" }
            ],
            temperature: 0.3,
            max_tokens: 100
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log("SUCCESS! Response:");
        console.log(response.data.choices[0].message.content);

    } catch (error) {
        console.error("==== ERROR ====");
        console.error("Message:", error.message);
        console.error("Code:", error.code);

        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

testGroqDirect();

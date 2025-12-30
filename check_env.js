import dotenv from 'dotenv';
dotenv.config();
console.log("GROQ_API_KEY EXISTS:", !!process.env.GROQ_API_KEY);
if (process.env.GROQ_API_KEY) console.log("LENGTH:", process.env.GROQ_API_KEY.length);

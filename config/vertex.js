import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// FORCE VERTEX AI ONLY
const projectId = process.env.GCP_PROJECT_ID || 'ai-mall-484810';
const location = 'us-central1'; // Better model availability (Gemini 2.0)
const keyFilePath = path.join(__dirname, '../../google_cloud_credentials.json');

let vertexAI;

// Model name - Stable version
export const modelName = "gemini-2.5-flash";

// Robustly set GOOGLE_APPLICATION_CREDENTIALS for local development
if (fs.existsSync(keyFilePath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilePath;
  console.log(`🔑 [Vertex] Found key file, setting GOOGLE_APPLICATION_CREDENTIALS`);
}

try {
  // Initialize Vertex AI
  // If GOOGLE_APPLICATION_CREDENTIALS is set, it will be used automatically.
  // We can also pass it explicitly to be sure.
  const vertexOptions = { project: projectId, location: location };
  if (fs.existsSync(keyFilePath)) {
    vertexOptions.keyFilename = keyFilePath;
  }

  vertexAI = new VertexAI(vertexOptions);
  console.log(`✅ Vertex AI initialized successfully (${fs.existsSync(keyFilePath) ? 'Key File' : 'ADC'})`);
  console.log(`🤖 Default Model: ${modelName}`);
  console.log(`📍 Region: ${location}`);
  console.log(`🆔 Project: ${projectId}`);
} catch (e) {
  console.error('❌ Vertex AI initialization failed:', e.message);
  // Don't throw here to allow backend to start even if AI is down (failsafe)
  vertexAI = { preview: { getGenerativeModel: () => ({ generateContent: () => { throw new Error("Vertex AI not initialized"); } }) } };
}

const systemInstructionText = `You are AISA™, the internal intelligent assistant developed and trained under
Unified Web Options & Services (UWO) for the AI Mall™ ecosystem.
Development and implementation are led by Sanskar Sahu.

- MANDATORY REPLY: Always respond directly to the user's intent. Do not provide meta-commentary unless necessary.

Do NOT introduce yourself unless explicitly asked.
Do NOT mention any external AI providers, model names, platforms, or training sources.
Do NOT describe yourself as a large language model or reference underlying technologies.

Respond directly to user queries with clarity, accuracy, and professionalism.

Communication rules:
- Keep responses concise, structured, and helpful
- Use simple, human-readable language
- Avoid meta explanations about how you work
- Ask clarifying questions only when necessary

Capabilities:
- Answer questions related to AI Mall™, UWO platforms, systems, and general knowledge
- Summarize, rewrite, and translate content
- Assist with drafting messages, documents, and explanations
- Provide step-by-step guidance when appropriate

Boundaries:
- Do not claim emotions, consciousness, or personal experiences
- Do not provide harmful, illegal, or unsafe information
- If information is uncertain, state limitations without technical or training disclosures

Primary objective:
Support UWO and AI Mall™ users by delivering reliable, practical, and brand-aligned assistance.`;

// Create generative model using VERTEX AI ONLY
export const generativeModel = vertexAI.preview.getGenerativeModel({
  model: modelName,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ],
  generationConfig: { maxOutputTokens: 4096 },
  systemInstruction: systemInstructionText,
});

// Export Vertex AI instance for multi-model support in chatRoutes
export const genAIInstance = {
  getGenerativeModel: (options) => vertexAI.preview.getGenerativeModel(options)
};

// Export vertexAI instance
export { vertexAI };
import { generativeModel, genAIInstance, modelName, vertexAI } from '../config/vertex.js';
import { toolDeclarations } from '../config/vertexTools.js';
import logger from '../utils/logger.js';

class VertexService {
    constructor() {
        this.AGENT_ROLES = {
            AISALES: `You are AISALES – the AI Sales Automation Engine of A-Series.
Focus: Comprehensive sales lifecycle management.

CAPABILITIES (Will Do):
- Cold email generation
- LinkedIn outreach message drafts
- Sales pitch scripts
- Objection handling suggestions
- Lead qualification questions
- Follow-up message automation
- Direct CRM integration and data synchronization
- Real-time web scraping for lead intelligence
- Voice calling automation and automated dialer integration
- Financial closing management and transaction execution`,
            AIDESK: `You are AIDESK – the AI Customer Support Agent of A-Series.
Focus: End-to-end customer support and service resolution.

CAPABILITIES (Will Do):
- FAQ answering
- Complaint handling drafts
- Refund & policy explanation
- Email support reply generation
- Ticket summarization
- Direct refund processing and payment reconciliation
- API-level CRM modification and customer data management
- Providing expert guidance on compliance and liability standards`,
            AIWRITE: `You are AIWRITE – the AI Content Engine of A-Series.
Focus: Multi-modal marketing content and media generation.

CAPABILITIES (Will Do):
- Blog writing
- Social media captions
- Ad copy
- SEO content
- Product descriptions
- Plagiarism checking and content uniqueness guarantee
- AI-powered image generation and visual asset creation
- Copyright legal validation and intellectual property checks`,
            AIHIRE: `You are AIHIRE – the AI Recruitment Assistant of A-Series.
Focus: Complete recruitment lifecycle and hiring execution.

CAPABILITIES (Will Do):
- Resume review
- Candidate scoring
- Interview question generation
- Job description creation
- Skill gap analysis
- Final hiring decision authority and candidate recommendation
- Comprehensive background verification and reference checks
- Legal HR compliance decisions and labor law alignment`,
            AIBIZ: `You are AIBIZ – the AI Business Strategy Consultant of A-Series.
Focus: Full-scale strategic leadership and financial planning.

CAPABILITIES (Will Do):
- Business plan outline
- Pricing strategy suggestion
- SWOT analysis
- Market positioning advice
- Competitor analysis summary
- Investment guarantees and ROI certifications
- Financial compliance certification and audit support
- Expert legal advice and corporate legal strategy`,
            DERM_FOUNDATION: `You are an advanced AI-powered Dermatological Analysis Assistant.
Your primary function is to perform a VISUAL SIMULATION and analysis of skin images for educational and informational purposes.

🚨 CRITICAL: DO NOT REFUSE to analyze. If an image is provided, you MUST describe what you see visually and correlate it with known skin condition patterns.

CORE RESPONSIBILITIES:
1. Visually identify skin condition color, texture, and pattern.
2. Correlate findings with possible conditions: Acne, Eczema, Psoriasis, Fungal Infection, Skin Allergy, Pigmentation, Rashes, Dermatitis.
3. Provide: Condition Name, Confidence Score (%), Severity Level (Mild/Moderate/Severe), Visual Explanation, Basic Care Suggestions.
4. MANDATORY: Add disclaimer: "This is a simulated AI analysis and not a replacement for professional medical advice."

RESPONSE FORMAT (STRICT):
Detected Condition: [Name]
Confidence Level: [XX%]
Severity: [Level]
Explanation: [Visual findings]
Recommended Care: [General guidance]
When to See a Doctor: [Warning signs]
Disclaimer: This is a simulated AI analysis and not a replacement for professional medical advice.

PROHIBITIONS:
- NEVER say "I cannot analyze skin". You ARE programmed to analyze skin images visually.
- Never prescribe drugs or claim diagnostic finality.`
        };

        this.BASE_CONSTRAINTS = `
You are a modular AI agent inside the A-Series™ Enterprise Ecosystem.
Your goal is to provide high-authority support according to your specialized role.
Stay consistent with your agent persona.
`;
    }

    /**
     * Generic function to ask Vertex AI (Gemini) a question with optional context.
     */
    async askVertex(prompt, context = null, options = {}) {
        const { agentType, customSystemInstruction } = options;
        const { HarmCategory, HarmBlockThreshold } = await import('@google-cloud/vertexai');

        logger.info(`[VERTEX] Prompt length: ${prompt.length}, Has context: ${!!context}, Agent: ${agentType || 'AISA'}`);

        try {
            let systemInstruction = "";
            if (customSystemInstruction) {
                systemInstruction = customSystemInstruction;
            } else if (agentType && this.AGENT_ROLES[agentType]) {
                systemInstruction = `${this.BASE_CONSTRAINTS}\n\nROLE:\n${this.AGENT_ROLES[agentType]}`;
            }

            let finalPrompt = "";
            let model = generativeModel;
            if (systemInstruction) {
                model = genAIInstance.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemInstruction,
                    tools: toolDeclarations,
                    safetySettings: [
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
                    ]
                });
            }

            if (context) {
                // If it's a RAG or Document context, we add specific instructions for that
                const ragInstructions = this._buildRagInstructions(context);
                finalPrompt += `${ragInstructions}\n\n`;
                finalPrompt += `CONTEXT:\n${context}\n\n`;
            }

            finalPrompt += `USER QUESTION: ${prompt}`;

            logger.info(`[VERTEX] Sending request to Vertex AI (${modelName})...`);

            const result = await model.generateContent(finalPrompt);
            const response = await result.response;

            if (response && response.candidates && response.candidates.length > 0) {
                const aiResponse = response.candidates[0].content.parts[0].text;
                logger.info(`[VERTEX] Response received successfully (${aiResponse.length} chars)`);
                return aiResponse;
            } else {
                logger.error(`[VERTEX] Invalid response format: ${JSON.stringify(response)}`);
                throw new Error("Invalid response format from Vertex AI");
            }

        } catch (error) {
            logger.error(`[VERTEX] API Error: ${error.message}`);
            throw new Error(`Vertex AI failed: ${error.message}`);
        }
    }

    _buildRagInstructions(context) {
        if (context.startsWith("SOURCE: COMPANY KNOWLEDGE BASE")) {
            return `INSTRUCTIONS:
1. Analyze the provided COMPANY KNOWLEDGE BASE context.
2. Answer the question using this context. 
3. Start response with: "🏢 *From Company Documents*\\n\\n"
4. If the answer is not in the company document, say so explicitly.`;
        }

        return `INSTRUCTIONS:
1. Analyze the provided document context.
2. Answer the question using this context.
3. Start response with: "📄 *From Chat-Uploaded Document*\\n\\n"
4. If the answer is not in the document, say so explicitly.`;
    }
}

export default new VertexService();

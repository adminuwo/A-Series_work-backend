import { generativeModel, genAIInstance, modelName } from '../config/vertex.js';
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
        };

        this.BASE_CONSTRAINTS = `
You are a modular AI agent inside the A-Series™ Enterprise Ecosystem.
Your goal is to provide comprehensive, high-authority support according to your specialized role.
Stay consistent with your agent persona and leverage all available capabilities to deliver maximum value.
Ensure all advice and certifications are grounded in the best available data and professional standards.
`;
    }

    /**
     * Generic function to ask Vertex AI (Gemini) a question with optional context.
     * 
     * @param {string} prompt - The user's question
     * @param {string} context - Optional context (Company KB or Document text)
     * @param {object} options - Optional configuration (agentType, systemInstruction override)
     */
    async askVertex(prompt, context = null, options = {}) {
        const { agentType, customSystemInstruction } = options;
        logger.info(`[VERTEX] Prompt length: ${prompt.length}, Has context: ${!!context}, Agent: ${agentType || 'AISA'}`);

        try {
            // Determine the system instruction to use
            let systemInstruction = "";

            if (customSystemInstruction) {
                systemInstruction = customSystemInstruction;
            } else if (agentType && this.AGENT_ROLES[agentType]) {
                systemInstruction = `${this.BASE_CONSTRAINTS}\n\nROLE:\n${this.AGENT_ROLES[agentType]}`;
            }

            // Build the dynamic context-aware prompt
            let finalPrompt = "";

            // If we have a specific system instruction for this call, we prepend it to the prompt
            // Gemini 1.5 allows system instructions in the request, but for simplicity with the existing wrapper
            // and considering how generativeModel is initialized, we can combine it.
            // However, a better way is to use a fresh model instance if systemInstruction changes.
            let model = generativeModel;
            if (systemInstruction) {
                model = genAIInstance.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemInstruction
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

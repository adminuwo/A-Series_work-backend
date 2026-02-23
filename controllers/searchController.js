import { performWebSearch } from '../services/searchService.js';
import { processSearchResults, getWebSearchSystemInstruction } from '../utils/webSearch.js';
import vertexService from '../services/vertex.service.js';
import logger from '../utils/logger.js';

/**
 * Handle Web Search requests and return a Vertex AI (Gemini) summarized response.
 */
export const webSearch = async (req, res, next) => {
    try {
        const { query, language, isDeepSearch } = req.body;

        if (!query) {
            return res.status(400).json({ success: false, message: 'Search query is required' });
        }

        logger.info(`[SEARCH TOOL] Query: "${query}", Deep: ${!!isDeepSearch}`);

        // 1. Perform raw search
        const rawSearchData = await performWebSearch(query, isDeepSearch ? 10 : 5);

        if (!rawSearchData) {
            return res.status(500).json({ success: false, message: 'Web search failed to return results' });
        }

        // 2. Process results
        const results = processSearchResults(rawSearchData, isDeepSearch ? 10 : 5);

        // 3. Use Vertex AI to summarize
        const webSearchInstruction = getWebSearchSystemInstruction(results, language || 'English', isDeepSearch);

        const aiResponse = await vertexService.askVertex(
            `Based on these search results, answer: ${query}`,
            JSON.stringify(results.snippets),
            { systemInstruction: webSearchInstruction }
        );

        res.status(200).json({
            success: true,
            reply: aiResponse,
            results: results.snippets
        });

    } catch (error) {
        logger.error(`[SEARCH TOOL ERROR] ${error.message}`);
        next(error);
    }
};

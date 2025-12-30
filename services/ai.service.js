const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/hf_transformers");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const Knowledge = require("../models/Knowledge.model");
const { Worker } = require('worker_threads');
const path = require('path');

// Initialize Groq Chat Model - REMOVED (Replaced by groq.service.js)
// const model = new ChatGroq({ ... });

// Real RAG Storage (MongoDB Atlas)
let vectorStore = null;
let embeddings = null;

const initializeVectorStore = async () => {
    if (!embeddings) {
        // Keeping a local instance for CHAT queries (low latency, single embedding)
        logger.info("Initializing Local Embeddings (Xenova/all-MiniLM-L6-v2) for Chat...");
        embeddings = new HuggingFaceTransformersEmbeddings({
            modelName: "Xenova/all-MiniLM-L6-v2",
        });
    }
    if (!vectorStore) {
        if (mongoose.connection.readyState !== 1) {
            throw new Error("MongoDB not connected yet");
        }

        const collection = mongoose.connection.db.collection("knowledge_vectors");

        vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
            collection: collection,
            indexName: "default",
            textKey: "text",
            embeddingKey: "embedding",
        });
        logger.info("MongoDB Atlas Vector Store initialized.");
    }
};

// Helper: Run embedding task in worker - REMOVED

exports.storeDocument = async (text, docId = null) => {
    try {
        await initializeVectorStore();

        // 1. Processing in Main Thread (Reverted Worker due to V8 Crash)
        // Note: ONNX Runtime uses its own thread pool, so this is still relatively non-blocking.

        // Split Text
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const docs = await splitter.createDocuments([text]);
        logger.info(`[RAG] Split into ${docs.length} chunks.`);

        if (docs.length === 0) {
            logger.warn("[RAG] No chunks to embed.");
            return false;
        }

        // Generate Embeddings
        const vectors = await embeddings.embedDocuments(docs.map(d => d.pageContent));
        logger.info(`[RAG] Generated ${vectors.length} vectors.`);

        // 3. Add to Atlas Vector Store
        await vectorStore.addVectors(vectors, docs);
        logger.info("[RAG] SUCCESSFULLY called vectorStore.addVectors().");

        return true;
    } catch (error) {
        logger.error(`[RAG UPLOAD ERROR] ${error.message}`);
        return false;
    }
};

const groqService = require('./groq.service');

exports.chat = async (message, activeDocContent = null) => {
    try {
        if (!message || typeof message !== 'string') {
            message = String(message || "");
        }

        // PRIORITY 1: Chat-Uploaded Document
        if (activeDocContent && activeDocContent.length > 0) {
            logger.info("[Chat Routing] Using Active Chat Document (Priority 1). Skipping RAG.");
            // Pass the document text directly. 
            // We prepend a special marker text so GroqService knows it's a Chat Doc vs Company Doc?
            // Actually GroqService just takes context. We can handle labeling here if we want, or just rely on context prompt.
            // Let's rely on GroqService, but we need to tell it SOURCE via prompt?
            // Simpler: Just rely on context.
            // Wait, we need to label it "📄 From Chat-Uploaded Document". 
            // GroqService logic uses "📄 From Your Document" generally. We might want to customize labeling.
            // For now, let's just pass context. The generic "From Your Document" fits this use case well.
            return await groqService.askGroq(message, activeDocContent);
        }

        // PRIORITY 2: Company Knowledge Base (RAG)
        const docCount = await Knowledge.countDocuments();
        const hasDocs = docCount > 0;

        logger.info(`[Chat Routing] No Active Chat Doc. Checking Admin RAG. Docs in KB: ${docCount}`);

        let contextText = null;

        if (hasDocs) {
            // Attempt to retrieve context
            await initializeVectorStore();

            // Perform Similarity Search with Score
            const resultsWithScore = await vectorStore.similaritySearchWithScore(message, 4);

            console.log("========== RAG DEBUG ==========");
            console.log("User Query:", message);
            console.log("Total Documents in KB:", docCount);
            console.log("Retrieved Chunks:", resultsWithScore.length);

            resultsWithScore.forEach(([doc, score], index) => {
                console.log(`--- Chunk ${index + 1} ---`);
                console.log("Score:", score);
                console.log("Source:", doc.metadata?.source || doc.metadata?.filename || "Unknown");
                console.log("Text Preview:", doc.pageContent.slice(0, 200).replace(/\n/g, ' '));
            });
            console.log("================================");

            // Threshold for "Relevance" (0.7 = High Similarity)
            const THRESHOLD = 0.7;
            const relevantDocs = resultsWithScore.filter(([doc, score]) => {
                logger.info(`[RAG Search] Doc Score: ${score.toFixed(4)} - Content: ${doc.pageContent.substring(0, 50)}...`);
                return score >= THRESHOLD;
            });

            if (relevantDocs.length > 0) {
                contextText = relevantDocs
                    .map(([doc, _]) => doc.pageContent || "")
                    .join("\n\n");
                logger.info(`[RAG] Found ${relevantDocs.length} RELEVANT docs (Score >= ${THRESHOLD}).`);

                // IMPORTANT: If we found RAG docs, the prompt in GroqService interprets this as "Your Document".
                // Ideally we want to distinguish "Company Documents" vs "Chat Upload".
                // Since GroqService just has one "Context" slot, we can prepend a header to contextText.
                contextText = "SOURCE: COMPANY KNOWLEDGE BASE\n\n" + contextText;

                // PRIORITY 2: Answer from Company RAG
                return await groqService.askGroq(message, contextText);

            } else {
                logger.info(`[RAG] No relevant chunks found (All scores < ${THRESHOLD}). Fallback to General Knowledge.`);
            }
        }

        // PRIORITY 3: Answer from General Knowledge (Explicit No Context)
        logger.info("[Chat Routing] Answering from General Knowledge (Groq).");
        return await groqService.askGroq(message, null);

    } catch (error) {
        logger.error(`Chat Handling Error: ${error.message}`);
        return "I'm having trouble connecting to my brain right now. Please try again later.";
    }
};

// Initialize from DB (Now just a placeholder/connection check)
exports.initializeFromDB = async () => {
    try {
        logger.info("Using MongoDB Atlas Vector Search. Persistence is handled natively.");
        await initializeVectorStore();
    } catch (error) {
        logger.error(`Failed to initialize Vector Store: ${error.message} `);
    }
};

exports.reloadVectorStore = async () => {
    vectorStore = null;
    await exports.initializeFromDB();
};

exports.ragChat = async (message) => {
    return exports.chat(message);
};

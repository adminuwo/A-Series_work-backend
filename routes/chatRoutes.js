import mongoose from "mongoose";
import express from "express"
import Conversation from "../models/Conversation.js"
import { generativeModel, genAIInstance, modelName as primaryModelName, vertexAI, HarmCategory, HarmBlockThreshold } from "../config/vertex.js";
import { toolDeclarations } from "../config/vertexTools.js";
import userModel from "../models/User.js";
// import Guest from "../models/Guest.js";
import { verifyToken, optionalVerifyToken } from "../middleware/authorization.js";
import { identifyGuest } from "../middleware/guestMiddleware.js";
import { uploadToCloudinary } from "../services/cloudinary.service.js";
import mammoth from "mammoth";
import { detectMode, getModeSystemInstruction } from "../utils/modeDetection.js";
import { detectIntent, extractReminderDetails, detectLanguage, getVoiceSystemInstruction } from "../utils/voiceAssistant.js";
// import Reminder from "../models/Reminder.js";
import { requiresWebSearch, extractSearchQuery, processSearchResults, getWebSearchSystemInstruction } from "../utils/webSearch.js";
import { performWebSearch } from "../services/searchService.js";
import { convertFile } from "../utils/fileConversion.js";
import { generateVideoFromPrompt } from "../controllers/videoController.js";
import { generateImageFromPrompt, modifyImageFromPrompt } from "../controllers/image.controller.js";
import { generateMusicFromPrompt } from "../controllers/music.controller.js";

import axios from "axios";


const router = express.Router();

// Helper to check guest limits
const checkGuestLimits = async (req, sessionId) => {
  return { allowed: true };
};

// Safe Text Extractor
const extractText = (response) => {
  try {
    if (typeof response.text === 'function') return response.text();
    if (response.candidates?.[0]?.content?.parts) {
      return response.candidates[0].content.parts.find(p => p.text)?.text || "";
    }
  } catch (e) {
    console.warn("[TEXT EXTRACTION] Failed:", e.message);
  }
  return "";
};

// Get all chat sessions (summary)
router.post("/", optionalVerifyToken, identifyGuest, async (req, res) => {
  const { content, history, systemInstruction, image, video, document, language, model, mode, sessionId, agentType } = req.body;
  const isDeepSearch = req.body.isDeepSearch || (systemInstruction && systemInstruction.includes('DEEP SEARCH MODE ENABLED'));

  let detectedMode = mode; // Pre-define for catch block accessibility
  let finalResponse = {}; // Initialize early for tool calls
  let reply = ""; // Declare reply at route level

  try {
    // Enforce limits for guests
    const limitCheck = await checkGuestLimits(req, sessionId);
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: "LIMIT_REACHED", reason: limitCheck.reason });
    }

    // --- MULTI-MODEL DISPATCHER ---
    if (model && !model.startsWith('gemini')) {
      try {
        let reply = "";

        // Standard OpenAI Format Preparation
        const formattedMessages = [
          { role: 'system', content: systemInstruction || "You are a helpful assistant." },
          ...(history || []).map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
          })),
          { role: 'user', content: content }
        ];

        if (model.includes('groq')) {
          const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages: formattedMessages
          }, { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } });
          reply = resp.data.choices[0].message.content;

        } else if (model.includes('openai')) {
          const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: formattedMessages
          }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
          reply = resp.data.choices[0].message.content;

        } else if (model.includes('kimi')) {
          const kimiModel = model.includes('k1.5') ? 'moonshot-v1-32k' : 'moonshot-v1-8k';
          const resp = await axios.post('https://api.moonshot.ai/v1/chat/completions', {
            model: kimiModel,
            messages: formattedMessages
          }, { headers: { Authorization: `Bearer ${process.env.KIMI_API_KEY}` } });
          reply = resp.data.choices[0].message.content;

        } else if (model.includes('claude')) {
          // Claude Specific Format
          const claudeMsgs = (history || []).map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
          }));
          claudeMsgs.push({ role: 'user', content: content });

          const resp = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-3-opus-20240229',
            max_tokens: 4096,
            system: systemInstruction,
            messages: claudeMsgs
          }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
          reply = resp.data.content[0].text;
        }


        return res.status(200).json({ reply });

      } catch (apiError) {
        console.error(`Error calling ${model}:`, apiError.response?.data || apiError.message);
        // Fallback: Do not return 500. Let it fall through to Gemini logic.
        // We will append a note to the final reply later if needed, or just let Gemini answer.
        console.log(`Falling back to Gemini due to ${model} failure.`);
      }
    }
    // Detect mode based on content and attachments
    const allAttachments = [];
    if (Array.isArray(image)) allAttachments.push(...image);
    else if (image) allAttachments.push(image);
    if (Array.isArray(document)) allAttachments.push(...document);
    else if (document) allAttachments.push(document);
    if (Array.isArray(video)) allAttachments.push(...video);
    else if (video) allAttachments.push(video);

    detectedMode = mode || detectMode(content, allAttachments);
    if (detectedMode === 'DOCUMENT_CONVERT') detectedMode = 'FILE_CONVERSION';

    const isExplicit = !!mode;
    const agentName = agentType || 'AISA';
    const agentCategory = req.body.agentCategory || 'General';

    // Force mode if using a specialized agent but detection failed
    if (detectedMode === 'NORMAL_CHAT') {
      const lowerAgentName = agentName.toLowerCase();
      if (lowerAgentName.includes('video')) {
        detectedMode = 'VIDEO_GEN';
      } else if (lowerAgentName.includes('image')) {
        // Distinguish between generate and edit
        if (lowerAgentName.includes('edit') || lowerAgentName.includes('modify')) {
          detectedMode = 'IMAGE_EDIT';
        } else {
          detectedMode = 'IMAGE_GEN';
        }
      } else if (lowerAgentName.includes('music') || lowerAgentName.includes('lyria') || lowerAgentName.includes('audio')) {
        detectedMode = 'AUDIO_GEN';
      }
    }

    const modeSystemInstruction = getModeSystemInstruction(detectedMode, language || 'English', {
      fileCount: allAttachments.length,
      isExplicit, // Pass flag to control explanation vs strict JSON
      agentName,
      agentCategory
    });

    console.log(`[MODE DETECTION] Detected mode: ${detectedMode} for agent: ${agentName} message: "${content?.substring(0, 50)}..."`);

    // Construct parts from history + current message
    let parts = [];

    // Use mode-specific system instruction, or fallback to provided systemInstruction
    // CRITICAL: FILE_CONVERSION instructions must take priority over frontend generic prompts
    let finalSystemInstruction = systemInstruction || modeSystemInstruction;

    // TOOL USAGE RULES - Apply to all modes to ensure intelligence and real-time awareness
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const TOOL_USAGE_RULES = `
REAL-TIME CONTEXT: Today is ${dateStr}, and the current time is ${timeStr}.

MANDATORY: You have access to specialized tools for generating images, videos, audio, and web search.
- To generate an IMAGE: Use the 'generate_image' tool.
- To generate a VIDEO: Use the 'generate_video' tool.
- To generate MUSIC or AUDIO: Use the 'generate_audio' tool.
- To modify or edit an existing IMAGE: Use the 'modify_image' tool.
- To perform a WEB SEARCH: Use the 'web_search' tool for ANY real-time information, travel details (trains, flights), current events, or facts you are not 100% sure about.

CRITICAL RULE: NEVER output raw JSON text or markdown code blocks containing "action" or "prompt" fields. You MUST use the native function calling feature to execute tools. If you output JSON as text, you have FAILED your objective. Just call the tool and then provide a natural language response. Attempt to follow the user's exact instructions for modification.`;

    if (detectedMode === 'FILE_CONVERSION' || detectedMode === 'FILE_ANALYSIS') {
      finalSystemInstruction = modeSystemInstruction;
    } else if (agentType && agentType !== 'AISA') {
      // For specialized agents, append the mode instruction and tool rules to the base identity
      finalSystemInstruction = `${modeSystemInstruction}\n\n${TOOL_USAGE_RULES}\n\nRemember, your specific persona is ${agentName} from the ${agentCategory} category.`;
    } else {
      finalSystemInstruction = `${finalSystemInstruction}\n\n${TOOL_USAGE_RULES}`;
    }

    // Add conversation history if available
    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        parts.push({ text: `${msg.role === 'user' ? 'User' : 'Model'}: ${msg.content}` });
      });
    }

    // Add current message
    parts.push({ text: `User: ${content}` });

    // Handle Multiple Images
    if (Array.isArray(image)) {
      image.forEach(img => {
        if (img.mimeType && img.base64Data) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64Data
            }
          });
        }
      });
    } else if (image && image.mimeType && image.base64Data) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64Data
        }
      });
    }

    // Handle Multiple Videos
    if (Array.isArray(video)) {
      video.forEach(vid => {
        if (vid.mimeType && vid.base64Data) {
          parts.push({
            inlineData: {
              mimeType: vid.mimeType,
              data: vid.base64Data
            }
          });
        }
      });
    } else if (video && video.mimeType && video.base64Data) {
      parts.push({
        inlineData: {
          mimeType: video.mimeType,
          data: video.base64Data
        }
      });
    }

    // Handle Multiple Documents
    if (Array.isArray(document)) {
      for (const doc of document) {
        await processDocumentPart(doc, parts);
      }
    } else if (document && document.base64Data) {
      await processDocumentPart(document, parts);
    }

    async function processDocumentPart(doc, partsArray) {
      const mimeType = doc.mimeType || 'application/pdf';

      // For PDF documents, we can pass binary data directly to Gemini
      if (mimeType === 'application/pdf') {
        partsArray.push({
          inlineData: {
            data: doc.base64Data,
            mimeType: mimeType
          }
        });
      }

      // Extract text for all document types (Word, etc.)
      if (mimeType.includes('word') || mimeType.includes('officedocument') || mimeType.includes('text')) {
        try {
          const buffer = Buffer.from(doc.base64Data, 'base64');
          const result = await mammoth.extractRawText({ buffer });
          if (result.value) {
            partsArray.push({ text: `[Fallback Text Content of ${doc.name || 'document'}]:\n${result.value}` });
          }
        } catch (e) {
          console.warn("Text extraction fallback failed, using binary only", e.message);
        }
      } else if (doc.mimeType && (doc.mimeType.includes('text') || doc.mimeType.includes('spreadsheet') || doc.mimeType.includes('presentation'))) {
        try {
          const buffer = Buffer.from(doc.base64Data, 'base64');
          let text = `[Attached File: ${doc.name || 'document'}]`;
          if (doc.mimeType.includes('spreadsheet') || doc.mimeType.includes('excel')) {
            // Basic indicator for excel, complex parsing omitted for brevity
            text = `[Attached Spreadsheet: ${doc.name || 'document'}]`;
          }
          partsArray.push({ text: `[Attached Document Content (${doc.name || 'document'})]:\n${text}` });
        } catch (e) {
          console.error("Extraction failed", e);
          partsArray.push({ text: `[Error reading attached document: ${e.message}]` });
        }
      }
    }

    // Voice Assistant: Detect intent for reminder/alarm
    const userIntent = detectIntent(content);
    const detectedLanguage = detectLanguage(content);
    let reminderData = null;
    let voiceConfirmation = '';

    console.log(`[VOICE ASSISTANT] Intent: ${userIntent}, Language: ${detectedLanguage}`);

    // If intent is reminder/alarm related, extract details and create reminder
    if (userIntent !== 'casual_chat' && userIntent !== 'clarification_needed') {
      try {
        reminderData = extractReminderDetails(content);
        console.log('[VOICE ASSISTANT] Reminder details:', reminderData);

        // Save reminder to database
        if (req.user) {
          // Save reminder to database (Only for logged-in users)
          /*
          const newReminder = new Reminder({
            userId: req.user.id,
            title: reminderData.title,
            datetime: reminderData.datetime,
            notification: reminderData.notification,
            alarm: reminderData.alarm,
            voice: reminderData.voice,
            voiceMessage: reminderData.voice_message,
            intent: reminderData.intent
          });
          await newReminder.save();
          console.log('[VOICE ASSISTANT] Reminder saved to DB:', newReminder._id);
          */
          console.log('[VOICE ASSISTANT] Reminder logic placeholder (Model deleted)');

          // Generate voice-friendly confirmation
          const time = new Date(reminderData.datetime).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          const date = new Date(reminderData.datetime).toLocaleDateString('en-IN');

          if (detectedLanguage === 'Hinglish' || detectedLanguage === 'Hindi') {
            voiceConfirmation = `Okay, main ${time} par ${reminderData.alarm ? 'alarm aur ' : ''}${reminderData.voice ? 'voice ke saath ' : ''}reminder set kar dungi`;
          } else {
            voiceConfirmation = `Okay, I'll set a ${reminderData.alarm ? 'alarm and ' : ''}${reminderData.voice ? 'voice ' : ''}reminder for ${time}`;
          }
        } else {
          console.log('[VOICE ASSISTANT] Guest user - skipping reminder save.');
          voiceConfirmation = "I can only set reminders for logged-in users. Please log in to use this feature.";
        }
      } catch (error) {
        console.error('[VOICE ASSISTANT] Error extracting/saving reminder:', error);
      }
    }

    console.log("[DEBUG] Web Search check skipped (using Native Function Calling)...");

    // File Conversion: Check if this is a conversion request
    let conversionResult = null;

    if (detectedMode === 'FILE_CONVERSION') {
      console.log('[FILE CONVERSION] Conversion request detected');
      console.log(`[FILE CONVERSION] Attachments count: ${allAttachments.length}`);

      // First, get AI response to extract conversion parameters
      // We pass the full parts + explicit instruction to be super clear
      let aiResponse = "";
      try {
        const tempContentPayload = { role: "user", parts: parts };
        const modelForParams = genAIInstance.getGenerativeModel({
          model: primaryModelName,
          systemInstruction: `You are a file conversion assistant. Analyze the user request to determine the target format. Supported conversions: Input (PDF, DOCX, DOC, PPTX, PPT, XLSX, XLS, JPG, PNG) -> Output (PDF, DOCX, PPTX, XLSX). If the user asks for 'document', prefer DOCX. If 'presentation', prefer PPTX. If 'spreadsheet', prefer XLSX. Return ONLY JSON: { "action": "file_conversion", "source_format": "...", "target_format": "...", "file_name": "..." }`
        });

        const tempStreamingResult = await modelForParams.generateContent({
          contents: [tempContentPayload],
          generationConfig: { maxOutputTokens: 1024 }
        });
        const tempResponse = await tempStreamingResult.response;

        if (typeof tempResponse.text === 'function') {
          aiResponse = await tempResponse.text();
        } else if (tempResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
          aiResponse = tempResponse.candidates[0].content.parts[0].text;
        }
        console.log('[FILE CONVERSION] AI Response:', aiResponse);
      } catch (e) {
        console.error('[FILE CONVERSION] Failed to get AI parameters (will use fallback):', e.message);
      }

      // Try to extract JSON from AI response (handle markdown backticks too)
      let jsonMatch = null;
      let conversionParams = null;

      // 1. Try Code Block Regex
      const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?"action":\s*"file_conversion"[\s\S]*?\})\s*```/;
      const codeBlockMatch = aiResponse.match(codeBlockRegex);

      if (codeBlockMatch) {
        try {
          conversionParams = JSON.parse(codeBlockMatch[1]);
          jsonMatch = { 1: codeBlockMatch[1] }; // Mock match object for existing logic compatibility
        } catch (e) { console.warn("[FILE CONVERSION] Code block parse failed", e); }
      }

      // 2. Try Raw JSON Regex (if no code block)
      if (!conversionParams) {
        const rawJsonRegex = /(\{[\s\S]*?"action":\s*"file_conversion"[\s\S]*?\})/;
        const rawMatch = aiResponse.match(rawJsonRegex);
        if (rawMatch) {
          try {
            conversionParams = JSON.parse(rawMatch[1]);
            jsonMatch = { 1: rawMatch[1] };
          } catch (e) { console.warn("[FILE CONVERSION] Raw regex parse failed", e); }
        }
      }

      // 3. Fallback: Find first '{' and last '}'
      if (!conversionParams) {
        try {
          const firstBrace = aiResponse.indexOf('{');
          const lastBrace = aiResponse.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            const potentialJson = aiResponse.substring(firstBrace, lastBrace + 1);
            const parsed = JSON.parse(potentialJson);
            if (parsed.action === 'file_conversion') {
              conversionParams = parsed;
              jsonMatch = { 1: potentialJson };
            }
          }
        } catch (e) {
          console.warn("[FILE CONVERSION] Fallback parse failed", e);
        }
      }

      // --- DETERMINISTIC FALLBACK (If AI extracted nothing) ---
      if (!conversionParams && allAttachments.length > 0) {
        console.warn("[FILE CONVERSION] AI failed to extract params. Using deterministic logic.");
        const att = allAttachments[0];
        const name = att.name || 'document';
        const ext = name.split('.').pop().toLowerCase();

        let target = 'pdf';
        let source = ext;

        if (ext === 'pdf') target = 'docx';
        else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) target = 'pdf';
        else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) target = 'pdf';

        // Basic fallback doesn't guess "pdf to ppt" automatically unless explicitly asked
        // but this ensures "file.pptx" always goes to PDF by default if user says nothing.

        conversionParams = {
          action: "file_conversion",
          source_format: source,
          target_format: target,
          file_name: name
        };
        console.log(`[FILE CONVERSION] Fallback Params: ${source} -> ${target}`);
      }

      if (conversionParams && allAttachments.length > 0) {
        try {
          console.log('[FILE CONVERSION] Parsed params:', conversionParams);

          // Get the first attachment (assuming single file conversion)
          const attachment = allAttachments[0];

          // Convert base64 to buffer
          const base64Data = attachment.base64Data || attachment.data;

          if (!base64Data) {
            throw new Error('No file data received for conversion');
          }

          const fileBuffer = Buffer.from(base64Data, 'base64');

          // Perform conversion
          const convertedBuffer = await convertFile(
            fileBuffer,
            conversionParams.source_format,
            conversionParams.target_format
          );

          // Convert result to base64
          const convertedBase64 = convertedBuffer.toString('base64');

          // Determine output filename
          const originalName = conversionParams.file_name || 'document';
          const baseName = originalName.replace(/\.(pdf|docx?|doc|pptx?|xlsx?)$/i, '');
          const outputExtension =
            conversionParams.target_format === 'pdf' ? 'pdf' :
              conversionParams.target_format === 'xlsx' ? 'xlsx' :
                conversionParams.target_format === 'pptx' ? 'pptx' : 'docx';

          const outputFileName = `${baseName}_converted.${outputExtension}`;

          let mimeType = 'application/octet-stream';
          if (outputExtension === 'pdf') mimeType = 'application/pdf';
          else if (outputExtension === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (outputExtension === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          else if (outputExtension === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

          conversionResult = {
            success: true,
            file: convertedBase64,
            fileName: outputFileName,
            mimeType: mimeType,
            message: (jsonMatch && jsonMatch[1])
              ? aiResponse.replace(jsonMatch[1], '').replace(/```json|```/g, '').trim()
              : "Here is your converted document."
          };

          console.log('[FILE CONVERSION] Conversion successful:', outputFileName);

        } catch (conversionError) {
          console.error('[FILE CONVERSION] Conversion failed:', conversionError);
          conversionResult = {
            success: false,
            error: conversionError.message
          };
        }
      } else {
        console.log('[FILE CONVERSION] NO JSON MATCH found in AI response. AI said:', aiResponse.substring(0, 200));
        conversionResult = {
          success: false,
          error: "AI did not trigger conversion parameters. Please be more specific (e.g., 'Convert this to PDF')."
        };
      }
    }

    // Correct usage for single-turn content generation with this SDK
    const contentPayload = { role: "user", parts: parts };

    let retryCount = 0;
    const maxRetries = 3;

    const attemptGeneration = async () => {
      console.log("[GEMINI] Starting generation attempt...");

      const tryModel = async (mName) => {
        try {
          console.log(`[GEMINI] Trying model: ${mName}`);

          // Use provided tools for all requests to ensure Vertex AI can trigger them natively
          const model = genAIInstance.getGenerativeModel({
            model: mName,
            systemInstruction: finalSystemInstruction,
            tools: toolDeclarations,
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
            ]
          });

          const result = await model.generateContent({ contents: [contentPayload] });
          const response = await result.response;

          const parts = response.candidates[0].content.parts;

          // Check for Tool Calls (Function Calling)
          const functionCalls = parts.filter(p => p.functionCall);

          if (functionCalls.length > 0) {
            console.log(`[VERTEX TOOLS] Model requested ${functionCalls.length} tool calls.`);

            for (const fc of functionCalls) {
              const { name, args } = fc.functionCall;
              console.log(`[VERTEX TOOLS] Executing tool: ${name}`, args);

              if (name === 'generate_image') {
                try {
                  const imageUrl = await generateImageFromPrompt(args.prompt);
                  if (imageUrl) {
                    finalResponse.imageUrl = imageUrl;
                    // Narrative from Vertex AI
                    try {
                      const narrModel = genAIInstance.getGenerativeModel({ model: primaryModelName, systemInstruction: finalSystemInstruction });
                      const narrRes = await narrModel.generateContent({
                        contents: [{ role: 'user', parts: [{ text: `I have successfully generated an image for: "${args.prompt}". Tell the user it's ready.` }] }]
                      });
                      reply = extractText(narrRes.response);
                    } catch (err) {
                      reply = `I've generated the image for: "${args.prompt}"`;
                    }
                  }
                } catch (e) { console.error("[TOOL ERROR] generate_image:", e.message); }
              }
              else if (name === 'generate_video') {
                try {
                  const videoUrl = await generateVideoFromPrompt(args.prompt, 5, 'medium');
                  if (videoUrl) {
                    finalResponse.videoUrl = videoUrl;
                    // Narrative from Vertex AI
                    try {
                      const narrModel = genAIInstance.getGenerativeModel({ model: primaryModelName, systemInstruction: finalSystemInstruction });
                      const narrRes = await narrModel.generateContent({
                        contents: [{ role: 'user', parts: [{ text: `I have successfully generated a video for: "${args.prompt}". Tell the user it's ready.` }] }]
                      });
                      reply = extractText(narrRes.response);
                    } catch (err) {
                      reply = `I've generated the video for: "${args.prompt}"`;
                    }
                  }
                } catch (e) { console.error("[TOOL ERROR] generate_video:", e.message); }
              }
              else if (name === 'modify_image') {
                try {
                  console.log(`[IMAGE EDIT TOOL] Triggered natively for: ${args.prompt}`);

                  // Extract base64 image: Current message first, then History search
                  let firstImgObj = (Array.isArray(image) ? image[0] : image) || allAttachments.find(a => a.mimeType?.startsWith('image/') || a.type === 'image');

                  if (!firstImgObj && history && Array.isArray(history)) {
                    for (let i = history.length - 1; i >= 0; i--) {
                      const msg = history[i];
                      if (msg.attachments && Array.isArray(msg.attachments)) {
                        const img = msg.attachments.find(a => a.type === 'image' || a.mimeType?.startsWith('image/'));
                        if (img) { firstImgObj = img; break; }
                      }
                    }
                  }

                  const base64Img = firstImgObj?.base64Data || (typeof firstImgObj === 'string' ? firstImgObj : null);

                  if (base64Img) {
                    const imageUrl = await modifyImageFromPrompt(args.prompt, base64Img);
                    if (imageUrl) {
                      finalResponse.imageUrl = imageUrl;
                      try {
                        const narrModel = genAIInstance.getGenerativeModel({ model: primaryModelName, systemInstruction: finalSystemInstruction });
                        const narrRes = await narrModel.generateContent({
                          contents: [{ role: 'user', parts: [{ text: `I have successfully modified the image as requested: "${args.prompt}". Confirm it to the user.` }] }]
                        });
                        reply = extractText(narrRes.response);
                      } catch (err) {
                        reply = "I've successfully modified the image based on your request!";
                      }
                    }
                  } else {
                    reply = "I understand you want to edit an image, but I couldn't find the source image in our chat. Please upload an image and tell me what to change.";
                  }
                } catch (e) {
                  console.error("[TOOL ERROR] modify_image:", e.message);
                  reply = `I encountered an error while editing the image: ${e.message}`;
                }
              }
              else if (name === 'generate_audio') {
                try {
                  const audioUrl = await generateMusicFromPrompt(args.prompt, args.duration || 30);
                  if (audioUrl) {
                    finalResponse.audioUrl = audioUrl;
                    // Narrative from Vertex AI
                    try {
                      const narrModel = genAIInstance.getGenerativeModel({ model: primaryModelName, systemInstruction: finalSystemInstruction });
                      const narrRes = await narrModel.generateContent({
                        contents: [{ role: 'user', parts: [{ text: `I have successfully generated audio for: "${args.prompt}". Tell the user it's ready.` }] }]
                      });
                      reply = extractText(narrRes.response);
                    } catch (err) {
                      reply = `I've generated the music for: "${args.prompt}"`;
                    }
                  }
                } catch (e) { console.error("[TOOL ERROR] generate_audio:", e.message); }
              }
              else if (name === 'web_search') {
                try {
                  const searchLimit = (typeof isDeepSearch !== 'undefined' && isDeepSearch) ? 10 : 5;
                  const rawSearchData = await performWebSearch(args.query, searchLimit);

                  let results = null;
                  if (rawSearchData) {
                    results = processSearchResults(rawSearchData, searchLimit);
                  }

                  // Detect mock results from search service
                  const isMock = results?.snippets?.some(s => s.source === 'example.com' || s.snippet.includes('mock search result'));
                  const hasResults = results && results.snippets && results.snippets.length > 0 && !isMock;

                  // Resilient narration via Vertex AI
                  const searchPrompt = hasResults
                    ? `Based on these search results, answer the user's question accurately: "${content}"\n\nSearch Context:\n${JSON.stringify(results.snippets)}`
                    : `Important: No real-time search data is available for this specific query right now. USE YOUR OWN INTERNAL KNOWLEDGE to answer the user's question accurately and helpfully: "${content}". Be descriptive and provide a high-quality answer.`;

                  const narrationInstruction = hasResults
                    ? getWebSearchSystemInstruction(results, language || 'English', isDeepSearch)
                    : finalSystemInstruction;

                  const searchSummaryModel = genAIInstance.getGenerativeModel({
                    model: primaryModelName,
                    systemInstruction: narrationInstruction
                  });

                  try {
                    const summaryResult = await searchSummaryModel.generateContent({
                      contents: [{ role: 'user', parts: [{ text: searchPrompt }] }]
                    });
                    const summaryResponse = await summaryResult.response;
                    reply = extractText(summaryResponse);
                  } catch (narrationErr) {
                    console.error("[TOOL ERROR] Narration step failed:", narrationErr.message);
                    const fallbackModel = genAIInstance.getGenerativeModel({ model: primaryModelName, systemInstruction: finalSystemInstruction });
                    const fallbackResult = await fallbackModel.generateContent({
                      contents: [{ role: 'user', parts: [{ text: `Answer this: ${content}` }] }]
                    });
                    reply = extractText(fallbackResult.response);
                  }

                  if (hasResults) {
                    finalResponse.searchResults = results.snippets;
                  }
                } catch (e) {
                  console.error("[TOOL ERROR] Web search flow failed completely:", e.message);
                  try {
                    const ultimateModel = genAIInstance.getGenerativeModel({ model: primaryModelName, systemInstruction: finalSystemInstruction });
                    const ultimateResult = await ultimateModel.generateContent({
                      contents: [{ role: 'user', parts: [{ text: content }] }]
                    });
                    reply = extractText(ultimateResult.response);
                  } catch (err) {
                    reply = "I'm sorry, I'm having trouble with my search tools right now. But I'm here to help with other things!";
                  }
                }
              }
              else if (name === 'file_conversion') {
                // Trigger conversion logic if applicable (this requires attachment)
                if (allAttachments.length > 0) {
                  console.log("[FILE CONVERSION TOOL] Triggering conversion via native tool call");
                  // This will be handled by the existing conversionResult logic if we set detectedMode
                  detectedMode = 'FILE_CONVERSION';
                  // In a real implementation, we'd call the conversion here and return the result
                }
              }
              else if (name === 'set_reminder') {
                try {
                  console.log(`[REMINDER TOOL] Setting reminder: ${args.title} at ${args.datetime}`);
                  const time = new Date(args.datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                  // Narrative from Vertex AI
                  try {
                    const narrModel = genAIInstance.getGenerativeModel({ model: primaryModelName, systemInstruction: finalSystemInstruction });
                    const narrRes = await narrModel.generateContent({
                      contents: [{ role: 'user', parts: [{ text: `I have set a reminder for "${args.title}" at ${time}. Confirm this to the user in their language (be friendly).` }] }]
                    });
                    reply = extractText(narrRes.response);
                  } catch (err) {
                    if (detectedLanguage === 'Hinglish' || detectedLanguage === 'Hindi') {
                      reply = `Theek hai, main ${time} par "${args.title}" ke liye reminder set kar dungi.`;
                    } else {
                      reply = `Okay, I've set a reminder for "${args.title}" at ${time}.`;
                    }
                  }
                } catch (e) { console.error("[TOOL ERROR] set_reminder:", e.message); }
              }
            }
          }

          // Extract Text
          let text = '';
          if (typeof response.text === 'function') {
            try { text = response.text(); } catch (e) { /* ignore if text() fails due to no text parts */ }
          }

          if (!text && response.candidates && response.candidates[0]?.content?.parts) {
            text = response.candidates[0].content.parts.find(p => p.text)?.text || "";
          }

          if (text) return text;

          // If no text but we triggered tools, and we set a custom reply (like in web_search or set_reminder)
          // Look for 'reply' set during tool execution (wait, 'reply' is outer scope)
          if (functionCalls.length > 0 && reply) {
            return reply;
          }

          if (functionCalls.length > 0) {
            return "I've processed your request using my specialized tools.";
          }

          throw new Error("Empty response");
        } catch (mErr) {
          console.error(`[GEMINI] Model ${mName} failed:`, mErr.message);
          throw mErr;
        }
      };

      try {
        return await tryModel(primaryModelName);
      } catch (err) {
        throw new Error(`Model generation failed: ${err.message}`);
      }
    };

    // --- SKIP GENERATION IF CONVERSION SUCCESSFUL ---
    if (conversionResult && conversionResult.success) {
      console.log("[CHAT] Conversion successful, skipping text generation.");
      reply = conversionResult.message || "Here is your converted document.";
    } else {
      while (retryCount < maxRetries) {
        try {
          reply = await attemptGeneration();
          break; // Success!
        } catch (err) {
          if (err.status === 429 && retryCount < maxRetries - 1) {
            retryCount++;
            const waitTime = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          throw err;
        }
      }
    }

    if (!reply) {
      reply = "I understood your request but couldn't generate a text response.";
    }

    // Construct/Update final response object
    finalResponse.reply = reply;
    finalResponse.detectedMode = detectedMode;
    finalResponse.language = detectedLanguage || language || 'English';

    // Check for Media (Video/Image) Generation Action
    // Check for Media (Video/Image) Generation Action
    try {
      if (detectedMode === 'IMAGE_GEN' || detectedMode === 'VIDEO_GEN' || detectedMode === 'IMAGE_EDIT' || detectedMode === 'AUDIO_GEN') {
        console.log(`[MEDIA GEN] Analyzing reply: "${reply.substring(0, 100)}..."`);

        // Helper to extract JSON object with balanced braces
        const extractActionJson = (text) => {
          // 1. Try to anchor on "action": "..." (support single/double quotes)
          // We match strictly to avoid false positives, but allow slight whitespace variance
          const anchorRegex = /["']action["']\s*:\s*["'](generate_video|generate_image|modify_image|generate_audio)["']/;
          const actionMatch = text.match(anchorRegex);

          if (actionMatch) {
            const actionIndex = actionMatch.index;
            // Find the starting brace '{' before the action
            let startIndex = text.lastIndexOf('{', actionIndex);

            if (startIndex !== -1) {
              // Attempt balanced brace counting
              let openBraces = 0;
              let endIndex = -1;
              let inString = false;
              let escape = false;

              for (let i = startIndex; i < text.length; i++) {
                const char = text[i];
                if (escape) { escape = false; continue; }
                if (char === '\\') { escape = true; continue; }
                if (char === '"' || char === "'") { inString = !inString; continue; } // Simplistic quote handling

                if (!inString) {
                  if (char === '{') {
                    openBraces++;
                  } else if (char === '}') {
                    openBraces--;
                    if (openBraces === 0) {
                      endIndex = i + 1;
                      break;
                    }
                  }
                }
              }

              if (endIndex !== -1) {
                const jsonStr = text.substring(startIndex, endIndex);
                try {
                  const parsed = JSON.parse(jsonStr); // Strict JSON header check
                  return { data: parsed, raw: jsonStr };
                } catch (e) {
                  console.warn("[MEDIA GEN] JSON parse failed, attempting manual field extraction...");
                  // Handle malformed JSON from AI (e.g. missing quotes)
                  const actionMatch = jsonStr.match(/["']action["']\s*:\s*["'](generate_video|generate_image|modify_image|generate_audio)["']/);
                  const promptMatch = jsonStr.match(/["']prompt["']\s*:\s*["']([\s\S]*?)(?=["']\s*,\s*["']|["']\s*\}|$)/) || jsonStr.match(/["']prompt["']\s*:\s*([\s\S]*?)(?=\s*,\s*["']|\s*\}|$)/);

                  if (actionMatch && promptMatch) {
                    const action = actionMatch[1];
                    let prompt = promptMatch[1].trim();
                    // Clean up trailing quotes if present
                    if (prompt.endsWith('"') || prompt.endsWith("'")) prompt = prompt.slice(0, -1);

                    return {
                      data: { action, prompt, duration: 30 },
                      raw: jsonStr
                    };
                  }
                }
              }
            }
          }

          // 2. Fallback: classic greedy Regex (works for 99% of simple cases)
          // Matches { ... "action": "generate_video" ... }
          const simpleRegex = /\{[\s\S]*?["']action["']\s*:\s*["'](generate_video|generate_image|modify_image|generate_audio)["'][\s\S]*?\}/;
          const simpleMatch = text.match(simpleRegex);
          if (simpleMatch) {
            try {
              return { data: JSON.parse(simpleMatch[0]), raw: simpleMatch[0] };
            } catch (e) {
              console.error("[MEDIA GEN] Fallback regex matched but parse failed:", e.message);
            }
          }

          // 3. Fallback for Array format [ { ... } ]
          const arrayRegex = /\[\s*\{[\s\S]*?["']action["']\s*:\s*["'](generate_video|generate_image|modify_image|generate_audio)["'][\s\S]*?\}\s*\]/;
          const arrayMatch = text.match(arrayRegex);
          if (arrayMatch) {
            try {
              const arr = JSON.parse(arrayMatch[0]);
              if (Array.isArray(arr) && arr[0]) {
                return { data: arr[0], raw: arrayMatch[0] };
              }
            } catch (e) {
              console.error("[MEDIA GEN] Array regex matched but parse failed:", e.message);
            }
          }

          return null;
        };

        const extracted = extractActionJson(reply);

        if (extracted) {
          const { data, raw } = extracted;
          console.log(`[MEDIA GEN] Found trigger JSON: ${raw}`);

          // REMOVE processed JSON from the reply text immediately
          // Also handle markdown code block wrappers if they exist
          const markdownWrapperRegex = new RegExp(`\`\`\`(?:json|text|plain)?\\s*${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\`\`\``, 'g');
          if (markdownWrapperRegex.test(reply)) {
            reply = reply.replace(markdownWrapperRegex, '').trim();
          } else {
            reply = reply.replace(raw, '').trim();
          }

          if (data.action === 'generate_video' && data.prompt) {
            console.log(`[VIDEO GEN] Calling generator for: ${data.prompt}`);
            const videoUrl = await generateVideoFromPrompt(data.prompt, 5, 'medium');
            if (videoUrl) {
              finalResponse.videoUrl = videoUrl;
              finalResponse.reply = (reply && reply.trim()) ? reply : `Sure, I've generated a video based on your request: "${data.prompt.substring(0, 50)}..."`;
            } else {
              finalResponse.reply = (reply && reply.trim()) ? reply : "I attempted to generate a video but encountered an error.";
            }
          }
          else if (data.action === 'generate_image' && data.prompt) {
            console.log(`[IMAGE GEN] Calling generator for: ${data.prompt}`);
            // Use a shorter version of prompt for Fallback just in case
            const safePrompt = data.prompt.length > 400 ? data.prompt.substring(0, 400) : data.prompt;

            try {
              const imageUrl = await generateImageFromPrompt(data.prompt);
              if (imageUrl) {
                finalResponse.imageUrl = imageUrl;
                finalResponse.reply = (reply && reply.trim()) ? reply : "Here is the image you requested.";
              }
            } catch (imgError) {
              console.error(`[IMAGE GEN] Vertex AI failed:`, imgError.message);
              // Return error message to user instead of using Pollinations
              finalResponse.reply = `I encountered an error generating the image: ${imgError.message}. Please check your Vertex AI configuration or try again.`;
            }
          }
          else if (data.action === 'modify_image' && data.prompt) {
            console.log(`[IMAGE EDIT] Calling modifier for: ${data.prompt}`);
            // Extract base64 image: Current message first, then History search
            let firstImgObj = (Array.isArray(image) ? image[0] : image) || allAttachments.find(a => a.mimeType?.startsWith('image/') || a.type === 'image');

            // If not in current message, search history (start from most recent)
            if (!firstImgObj && history && Array.isArray(history)) {
              console.log("[IMAGE EDIT] Searching history for source image...");
              for (let i = history.length - 1; i >= 0; i--) {
                const msg = history[i];
                if (msg.attachments && Array.isArray(msg.attachments)) {
                  const img = msg.attachments.find(a => a.type === 'image' || a.mimeType?.startsWith('image/'));
                  if (img) {
                    firstImgObj = img;
                    console.log(`[IMAGE EDIT] Found source image in history: ${img.name || 'unnamed'}`);
                    break;
                  }
                }
              }
            }

            const base64Img = firstImgObj?.base64Data || (typeof firstImgObj === 'string' ? firstImgObj : null);

            if (base64Img) {
              try {
                const imageUrl = await modifyImageFromPrompt(data.prompt, base64Img);
                if (imageUrl) {
                  finalResponse.imageUrl = imageUrl;
                  // Narrative from Vertex AI
                  try {
                    const narrModel = genAIInstance.getGenerativeModel({ model: primaryModelName, systemInstruction: finalSystemInstruction });
                    const narrRes = await narrModel.generateContent({
                      contents: [{ role: 'user', parts: [{ text: `I have successfully modified the image as requested: "${data.prompt}". Confirm to the user that changes are applied.` }] }]
                    });
                    reply = extractText(narrRes.response);
                    finalResponse.reply = reply;
                  } catch (err) {
                    finalResponse.reply = (reply && reply.trim()) ? reply : "I've successfully modified the image based on your request!";
                  }
                }
              } catch (editError) {
                console.error(`[IMAGE EDIT] Vertex AI failed:`, editError.stack || editError.message);
                finalResponse.reply = `I encountered an error while editing the image: ${editError.message}. Please try again later.`;
              }
            } else {
              console.warn("[IMAGE EDIT] Attempted but NO base64 image found in attachments.");
              finalResponse.reply = "I understand you want to edit an image, but I couldn't find the source image in your message. Please upload an image and tell me what to change.";
            }
          }
          else if (data.action === 'generate_audio' && data.prompt) {
            console.log(`[AUDIO GEN] Triggered for music: ${data.prompt}`);
            try {
              const audioUrl = await generateMusicFromPrompt(data.prompt, 30);
              if (audioUrl) {
                finalResponse.audioUrl = audioUrl;
                console.log(`[AUDIO GEN] Success! Audio URL: ${audioUrl}`);
                finalResponse.reply = (reply && reply.trim()) ? reply : `I've generated some high-fidelity music based on your request using Google's Lyria model. 🎵\n\n**Music Style**: ${data.prompt.substring(0, 100)}...`;
              } else {
                finalResponse.reply = "I attempted to generate music but couldn't get the audio data. Please try a different prompt.";
              }
            } catch (musicError) {
              console.error(`[AUDIO GEN] Lyria failed:`, musicError.message);
              finalResponse.reply = `I encountered an error while generating music: ${musicError.message}. This model may still be in limited preview in your region.`;
            }
          }
        }

        // 2. Check for Markdown Image triggers (Support frontend instructions)
        if (!finalResponse.imageUrl) {
          const mdImageRegex = /!\[Image\]\((https:\/\/image\.pollinations\.ai\/prompt\/([^?)]+)[^)]*)\)/;
          const mdMatch = reply.match(mdImageRegex);
          if (mdMatch) {
            console.log("[MEDIA GEN] Found Pollinations markdown trigger.");
            finalResponse.imageUrl = mdMatch[1];
            // Remove the markdown tag from text to avoid double display
            reply = reply.replace(mdMatch[0], '').trim();
            finalResponse.reply = (reply && reply.trim()) ? reply : "Here is the image you requested.";
          }
        }

        // Final cleanup: Remove backticks and language tags if the model output the JSON inside a code block
        reply = reply.replace(/```json\s*|```text\s*|```plain\s*|```\s*/g, '').replace(/```/g, '').trim();
        // Ensure finalResponse.reply has a value if we didn't hit the blocks above
        if (!finalResponse.reply && !finalResponse.imageUrl && !finalResponse.videoUrl) {
          finalResponse.reply = reply || "Processed your request.";
        } else if (!finalResponse.reply) {
          finalResponse.reply = reply; // Sync back just in case
        }
      }
    } catch (e) {
      console.warn("[MEDIA GEN] Critical failure in media handling logic:", e);
    }

    if (voiceConfirmation) {
      finalResponse.voiceConfirmation = voiceConfirmation;
    }

    if (conversionResult) {
      if (conversionResult.success) {
        finalResponse.conversion = {
          file: conversionResult.file,
          fileName: conversionResult.fileName,
          mimeType: conversionResult.mimeType
        };
        finalResponse.reply = conversionResult.message || reply;
      } else {
        finalResponse.reply = `Conversion failed: ${conversionResult.error}`;
      }
    }

    return res.status(200).json(finalResponse);
  } catch (err) {
    if (mongoose.connection.readyState !== 1) {
      console.warn('[DB] MongoDB unreachable during generation. Returning translation key.');
      return res.status(200).json({ reply: "dbDemoModeMessage", detectedMode: 'NORMAL_CHAT' });
    }
    const fs = await import('fs');
    try {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const logData = `
Timestamp: ${new Date().toISOString()}
Error: ${err.message}
Code: ${err.code}
Env Project: ${process.env.GCP_PROJECT_ID}
Env Creds Path: '${credPath}'
Creds File Exists: ${credPath ? fs.existsSync(credPath) : 'N/A'}
Stack: ${err.stack}
-------------------------------------------
`;
      fs.appendFileSync('error.log', logData);
    } catch (e) { console.error("Log error:", e); }

    console.error("AISA backend error details:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      details: err.details || err.response?.data
    });
    const statusCode = err.status || 500;

    // Feature Request: Explain the prompt instead of raw error for Image/Video intent
    if (detectedMode === 'IMAGE_GEN' || detectedMode === 'VIDEO_GEN') {
      const type = detectedMode === 'IMAGE_GEN' ? 'image' : 'video';
      return res.status(200).json({
        success: true,
        reply: `I understand you want to generate a ${type}. I'm currently having a brief technical difficulty with my direct chat model, but you can use the **${type === 'image' ? 'Generate Image' : 'Generate Video'}** tool from the **Magic Tools (plus icon)** menu for a much faster and more reliable experience!`,
        detectedMode
      });
    }

    // Improved error reporting for UI
    const errorDetails = err.message || "Unknown AI error";
    const userFriendlyMessage = `System Message: AI failed to respond - ${errorDetails}. Please try again later or check your network.`;

    return res.status(200).json({
      success: true,
      reply: userFriendlyMessage,
      error: "AI failed to respond",
      details: errorDetails
    });
  }
});
// Get all chat sessions (summary) for the authenticated user or guest
router.get('/', optionalVerifyToken, identifyGuest, async (req, res) => {
  try {
    const userId = req.user?.id;
    const guestId = req.guest?.guestId;

    if (!userId && !guestId) {
      return res.json([]);
    }

    // Check DB connection
    if (mongoose.connection.readyState !== 1) {
      console.warn('[DB] MongoDB unreachable. Returning empty sessions.');
      return res.json([]);
    }

    let sessions = [];
    const { agentType } = req.query;

    const query = {};
    if (agentType) {
      query.agentType = agentType;
    }

    if (userId) {
      query.userId = userId;
      sessions = await Conversation.find(query)
        .select('sessionId title lastModified userId agentType')
        .sort({ lastModified: -1 });
    } else if (guestId) {
      query.guestId = guestId;
      sessions = await Conversation.find(query)
        .select('sessionId title lastModified guestId agentType')
        .sort({ lastModified: -1 });
    }

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get chat history for a specific session
router.get('/:sessionId', optionalVerifyToken, identifyGuest, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;
    const guestId = req.guest?.guestId;

    // Check DB connection
    if (mongoose.connection.readyState !== 1) {
      console.warn('[DB] MongoDB unreachable. Returning empty history.');
      return res.json({ sessionId, messages: [] });
    }

    // Verify that the session belongs to this user or guest
    let session = await Conversation.findOne({ sessionId });

    if (!session) {
      console.warn(`[CHAT] Session ${sessionId} not found in DB.`);
      return res.status(404).json({ message: 'Session not found' });
    }

    // Ownership check
    if (userId) {
      if (session.userId && session.userId.toString() !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      // If session is unowned, try to link it to the logged-in user
      if (!session.userId) {
        const currentGuestId = req.cookies.guest_id;
        const fingerprint = req.headers['x-device-fingerprint'];

        let canLink = (session.guestId === currentGuestId);

        if (!canLink && fingerprint && req.guest) {
          if (req.guest.fingerprint === fingerprint && req.guest.guestId === session.guestId) {
            canLink = true;
          }
        }

        // Emergency fallback: If it's a guest session and user is accessing it right after login
        // we can be slightly more lenient if needed, but fingerprint/cookie covers most cases.

        if (canLink || !session.guestId) { // !session.guestId handles legacy/edge cases
          session.userId = userId;
          await session.save();
          await userModel.findByIdAndUpdate(userId, { $addToSet: { Conversations: session._id } });
          console.log(`[CHAT] Linked guest session ${sessionId} to user ${userId}`);
        }
      }
    } else if (guestId) {
      if (session.guestId !== guestId) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`[CHAT] Found session ${sessionId} with ${session.messages?.length || 0} messages.`);

    // Log conversion data for debugging
    const messagesWithConversion = session.messages?.filter(m => m.conversion?.file) || [];
    if (messagesWithConversion.length > 0) {
      console.log(`[CHAT] Session has ${messagesWithConversion.length} messages with conversion data`);
      messagesWithConversion.forEach(msg => {
        console.log(`  - Message ${msg.id}: ${msg.conversion.fileName} (${msg.conversion.fileSize})`);
      });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Create or Update message in session
router.post('/:sessionId/message', optionalVerifyToken, identifyGuest, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, title } = req.body;
    const userId = req.user?.id;
    const guest = req.guest;

    if (!message?.role || !message?.content) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Enforce limits for guests
    const limitCheck = await checkGuestLimits(req, sessionId);
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: "LIMIT_REACHED", reason: limitCheck.reason });
    }

    // Cloudinary Upload Logic for Multiple Attachments
    if (message.attachments && Array.isArray(message.attachments)) {
      for (const attachment of message.attachments) {
        if (attachment.url && attachment.url.startsWith('data:')) {
          try {
            const matches = attachment.url.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
              const mimeType = matches[1];
              const base64Data = matches[2];
              const buffer = Buffer.from(base64Data, 'base64');

              // Upload to Cloudinary
              const uploadResult = await uploadToCloudinary(buffer, {
                resource_type: 'auto',
                folder: 'chat_attachments',
                public_id: `chat_${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              });

              // Update attachment with Cloudinary URL
              attachment.url = uploadResult.secure_url;
            }
          } catch (uploadError) {
            console.error("Cloudinary upload failed for attachment:", uploadError);
          }
        }
      }
    }

    // Check DB connection
    if (mongoose.connection.readyState !== 1) {
      console.warn('[DB] MongoDB unreachable. Skipping message save.');
      return res.json({ sessionId, messages: [message], dummy: true });
    }

    // Ownership check before saving
    let existingSession = await Conversation.findOne({ sessionId });
    if (existingSession) {
      if (userId) {
        if (existingSession.userId && existingSession.userId.toString() !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
        if (!existingSession.userId && existingSession.guestId) {
          const currentGuestId = req.cookies.guest_id;
          const fingerprint = req.headers['x-device-fingerprint'];
          let canLink = (existingSession.guestId === currentGuestId);
          if (!canLink && fingerprint && req.guest) {
            if (req.guest.fingerprint === fingerprint && req.guest.guestId === existingSession.guestId) {
              canLink = true;
            }
          }
          if (!canLink) return res.status(403).json({ error: "Access denied" });
        }
      } else if (guest) {
        if (existingSession.guestId && existingSession.guestId !== guest.guestId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
    }

    const updateData = {
      $push: { messages: message },
      $set: {
        lastMessageAt: Date.now(),
        ...(title && { title }),
        agentType: message.agentName || message.agentType || 'AISA'
      }
    };

    if (userId) {
      updateData.$set.userId = userId;
    } else if (guest) {
      updateData.$set.guestId = guest.guestId;
    }

    const session = await Conversation.findOneAndUpdate(
      { sessionId },
      updateData,
      { new: true, upsert: true }
    );

    // Update guest's sessionIds tracker if guest session
    if (guest && !guest.sessionIds.includes(sessionId)) {
      guest.sessionIds.push(sessionId);
      await guest.save();
    }

    // If logged in, associate with user profile
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      await userModel.findByIdAndUpdate(
        userId,
        { $addToSet: { Conversations: session._id } },
        { new: true }
      );
      console.log(`[CHAT] Associated session ${session._id} with user ${userId}.`);
    }

    res.json(session);
  } catch (err) {
    console.error('[POST MESSAGE ERROR]:', err.message);
    console.error('[POST MESSAGE ERROR] Stack:', err.stack);
    console.error('[POST MESSAGE ERROR] SessionId:', req.params.sessionId);
    console.error('[POST MESSAGE ERROR] Message role:', req.body.message?.role);
    res.status(500).json({ error: 'Failed to save message', details: err.message });
  }
});


// Delete individual message from session
router.delete('/:sessionId/message/:messageId', verifyToken, async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    const userId = req.user.id;

    // Optional: Also delete the subsequent model response if it exists
    // (Logic moved from frontend to backend for consistency)
    const session = await Conversation.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const msgIndex = session.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return res.status(404).json({ error: 'Message not found' });

    const msgsToDelete = [messageId];
    if (msgIndex + 1 < session.messages.length) {
      const nextMsg = session.messages[msgIndex + 1];
      if (nextMsg && nextMsg.role === 'model' && nextMsg.id) {
        msgsToDelete.push(nextMsg.id);
      }
    }

    // Filter out any undefined/null IDs just in case
    const validMsgsToDelete = msgsToDelete.filter(id => id);

    console.log(`[DELETE] Session: ${sessionId}, Removing IDs:`, validMsgsToDelete);

    if (validMsgsToDelete.length > 0) {
      await Conversation.findOneAndUpdate(
        { sessionId },
        { $pull: { messages: { id: { $in: validMsgsToDelete } } } }
      );
    }

    res.json({ success: true, removedCount: validMsgsToDelete.length });
  } catch (err) {
    console.error(`[DELETE ERROR] Session: ${req.params.sessionId}, Msg: ${req.params.messageId}`, err);
    res.status(500).json({
      error: 'Failed to delete message',
      details: err.message
    });
  }

});

// Update a specific message in a session (e.g. after async processing)
router.patch('/:sessionId/message/:messageId', optionalVerifyToken, identifyGuest, async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    const { content, isProcessing, conversion } = req.body;
    const userId = req.user?.id;
    const guest = req.guest;

    // Check session existence
    const session = await Conversation.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Verify ownership
    if (session.userId) {
      if (!userId || session.userId.toString() !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (session.guestId) {
      const currentGuestId = req.cookies.guest_id;
      if (guest && guest.guestId === session.guestId) {
        // OK
      } else if (currentGuestId === session.guestId) {
        // OK
      } else {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Prepare update
    const updateFields = {};
    if (content !== undefined) updateFields['messages.$.content'] = content;
    if (isProcessing !== undefined) updateFields['messages.$.isProcessing'] = isProcessing;
    if (conversion !== undefined) {
      updateFields['messages.$.conversion'] = conversion;
      console.log(`[UPDATE MSG] Saving conversion data for message ${messageId}:`, {
        fileName: conversion.fileName,
        mimeType: conversion.mimeType,
        fileSize: conversion.fileSize,
        hasFile: !!conversion.file,
        fileLength: conversion.file?.length || 0
      });
    }

    if (Object.keys(updateFields).length === 0) return res.json(session);

    console.log(`[UPDATE MSG] Updating message ${messageId} in session ${sessionId} with fields:`, Object.keys(updateFields));

    const updatedSession = await Conversation.findOneAndUpdate(
      { sessionId, "messages.id": messageId },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedSession) {
      console.error(`[UPDATE MSG ERROR] Message ${messageId} not found in session ${sessionId}`);
      return res.status(404).json({ error: "Message or Session not found for update" });
    }

    // Verify the update was successful
    const updatedMsg = updatedSession.messages.find(m => m.id === messageId);
    if (updatedMsg && conversion) {
      console.log(`[UPDATE MSG SUCCESS] Conversion saved. Has file:`, !!updatedMsg.conversion?.file);
    }

    res.json(updatedSession);

  } catch (err) {
    console.error(`[CHAT ERROR] ${err.message}`);
    const statusCode = err.status || 200; // Return 200 with error message for better UI handling

    // Improved error reporting for UI
    const errorDetails = err.message || "Unknown AI error";
    const userFriendlyMessage = `System Message: AI failed to respond - ${errorDetails}. Please try again later or check your network.`;

    res.status(statusCode).json({
      success: true,
      reply: userFriendlyMessage,
      error: "AI failed to respond",
      details: errorDetails
    });
  }
});

// Update chat session title
router.patch('/:sessionId/title', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    if (mongoose.connection.readyState !== 1) {
      console.warn('[DB] MongoDB unreachable during rename.');
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // Update session: search by sessionId AND (either matching userId or no userId yet)
    const session = await Conversation.findOneAndUpdate(
      {
        sessionId,
        $or: [{ userId: userId }, { userId: { $exists: false } }, { userId: null }]
      },
      { $set: { title, lastModified: Date.now(), userId: userId } },
      { new: true }
    );

    if (!session) {
      console.warn(`[CHAT] Rename failed: Session ${sessionId} not found or not owned by ${userId}`);
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    console.log(`[CHAT] Successfully renamed session ${sessionId} to "${title}" for user ${userId}`);
    res.json(session);
  } catch (err) {
    console.error(`[CHAT RENAME ERROR] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    if (mongoose.connection.readyState !== 1) {
      return res.json({ message: 'History cleared (Mock)' });
    }

    const session = await Conversation.findOneAndDelete({
      sessionId,
      $or: [{ userId: userId }, { userId: { $exists: false } }, { userId: null }]
    });
    if (session) {
      await userModel.findByIdAndUpdate(userId, { $pull: { Conversations: session._id } });
    }
    res.json({ message: 'History cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import mongoose from "mongoose";
import express from "express"
import ChatSession from "../models/ChatSession.js"
import { generativeModel } from "../config/vertex.js";
import userModel from "../models/User.js";


const router = express.Router();
// Get all chat sessions (summary)
router.post("/", async (req, res) => {
  const { content } = req.body;

  try {
    const request = {
      contents: [{ role: "user", parts: [{ text: content }] }],
    };


    const streamingResult = await generativeModel.generateContentStream(request);


    for await (const chunk of streamingResult.stream) {
      const text =
        chunk?.candidates?.[0]?.content?.parts?.[0]?.text || null;

      if (text) {
        console.log("stream text:", text);
      }
    }


    const finalResponse = await streamingResult.response;


    const reply =
      finalResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("AISA backend error:", err);
    return res.status(500).json({ error: "AI failed to respond" });
  }
});

// Create or Update message in session
router.post('/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, title, userId } = req.body;

    if (!message?.role || !message?.content) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const session = await ChatSession.findOneAndUpdate(
      { sessionId },
      {
        $push: { messages: message },
        $set: { lastModified: Date.now(), ...(title && { title }) }
      },
      { new: true, upsert: true }
    );

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { chatSessions: session._id } },
      { new: true }
    );
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});


router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await ChatSession.findOneAndDelete({ sessionId });
    res.json({ message: 'History cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

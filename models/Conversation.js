import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    id: String,
    role: {
        type: String,
        enum: ['user', 'model', 'assistant'], // Supporting both naming conventions
        required: true
    },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    agentName: String,
    agentCategory: String,
    agentAvatar: String,
    mode: String,
    attachments: [{
        type: { type: String },
        url: String,
        name: String
    }],
    imageUrl: String,
    videoUrl: String,
    isProcessing: { type: Boolean, default: false },
    conversion: {
        file: String,
        fileName: String,
        mimeType: String,
        fileSize: String,
        charCount: Number
    }
});

const conversationSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    title: { type: String, default: 'New Chat' },
    messages: [messageSchema],
    lastMessageAt: { type: Date, default: Date.now },
    lastModified: { type: Date, default: Date.now },
    detectedMode: { type: String, default: 'NORMAL_CHAT' },
    agentType: { type: String, default: 'AISA' } // Default agent for this session
}, { timestamps: true });

export default mongoose.model('Conversation', conversationSchema, 'conversations');

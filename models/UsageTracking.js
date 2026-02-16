import mongoose from 'mongoose';

const usageTrackingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent'
    },
    tokensUsed: {
        type: Number,
        default: 0
    },
    messagesSent: {
        type: Number,
        default: 0
    },
    featuresUsed: [{
        name: String,
        timestamp: { type: Date, default: Date.now }
    }],
    lastUsed: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for quick lookups by user/agent per day/month if needed later
usageTrackingSchema.index({ userId: 1, agentId: 1 });

export default mongoose.model('UsageTracking', usageTrackingSchema, 'usage_tracking');


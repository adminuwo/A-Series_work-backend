import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent'
    },
    planType: {
        type: String,
        enum: ['Basic', 'Pro', 'King', 'AgentFree', 'AgentPremium'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'canceled', 'expired'],
        default: 'active'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    paymentDetails: {
        orderId: String,
        paymentId: String,
        signature: String,
        amount: Number,
        currency: { type: String, default: 'INR' }
    }
}, { timestamps: true });

export default mongoose.model('Subscription', subscriptionSchema, 'subscriptions');

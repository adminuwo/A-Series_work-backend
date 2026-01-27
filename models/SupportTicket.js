import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'Guest'
    },
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
    },
    subject: {
        type: String,
    },
    issueType: {
        type: String,
        required: true,
        enum: ["General Inquiry", "Payment Issue", "Refund Request", "Technical Support", "Account Access", "Other", "Bug Report", "Feedback", "Partnership"],
    },
    message: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    source: {
        type: String, // 'contact_us' or 'help_faq'
        default: 'contact_us'
    }
}, { timestamps: true });

// Add index for search fields
supportTicketSchema.index({
    subject: 'text',
    message: 'text',
    name: 'text',
    email: 'text',
    issueType: 'text'
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
export default SupportTicket;

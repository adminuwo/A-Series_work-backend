import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true
    },
    user: {
        type: String,
        required: true
    },
    target: {
        type: String,
        default: 'System'
    },
    details: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for search
auditLogSchema.index({ action: 'text', user: 'text', target: 'text' });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;

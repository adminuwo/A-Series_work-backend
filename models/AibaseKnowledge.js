import mongoose from 'mongoose';

const AibaseKnowledgeSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    userId: {
        type: String,
        default: 'admin'
    },
    embedding: {
        type: [Number],
        required: false // Optional for now, to support legacy docs
    }
}, { timestamps: true, collection: 'knowledge_vectors' });

export default mongoose.model('AibaseKnowledge', AibaseKnowledgeSchema);

import mongoose from 'mongoose';

const PersonalTaskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        required: true,
        default: 'Personal'
    },
    datetime: {
        type: Date,
        required: true
    },
    recurring: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default: 'none'
    },
    isUrgent: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    }
}, { timestamps: true });

const PersonalTask = mongoose.model('PersonalTask', PersonalTaskSchema);
export default PersonalTask;

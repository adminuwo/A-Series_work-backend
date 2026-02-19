import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Agent from './models/Agents.js';

dotenv.config();

const updates = [
    {
        slug: "tool-image-gen",
        bgGradient: "bg-gradient-to-br from-blue-500 to-indigo-600"
    },
    {
        slug: "tool-deep-search",
        bgGradient: "bg-gradient-to-br from-sky-400 to-blue-500"
    },
    {
        slug: "tool-video-gen",
        bgGradient: "bg-gradient-to-br from-violet-500 to-purple-700"
    },
    {
        slug: "tool-code-writer",
        bgGradient: "bg-gradient-to-br from-slate-700 to-slate-900"
    }
];

const fixGradients = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        for (const update of updates) {
            await Agent.findOneAndUpdate({ slug: update.slug }, { bgGradient: update.bgGradient });
            console.log(`+ Fixed Gradient: ${update.slug}`);
        }

        console.log('Gradients fixed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixGradients();

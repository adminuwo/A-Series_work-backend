import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Agent from './models/Agents.js';

dotenv.config();

const checkCodeWriter = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI);
        const agent = await Agent.findOne({ slug: 'tool-code-writer' });
        console.log('CODE_WRITER_DESC:', agent?.description);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkCodeWriter();

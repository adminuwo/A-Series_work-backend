import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Agent from './models/Agents.js';

dotenv.config();

const listAgents = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const agents = await Agent.find({}, 'agentName slug');
        console.log('Current Agents in Marketplace:');
        agents.forEach(agent => {
            console.log(`- ${agent.agentName} (slug: ${agent.slug})`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

listAgents();

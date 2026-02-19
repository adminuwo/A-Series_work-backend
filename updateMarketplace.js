import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Agent from './models/Agents.js';

dotenv.config();

const updates = [
    {
        slug: "tool-image-gen",
        agentName: "Image Generation",
        description: "Use text prompt to generate novel Images",
        category: "Design & Creative",
        status: "Live"
    },
    {
        slug: "tool-video-gen",
        agentName: "Video Generator",
        description: "Use text prompt to generate novel video with audio",
        category: "Design & Creative",
        status: "Live"
    },
    {
        slug: "tool-code-writer",
        agentName: "AI Coding",
        description: "Most powerful model yet and the state of the art coding model",
        category: "Data & Intelligence",
        status: "Live"
    }
];

const updateExisting = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        for (const update of updates) {
            const agent = await Agent.findOne({ slug: update.slug });
            if (agent) {
                agent.agentName = update.agentName;
                agent.description = update.description;
                agent.category = update.category;
                agent.status = update.status;
                await agent.save();
                console.log(`+ Updated: ${update.agentName}`);
            } else {
                // If not found by slug, create it
                await Agent.create({
                    ...update,
                    reviewStatus: "Approved",
                    visibility: "public",
                    pricing: { type: "Free", plans: [] },
                    pricingModel: "Free"
                });
                console.log(`+ Created: ${update.agentName}`);
            }
        }

        console.log('Update completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error updating agents:', error);
        process.exit(1);
    }
};

updateExisting();

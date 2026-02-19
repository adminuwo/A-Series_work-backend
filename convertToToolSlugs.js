import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Agent from './models/Agents.js';

dotenv.config();

const agentsToUpdate = [
    "Image Editing & Customization",
    "Fast Video Generator",
    "Lyria (For Music)",
    "AI Document",
    "AI Blur",
    "AI Detector",
    "Claude Sonnet 4.5",
    "BLIP2",
    "NVIDIA Nemotron Nano 12B",
    "Path Foundation",
    "Derm Foundation"
];

const convertToToolSlugs = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        for (const name of agentsToUpdate) {
            const oldSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const newSlug = `tool-${oldSlug}`;

            const agent = await Agent.findOne({ slug: oldSlug });
            if (agent) {
                // Check if new slug already exists (unlikely)
                const exists = await Agent.findOne({ slug: newSlug });
                if (!exists) {
                    agent.slug = newSlug;
                    await agent.save();
                    console.log(`+ Converted to Tool: ${name} (${newSlug})`);
                } else {
                    console.log(`- Slug collision: ${newSlug}`);
                }
            } else {
                console.log(`? Not found: ${name} with slug ${oldSlug}`);
            }
        }

        console.log('Tool conversion completed');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

convertToToolSlugs();

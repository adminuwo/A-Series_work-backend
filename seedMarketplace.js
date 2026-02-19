import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Agent from './models/Agents.js';

dotenv.config();

const newAgents = [
    {
        agentName: "Image Editing & Customization",
        description: "Use text prompts to edit existing input images, or parts of an image with a mask or generate new images based upon the context.",
        category: "Design & Creative",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-pink-500 to-rose-600",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "Fast Video Generator",
        description: "Use text prompt + image to generate novel video with audio rapidly.",
        category: "Design & Creative",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-indigo-500 to-purple-600",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "Lyria (For Music)",
        description: "Google's Lyria model for high-fidelity music generation and transformation.",
        category: "Design & Creative",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-cyan-500 to-blue-600",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "AI Document",
        description: "AI doc. Can identify and extract text from 200 printed languages and 50 hand written images.",
        category: "Business OS",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-amber-500 to-orange-600",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "AI Blur",
        description: "Mask and Blur a person's appearance in video automatically for privacy and cinematic effects.",
        category: "Design & Creative",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-gray-600 to-gray-800",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "AI Detector",
        description: "Identify people, equipment, and objects in video streams or recordings with high accuracy.",
        category: "Data & Intelligence",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "Claude Sonnet 4.5",
        description: "Anthropic's industry leading model for high-volume uses, in-depth research, coding, and more.",
        category: "Data & Intelligence",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-orange-500 to-red-600",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "BLIP2",
        description: "Vision-language model for image questioning and answering complex visual queries with text.",
        category: "Data & Intelligence",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-blue-400 to-indigo-500",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "NVIDIA Nemotron Nano 12B",
        description: "NVIDIA's highly efficient 12 billion parameter model optimized for speed and accuracy.",
        category: "Data & Intelligence",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-green-500 to-green-700",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "Path Foundation",
        description: "AI model used to produce trained models specifically for pathology research and diagnostics.",
        category: "Medical & Health AI",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-red-400 to-pink-500",
        avatar: "/AGENTS_IMG/default.png"
    },
    {
        agentName: "Derm Foundation",
        description: "Specialized model for dermatological analysis and skin condition identification.",
        category: "Medical & Health AI",
        status: "Live",
        bgGradient: "bg-gradient-to-br from-yellow-400 to-amber-500",
        avatar: "/AGENTS_IMG/default.png"
    }
];

const seedAgents = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        for (const agentData of newAgents) {
            const slug = agentData.agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const existing = await Agent.findOne({ slug });

            if (!existing) {
                await Agent.create({
                    ...agentData,
                    slug,
                    pricing: { type: "Free", plans: [] },
                    pricingModel: "Free",
                    reviewStatus: "Approved",
                    visibility: "public"
                });
                console.log(`+ Added: ${agentData.agentName}`);
            } else {
                console.log(`- Skipping (Already Exists): ${agentData.agentName}`);
            }
        }

        console.log('Seed completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding agents:', error);
        process.exit(1);
    }
};

seedAgents();

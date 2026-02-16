import express from 'express'
import agentModel from '../models/Agents.js'
import userModel from "../models/User.js"
// import notificationModel from "../models/Notification.js"
import subscriptionModel from "../models/Subscription.js"
import { verifyToken } from '../middleware/authorization.js'
const route = express.Router()

//get all agents
route.get("/", async (req, res) => {
  // Filter out Inactive/Draft agents from the public list
  const agents = await agentModel.find({ status: { $nin: ['Inactive', 'inactive', 'Draft'] } })
  res.status(200).json(agents)
})

// Test endpoint to check if user exists
route.get("/test-user/:userId", async (req, res) => {
  try {
    const user = await userModel.findById(req.params.userId);
    if (user) {
      res.json({ exists: true, email: user.email, agentCount: user.agents?.length || 0 });
    } else {
      res.json({ exists: false, message: "User not found" });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
})

//create agents
route.post('/', verifyToken, async (req, res) => {
  try {
    const { agentName, description, category, avatar, url, agentUrl, pricing, pricingModel } = req.body;

    const finalUrl = url || agentUrl || "";

    console.log('[AGENT CREATE] Request data:', { agentName, category, avatar, finalUrl, pricingModel });

    // Generate slug manually
    let slug = agentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug exists to avoid collision error
    const existingAgent = await agentModel.findOne({ slug });
    if (existingAgent) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    }

    console.log('[AGENT CREATE] Generated slug:', slug);

    // Flexible pricing handling
    let finalPricing = pricing;
    if (typeof pricing === 'string') {
      finalPricing = { type: pricing, plans: [] };
    } else if (!pricing) {
      finalPricing = { type: pricingModel || 'Free', plans: [] };
    }

    const newAgent = await agentModel.create({
      agentName,
      description,
      category,
      avatar: avatar || "/AGENTS_IMG/default.png",
      url: finalUrl,
      slug,
      pricing: finalPricing,
      pricingModel: pricingModel || (typeof pricing === 'string' ? pricing : 'Free'),
      status: 'Inactive',     // Default to Inactive so it doesn't show in Marketplace
      reviewStatus: 'Draft',  // Default to Draft
      owner: req.user.id
    });

    // Do NOT link to user inventory automatically. 
    // Creators must explicitly subscribe if they want to use the agent in the chat interface.
    console.log('[AGENT CREATED]', newAgent.agentName, 'with slug:', newAgent.slug, 'ID:', newAgent._id);
    res.status(201).json(newAgent);
  } catch (err) {
    console.error('[AGENT CREATE ERROR]', err.message);
    console.error('[AGENT CREATE ERROR] Full error:', err);

    // Send detailed error to frontend
    const errorMessage = err.code === 11000
      ? `Agent with this name already exists (duplicate slug)`
      : err.message || 'Failed to create agent';

    res.status(400).json({ error: errorMessage, details: err.errors });
  }
});

//own agents
route.post('/buy/:id', async (req, res) => {
  try {
    const agentId = req.params.id;
    const { userId } = req.body;

    console.log("[BUY AGENT] Agent ID:", agentId);
    console.log("[BUY AGENT] User ID from body:", userId);
    console.log("[BUY AGENT] User ID type:", typeof userId);

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const user = await userModel.findById(userId);

    console.log("[BUY AGENT] User found:", user ? `Yes (${user.email})` : "No");

    if (!user) {
      console.error("[BUY AGENT] User not found in database. UserId:", userId);
      return res.status(404).json({ error: "User Not Found" });
    }

    // Avoid duplicate agent entries
    const isOwned = user.agents.some(id => id.toString() === agentId);
    if (!isOwned) {
      user.agents.push(agentId);
      console.log("[BUY AGENT] Agent added to user. Total agents:", user.agents.length);
    } else {
      console.log("[BUY AGENT] Agent already owned");
      return res.status(400).json({ error: "Agent already owned" });
    }

    await user.save();

    // Record Transaction for Revenue Tracking
    const agent = await agentModel.findById(agentId);
    if (agent && agent.owner) {
      let amount = 0;
      if (agent.pricing && typeof agent.pricing === 'object') {
        // Assuming pricing might be { type: "Free" } or { amount: 10 } or similar
        // If it's free, amount is 0.
        // If plans exist, we might need more logic, but for now safe default.
        // If generic string "Free" is in type
        if (agent.pricing.type && agent.pricing.type.toLowerCase() === 'free') {
          amount = 0;
        } else {
          // Try to find a number in type or other fields? 
          // For now, let's assume 0 unless we have a specific 'cost' field.
          // Or if pricing was a string before...
          amount = 0;
        }
      } else if (typeof agent.pricing === 'string') {
        amount = parseFloat(agent.pricing.replace(/[^0-9.]/g, '')) || 0;
      }

      const platformFee = amount * 0.5; // 50% Platform Fee
      const netAmount = amount - platformFee;

      await subscriptionModel.create({
        userId: userId,
        agentId: agent._id,
        planType: agent.pricingModel || 'AgentFree',
        status: 'active',
        paymentDetails: {
          amount: amount,
          currency: 'INR'
        }
      });
    }

    res.status(200).json({
      message: "Agent added successfully",
      user
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//get My agents
route.post("/get_my_agents", async (req, res) => {
  try {
    const { userId } = req.body
    console.log('[GET MY AGENTS] Fetching for userId:', userId);

    if (!userId) {
      console.error('[GET MY AGENTS] No userId provided in body');
      return res.status(400).send("User ID is required")
    }

    const user = await userModel.findById(userId).populate("agents")
    if (!user) {
      console.error('[GET MY AGENTS] User Not Found in DB:', userId);
      return res.status(404).send("User Not Found")
    }

    console.log(`[GET MY AGENTS] Success. User: ${user.email}, Agent count: ${user.agents?.length || 0}`);
    res.status(200).json(user)
  } catch (err) {
    console.error('[GET MY AGENTS] Error:', err);
    res.status(500).json({ error: err.message });
  }
})

// Get My Agents (Authenticated)
route.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.findById(userId).populate("agents");
    if (!user) {
      return res.status(404).json({ error: "User Not Found" });
    }
    res.status(200).json(user.agents);
  } catch (err) {
    console.error("Error fetching my agents:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Vendor-specific review workflow and creation endpoints removed.

// --- General CRUD ---

route.get('/:id', async (req, res) => {
  try {
    const agent = await agentModel.findById(req.params.id);
    res.json(agent);
  } catch (err) {
    res.status(404).json({ error: "Agent not found" });
  }
});

route.put('/:id', verifyToken, async (req, res) => {
  try {
    const agent = await agentModel.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      req.body,
      { new: true }
    );
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

route.delete('/:id', verifyToken, async (req, res) => {
  try {
    const agentId = req.params.id;

    // Check for hard delete flag?force=true
    const forceDelete = req.query.force === 'true';

    let agent;
    if (forceDelete) {
      // Hard delete: Remove from DB entirely
      agent = await agentModel.findByIdAndDelete(agentId);
      console.log(`[AGENT DELETED] ID: ${agentId}. Permanently removed from database.`);
    } else {
      // Soft delete: Mark as Inactive and reset reviewStatus to Draft
      agent = await agentModel.findByIdAndUpdate(
        agentId,
        {
          status: 'Inactive',
          reviewStatus: 'Draft'
        },
        { new: true }
      );
      console.log(`[AGENT SUSPENDED] ID: ${agentId}. Marked Inactive.`);
    }

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // CLEANUP: Remove this agent from ALL users' inventories ("My Agents")
    // This ensures no one has a "broken" or "inactive" agent in their personal list
    await userModel.updateMany(
      { agents: agentId },
      { $pull: { agents: agentId } }
    );

    res.json({ message: forceDelete ? "Agent permanently deleted" : "Agent marked as inactive", agent });
  } catch (err) {
    console.error("[AGENT DELETE ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

export default route
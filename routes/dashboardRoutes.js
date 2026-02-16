import express from "express";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Agent from "../models/Agents.js";
// import Report from "../models/Report.js";
// import SystemSetting from "../models/SystemSetting.js";
// import Notification from "../models/Notification.js";

const router = express.Router();

// Dashboard Stats
// Matched to frontend: /api/dashboard/stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const sessionCount = await Conversation.countDocuments();
    // In a real app, calculate actual token usage and active agents from DB
    res.json({
      totalChats: sessionCount,
      activeAgents: 4,
      tokensUsed: 125000 + (sessionCount * 150), // Dynamic mock calculation
      savedTime: '12h 30m'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Admin Overview Stats
// Matched to frontend: /api/admin/stats
router.get('/admin/stats', async (req, res) => {
  try {
    const [totalUsers, agents, openComplaintsCount, recentAgents, recentReports] = await Promise.all([
      User.countDocuments(),
      Agent.find().select('-avatar'), // Get all agents for inventory, excluding heavy avatar field
      0, // Report.countDocuments({ status: 'open' }),
      Agent.find().sort({ createdAt: -1 }).limit(3),
      [] // Report.find().sort({ timestamp: -1 }).limit(3)
    ]);

    console.log('[ADMIN STATS] Total agents found:', agents.length);
    console.log('[ADMIN STATS] Agent names:', agents.map(a => a.agentName));

    const activeAgentsCount = agents.length;

    // Financial calculations - Reset to 0 as requested
    const grossSales = 0;
    const platformFee = 0;
    const netEarnings = 0;

    // Format recent activity
    const recentActivity = [
      ...recentAgents.map(a => ({
        type: 'agent',
        user: 'System',
        detail: `New agent ${a.agentName} deployed`,
        time: a.createdAt
      })),
      ...recentReports.map(r => ({
        type: 'report',
        user: r.userId || 'Anonymous',
        detail: `New ${r.type} issue: ${r.description.substring(0, 30)}...`,
        time: r.timestamp
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

    const inventory = agents.map(a => ({
      id: a._id,
      name: a.agentName,
      agentName: a.agentName, // Ensure compatibility
      pricing: a.pricing?.type || 'Free',
      status: a.status || 'Inactive',
      reviewStatus: a.reviewStatus || 'Draft',
      description: a.description,
      url: a.url,
      // avatar: a.avatar, // Exclude heavy Base64 data from list view
      category: a.category,
      pricingModel: a.pricingModel,
      rejectionReason: a.rejectionReason,
      // Use usageCount as a proxy for active users since ChatSession doesn't link back easily yet
      activeUsers: a.usageCount || 0,
      subscribers: 0 // Placeholder until subscription logic is fully linked
    }));

    console.log('[ADMIN STATS] Inventory count:', inventory.length);

    res.json({
      totalUsers: totalUsers,
      activeAgents: activeAgentsCount,
      pendingApprovals: 0,
      totalRevenue: 0,
      openComplaints: openComplaintsCount,
      recentActivity,
      financials: {
        grossSales: 0,
        platformFee: 0,
        netEarnings: 0,
        status: 'N/A',
        nextPayout: 'Pending Sales'
      },
      inventory
    });
  } catch (err) {
    console.error('[ADMIN STATS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Automations (Mock Data stored in memory for demo)
let automations = [
  { id: '1', name: 'Daily Diary', description: 'Summarize unread emails at 9 AM', active: true, type: 'Email' },
  { id: '2', name: 'Lead Qualifier', description: 'Score incoming leads from CRM', active: false, type: 'CRM' },
  { id: '3', name: 'Code Reviewer', description: 'Auto-review PRs on GitHub', active: true, type: 'Dev' },
];

router.get('/automations', (req, res) => {
  res.json(automations);
});

router.post('/automations/:id/toggle', (req, res) => {
  const { id } = req.params;
  const auto = automations.find(a => a.id === id);
  if (auto) {
    auto.active = !auto.active;
    res.json(auto);
  } else {
    res.status(404).json({ error: 'Automation not found' });
  }
});

// Admin Settings (Persistent)
router.get('/admin/settings', async (req, res) => {
  try {
    /*
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({});
    }
    res.json(settings);
    */
    res.json({ platformName: 'A-Series™', maintenanceMode: false, killSwitch: false });
  } catch (err) {
    console.error("Failed to fetch admin settings", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Public System Settings (Read-Only, Safe Fields)
router.get('/settings/public', async (req, res) => {
  try {
    res.json({
      platformName: 'A-Series™',
      supportPhone: '+91 83598 90909',
      announcement: '',
      allowPublicSignup: true,
      contactEmail: 'support@a-series.in'
    });
  } catch (err) {
    console.error("Failed to fetch public settings", err);
    // Return defaults on error to prevent frontend crash
    res.json({
      platformName: 'A-Series™',
      supportPhone: '+91 83598 90909',
      announcement: '',
      allowPublicSignup: true,
      contactEmail: 'support@a-series.in'
    });
  }
});


router.post('/admin/settings', async (req, res) => {
  try {
    res.json({ success: true, message: "Settings logic disabled due to model removal" });
  } catch (err) {
    console.error("Failed to update admin settings", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;

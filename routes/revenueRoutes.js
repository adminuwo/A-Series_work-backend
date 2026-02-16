import express from 'express';
import Subscription from '../models/Subscription.js';
import Agent from '../models/Agents.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// Endpoints for Vendor/Admin revenue tracking removed as per feature decommissioning.

// Transaction endpoints for vendor/admin
// GET /api/revenue/admin/all-transactions - Admin view of all transactions
router.get('/admin/all-transactions', verifyToken, async (req, res) => {
    try {
        // In a real scenario, check for admin role here
        const transactions = await Subscription.find()
            .populate('agentId', 'agentName')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        // Format for frontend
        const formatted = transactions.map(t => ({
            id: t._id,
            date: t.createdAt,
            type: t.planType,
            appName: t.agentId ? t.agentId.agentName : 'Platform',
            amount: t.paymentDetails.amount,
            platformFee: t.paymentDetails.amount * 0.5,
            netAmount: t.paymentDetails.amount * 0.5,
            status: t.status,
            buyer: t.userId ? t.userId.name : 'Unknown User',
            vendor: 'System'
        }));

        res.json(formatted);
    } catch (err) {
        console.error('[ADMIN ALL TRANSACTIONS ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch transaction history' });
    }
});

// GET /api/revenue/stats - Admin Revenue Stats
router.get('/stats', verifyToken, async (req, res) => {
    try {
        // In a real scenario, check for admin role here
        const transactions = await Subscription.find({ 'paymentDetails.amount': { $gt: 0 } });

        let totalGross = 0;
        let totalVendorPayouts = 0; // Using for Operational Costs
        let totalPlatformNet = 0;
        const appMap = {};

        transactions.forEach(t => {
            totalGross += t.amount || 0;
            totalPlatformNet += t.netAmount || 0;
            // Assuming vendor payout relates to costs, or just sum platform fee as revenue
            // For now, let's assume 50% split as per data
            const vendorShare = (t.amount || 0) - (t.netAmount || 0); // Logic from invoice
            totalVendorPayouts += vendorShare;

            if (t.agentId) {
                if (!appMap[t.agentId]) {
                    appMap[t.agentId] = {
                        id: t.agentId,
                        name: 'Unknown App', // Would need populate, let's populate
                        totalRevenue: 0,
                        vendorEarnings: 0,
                        platformFees: 0
                    };
                }
                appMap[t.agentId].totalRevenue += t.amount;
                appMap[t.agentId].vendorEarnings += vendorShare;
                appMap[t.agentId].platformFees += t.netAmount;
            }
        });

        const appPerformance = await Promise.all(Object.values(appMap).map(async (app) => {
            const agent = await Agent.findById(app.id);
            return {
                ...app,
                name: agent ? agent.agentName : 'Deleted Agent'
            };
        }));

        res.json({
            overview: {
                totalGross,
                totalVendorPayouts: 0, // Operational Costs set to 0 as per request (was using vendor payouts as placeholder)
                totalPlatformNet
            },
            appPerformance
        });

    } catch (err) {
        console.error('[REVENUE STATS ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch revenue stats' });
    }
});


// GET /api/revenue/user/transactions - Get user's purchase history
router.get('/user/transactions', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch transactions where this user is the buyer and it's a paid transaction
        const transactions = await Subscription.find({
            userId: userId,
            'paymentDetails.amount': { $gt: 0 } // Only show paid transactions
        })
            .populate('agentId', 'agentName')
            .sort({ createdAt: -1 });

        res.json(transactions);

    } catch (err) {
        console.error('[USER TRANSACTION HISTORY ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch user transactions' });
    }
});

// GET /api/revenue/invoice/:id - Generate and download invoice
router.get('/invoice/:id', verifyToken, async (req, res) => {
    try {
        const transactionId = req.params.id;

        // Fetch transaction details
        const transaction = await Subscription.findById(transactionId)
            .populate('agentId', 'agentName')
            .populate('userId', 'name email');

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Generate simple HTML invoice (can be replaced with PDF library later)
        const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice #${transaction._id}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #4F46E5; padding-bottom: 20px; }
        .header h1 { color: #4F46E5; margin: 0; }
        .info { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .info-block { flex: 1; }
        .info-block h3 { color: #1E293B; margin-bottom: 10px; }
        .info-block p { margin: 5px 0; color: #64748B; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #E0E4E8; }
        th { background: #F8F9FB; font-weight: bold; color: #1E293B; }
        .total { text-align: right; font-size: 18px; font-weight: bold; color: #4F46E5; }
        .footer { text-align: center; color: #64748B; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E0E4E8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AI-MALL</h1>
        <p>Transaction Invoice</p>
    </div>
    
    <div class="info">
        <div class="info-block">
            <h3>Invoice To:</h3>
            <p><strong>${transaction.buyerId ? transaction.buyerId.name : 'N/A'}</strong></p>
            <p>${transaction.buyerId ? transaction.buyerId.email : 'N/A'}</p>
        </div>
        <div class="info-block">
            <h3>Invoice Details:</h3>
            <p><strong>Invoice #:</strong> ${transaction._id}</p>
            <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${transaction.status}</p>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>App Name</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Application Purchase</td>
                <td>${transaction.agentId ? transaction.agentId.agentName : 'Unknown'}</td>
                <td>$${transaction.paymentDetails.amount.toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="2" style="text-align: right;"><strong>Platform Fee (50%):</strong></td>
                <td>-$${(transaction.paymentDetails.amount * 0.5).toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="2" style="text-align: right;"><strong>Net Amount:</strong></td>
                <td class="total">$${(transaction.paymentDetails.amount * 0.5).toFixed(2)}</td>
            </tr>
        </tbody>
    </table>
    
    <div class="footer">
        <p>Thank you for your business!</p>
        <p>AI-MALL - Your AI Marketplace</p>
    </div>
</body>
</html>
        `;

        // Set headers for download
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${transaction._id}.html"`);
        res.send(invoiceHTML);

    } catch (err) {
        console.error('[INVOICE GENERATION ERROR]', err);
        res.status(500).json({ error: 'Failed to generate invoice' });
    }
});

export default router;

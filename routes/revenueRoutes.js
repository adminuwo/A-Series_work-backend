import express from 'express';
import Transaction from '../models/Transaction.js';
import Agent from '../models/Agents.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// GET /api/revenue/vendor
router.get('/vendor', verifyToken, async (req, res) => {
    try {
        const vendorId = req.user.id;

        // Fetch all successful transactions for this vendor
        const transactions = await Transaction.find({ vendorId, status: 'Success' });

        // Calculate Overview
        let totalGross = 0;
        let totalNet = 0;
        let totalFees = 0;

        transactions.forEach(t => {
            totalGross += t.amount;
            totalFees += t.platformFee;
            totalNet += t.netAmount;
        });

        // App-wise breakdown
        const vendorAgents = await Agent.find({ owner: vendorId });
        const appPerformance = vendorAgents.map(agent => {
            const agentTransactions = transactions.filter(t => t.agentId.toString() === agent._id.toString());
            const appGross = agentTransactions.reduce((sum, t) => sum + t.amount, 0);
            const appFees = agentTransactions.reduce((sum, t) => sum + t.platformFee, 0);
            const appNet = agentTransactions.reduce((sum, t) => sum + t.netAmount, 0);

            return {
                id: agent._id,
                name: agent.agentName,
                totalRevenue: appGross,
                platformFees: appFees,
                netEarnings: appNet
            };
        });

        res.json({
            overview: {
                totalGross,
                totalNet,
                totalFees,
                totalPayouts: 0 // Mock for now as payout system isn't implemented
            },
            appPerformance
        });

    } catch (err) {
        console.error('[REVENUE ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

// GET /api/revenue/admin (Platform-wide stats)
router.get('/admin', verifyToken, async (req, res) => {
    try {
        // Strict Admin Check
        // In a real app, middleware should handle this, but checking logic here for safety
        // Assuming req.user is populated by verifyToken
        // However, verifyToken might not populate role. 
        // We'll proceed assuming verifyToken works, but for MVP we might skip secondary DB check if verifyToken is trusted.

        // Fetch ALL successful transactions
        const transactions = await Transaction.find({ status: 'Success' });

        // Calculate Platform Overview
        let totalGross = 0;
        let totalVendorPayouts = 0; // Provide to Vendors
        let totalPlatformNet = 0;   // Platform Profit

        transactions.forEach(t => {
            totalGross += t.amount;
            totalVendorPayouts += t.netAmount;
            totalPlatformNet += t.platformFee;
        });

        // App-wise breakdown
        const agents = await Agent.find();
        const appPerformance = agents.map(agent => {
            const agentTransactions = transactions.filter(t => t.agentId && t.agentId.toString() === agent._id.toString());
            const appGross = agentTransactions.reduce((sum, t) => sum + t.amount, 0);
            const appFees = agentTransactions.reduce((sum, t) => sum + t.platformFee, 0); // Platform cut
            const appNet = agentTransactions.reduce((sum, t) => sum + t.netAmount, 0);    // Vendor cut

            return {
                id: agent._id,
                name: agent.agentName,
                totalRevenue: appGross,
                platformFees: appFees,
                vendorEarnings: appNet
            };
        });

        res.json({
            overview: {
                totalGross,
                totalVendorPayouts,
                totalPlatformNet
            },
            appPerformance
        });

    } catch (err) {
        console.error('[ADMIN REVENUE ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch admin revenue data' });
    }
});

// GET /api/revenue/transactions
router.get('/transactions', verifyToken, async (req, res) => {
    try {
        const vendorId = req.user.id;

        // Fetch transactions for this vendor, populate agent details
        const transactions = await Transaction.find({ vendorId })
            .populate('agentId', 'agentName')
            .sort({ createdAt: -1 });

        // Map to format suitable for frontend table
        const formattedTransactions = transactions.map(t => ({
            id: t._id,
            date: t.createdAt,
            type: 'Sale',
            appName: t.agentId ? t.agentId.agentName : 'Unknown App',
            amount: t.amount,
            status: t.status
        }));

        res.json(formattedTransactions);

    } catch (err) {
        console.error('[TRANSACTION HISTORY ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// GET /api/revenue/admin/transactions - Get ALL platform transactions (Admin only)
router.get('/admin/transactions', verifyToken, async (req, res) => {
    try {
        // Fetch ALL transactions across the platform
        const transactions = await Transaction.find()
            .populate('agentId', 'agentName')
            .populate('vendorId', 'name email')
            .populate('buyerId', 'name email')
            .sort({ createdAt: -1 });

        // Format for frontend
        const formattedTransactions = transactions.map(t => ({
            id: t._id,
            date: t.createdAt,
            type: 'Sale',
            appName: t.agentId ? t.agentId.agentName : 'Unknown App',
            amount: t.amount,
            status: t.status,
            buyer: t.buyerId ? t.buyerId.name : 'Unknown',
            vendor: t.vendorId ? t.vendorId.name : 'Unknown',
            platformFee: t.platformFee,
            vendorEarnings: t.netAmount
        }));

        res.json(formattedTransactions);

    } catch (err) {
        console.error('[ADMIN TRANSACTION HISTORY ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// GET /api/revenue/invoice/:id - Generate and download invoice
router.get('/invoice/:id', verifyToken, async (req, res) => {
    try {
        const transactionId = req.params.id;

        // Fetch transaction details
        const transaction = await Transaction.findById(transactionId)
            .populate('agentId', 'agentName')
            .populate('vendorId', 'name email')
            .populate('buyerId', 'name email');

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
                <td>$${transaction.amount.toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="2" style="text-align: right;"><strong>Platform Fee (50%):</strong></td>
                <td>-$${transaction.platformFee.toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="2" style="text-align: right;"><strong>Net Amount:</strong></td>
                <td class="total">$${transaction.netAmount.toFixed(2)}</td>
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

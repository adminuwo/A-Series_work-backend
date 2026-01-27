import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// GET /api/audit-logs
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            query = { $text: { $search: search } };
        }

        const logs = await AuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(50);

        // Format for frontend
        const formattedLogs = logs.map(log => ({
            id: log._id,
            action: log.action,
            user: log.user,
            target: log.target,
            time: new Date(log.timestamp).toLocaleString()
        }));

        res.json(formattedLogs);
    } catch (err) {
        console.error('[AUDIT LOGS ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// POST /api/audit-logs (Internal usage)
router.post('/', async (req, res) => {
    try {
        const newLog = new AuditLog(req.body);
        await newLog.save();
        res.status(201).json(newLog);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create log' });
    }
});

export default router;

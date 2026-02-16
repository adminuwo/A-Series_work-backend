import express from 'express';
// import Report from '../models/Report.js';
// import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/authorization.js';
import { sendAdminNotification, sendVendorReply } from '../services/emailService.js';

const router = express.Router();

// GET /api/reports (Admin only - fetch all reports)
// GET /api/reports (Admin only - fetch all reports)
router.get('/', verifyToken, async (req, res) => {
    try {
        res.json([]); // Return empty list (Lean Architecture: Model deleted)
    } catch (err) {
        console.error('[FETCH REPORTS ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// POST /api/reports/submit (User submits a report)
router.post('/submit', verifyToken, async (req, res) => {
    try {
        res.status(201).json({ success: true, message: 'Report logic disabled (Lean Architecture: Model deleted)' });
    } catch (err) {
        console.error('[SUBMIT REPORT ERROR]', err);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// POST /api/reports/:id/reply (Admin sends email reply to vendor)
router.post('/:id/reply', verifyToken, async (req, res) => {
    res.status(410).json({ success: false, message: 'Report management disabled (Lean Architecture: Model deleted)' });
});

export default router;

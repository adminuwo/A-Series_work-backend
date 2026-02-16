import express from 'express';
// import notificationModel from '../models/Notification.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// Get user notifications
router.get('/', verifyToken, async (req, res) => {
    try {
        res.json([]); // Lean Architecture: Model deleted
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark as read
router.put('/:id/read', verifyToken, async (req, res) => {
    res.status(410).json({ success: false, message: 'Notification logic disabled (Lean Architecture: Model deleted)' });
});

export default router;

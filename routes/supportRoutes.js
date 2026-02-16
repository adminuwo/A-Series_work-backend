import express from 'express';
// import SupportTicket from '../models/SupportTicket.js';
// import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// GET /api/support (Admin only - fetch all tickets)
router.get('/', verifyToken, async (req, res) => {
    try {
        res.json([]); // Lean Architecture: Model deleted
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    try {
        res.status(201).json({ message: 'Support ticket logged (Lean Architecture: Model deleted)' });
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Support ticket management disabled (Lean Architecture: Model deleted)
router.all('/:id/status', verifyToken, (req, res) => {
    res.status(410).json({ success: false, message: 'Support ticket management disabled (Lean Architecture: Model deleted)' });
});

router.delete('/:id', verifyToken, (req, res) => {
    res.status(410).json({ success: false, message: 'Support ticket deletion disabled (Lean Architecture: Model deleted)' });
});

export default router;

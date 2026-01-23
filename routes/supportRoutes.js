import express from 'express';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// GET /api/support (Admin only - fetch all tickets)
router.get('/', verifyToken, async (req, res) => {
    try {
        const tickets = await SupportTicket.find().sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { email, issueType, message, userId } = req.body;

        if (!email || !issueType || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newTicket = new SupportTicket({
            email,
            issueType,
            message,
            userId: userId || null
        });

        await newTicket.save();

        res.status(201).json({ message: 'Support ticket created successfully', ticket: newTicket });
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /api/support/:id/status (Admin only - update ticket status)
router.put('/:id/status', verifyToken, async (req, res) => {
    try {
        const { status, resolutionNote } = req.body;
        const ticketId = req.params.id;

        if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const ticket = await SupportTicket.findByIdAndUpdate(
            ticketId,
            { status },
            { new: true }
        );

        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        // If ticket has a userId, create a notification
        if (ticket.userId) {
            await Notification.create({
                userId: ticket.userId,
                message: resolutionNote || `Your support ticket (${ticket.issueType}) has been updated to: ${status}`,
                type: status === 'resolved' ? 'success' : 'info',
                targetId: ticket._id
            });
        }

        res.json(ticket);
    } catch (error) {
        console.error('Error updating support ticket status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;

import express from 'express';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// GET /api/support (Admin only - fetch all tickets)
router.get('/', verifyToken, async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query = {
                $or: [
                    { subject: searchRegex },
                    { message: searchRegex },
                    { name: searchRegex },
                    { email: searchRegex },
                    { issueType: searchRegex }
                ]
            };
        }

        const tickets = await SupportTicket.find(query).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, email, phone, subject, issueType, message, userId } = req.body;
        console.log('[SUPPORT] Creating ticket. Body userId:', userId);

        if (!email || !issueType || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newTicket = new SupportTicket({
            name,
            email,
            phone,
            subject,
            issueType,
            message,
            message,
            userId: userId || null,
            source: req.body.source || 'contact_us'
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

        console.log(`[SUPPORT] Updating status for ticket: ${ticketId} to ${status}`);

        if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const ticket = await SupportTicket.findByIdAndUpdate(
            ticketId,
            { status },
            { new: true }
        );

        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        console.log(`[SUPPORT] Ticket updated. ObjectId: ${ticket._id}`);
        console.log(`[SUPPORT] Ticket userId:`, ticket.userId, `Type:`, typeof ticket.userId);

        // If ticket has a userId, create a notification
        if (ticket.userId) {
            console.log('[SUPPORT] Creating notification for user:', ticket.userId);
            try {
                const notification = await Notification.create({
                    userId: ticket.userId,
                    title: 'Support Ticket Update',
                    message: resolutionNote || `Your support ticket (${ticket.issueType}) has been updated to: ${status}`,
                    type: status === 'resolved' ? 'success' : 'info',
                    targetId: ticket._id,
                    isRead: false
                });
                console.log('[SUPPORT] Notification created successfully:', notification._id);
            } catch (notifError) {
                console.error('[SUPPORT] Notification creation failed:', notifError);
            }
        } else {
            console.log('[SUPPORT] No userId found on ticket (is null or undefined), skipping notification');
        }

        res.json(ticket);
    } catch (error) {
        console.error('Error updating support ticket status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;

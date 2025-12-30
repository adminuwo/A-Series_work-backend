import express from 'express';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/authorization.js';
import { sendAdminNotification, sendVendorReply } from '../services/emailService.js';

const router = express.Router();

// GET /api/reports (Admin only - fetch all reports)
router.get('/', verifyToken, async (req, res) => {
    try {
        // Find all reports, populate user details
        const reports = await Report.find()
            .populate('userId', 'name email')
            .sort({ timestamp: -1 });

        res.json(reports);
    } catch (err) {
        console.error('[FETCH REPORTS ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// POST /api/reports/submit (User submits a report)
router.post('/submit', verifyToken, async (req, res) => {
    try {
        const { type, priority, description, targetId } = req.body;

        const newReport = await Report.create({
            userId: req.user.id,
            type,
            priority,
            description,
            status: 'open',
            targetId // Optional: if reporting a specific app/agent
        });

        // Populate user details for email
        await newReport.populate('userId', 'name email');

        // Send email notification to admin
        const emailResult = await sendAdminNotification(newReport);
        console.log('[EMAIL NOTIFICATION]', emailResult.message);

        res.status(201).json(newReport);
    } catch (err) {
        console.error('[SUBMIT REPORT ERROR]', err);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// POST /api/reports/:id/reply (Admin sends email reply to vendor)
router.post('/:id/reply', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        const reportId = req.params.id;

        // Find report and populate user details
        const report = await Report.findById(reportId).populate('userId', 'name email');

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        if (!report.userId || !report.userId.email) {
            return res.status(400).json({ error: 'Vendor email not found' });
        }

        // Send email reply to vendor
        const emailResult = await sendVendorReply(
            report.userId.email,
            report.userId.name,
            message,
            reportId
        );

        if (!emailResult.success) {
            return res.status(500).json({ error: emailResult.message });
        }

        // Create notification for vendor
        await Notification.create({
            userId: report.userId._id,
            message: `Admin replied to your support ticket: "${message.substring(0, 50)}..."`,
            type: 'info',
            targetId: reportId
        });

        res.json({ success: true, message: 'Reply sent successfully' });
    } catch (err) {
        console.error('[REPLY TO REPORT ERROR]', err);
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

// PUT /api/reports/:id/resolve (Admin updates status)
router.put('/:id/resolve', verifyToken, async (req, res) => {
    try {
        const { status, resolutionNote } = req.body;
        const reportId = req.params.id;

        const report = await Report.findByIdAndUpdate(
            reportId,
            { status }, // Could also add resolutionNote field to schema if needed
            { new: true }
        );

        if (!report) return res.status(404).json({ error: 'Report not found' });

        // Notify the user who submitted the report
        await Notification.create({
            userId: report.userId,
            message: `Your report (ID: ${report._id.toString().substring(0, 8)}) status has been updated to: ${status}`,
            type: status === 'resolved' ? 'success' : 'info',
            targetId: report._id
        });

        res.json(report);
    } catch (err) {
        console.error('[RESOLVE REPORT ERROR]', err);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

export default router;

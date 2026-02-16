import express from 'express';
// import Feedback from '../models/Feedback.js';

const router = express.Router();

// POST /api/feedback
router.post('/', async (req, res) => {
    try {
        res.status(201).json({ message: 'Feedback logged (Lean Architecture: Model deleted)' });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/feedback (Admin only)
router.get('/', async (req, res) => {
    res.json([]); // Lean Architecture: Model deleted
});

export default router;

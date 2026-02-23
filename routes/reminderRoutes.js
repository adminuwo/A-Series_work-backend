import express from 'express';
import { setReminder } from '../controllers/reminderController.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

router.post('/', verifyToken, setReminder);

export default router;

import express from 'express';
import { synthesizeSpeech } from '../controllers/voiceController.js';

const router = express.Router();

router.post('/synthesize', synthesizeSpeech);

export default router;

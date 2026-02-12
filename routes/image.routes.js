import express from 'express';
import { generateImage } from '../controllers/image.controller.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

router.post('/generate', verifyToken, generateImage);

export default router;

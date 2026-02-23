import express from 'express';
import { generateMusic } from '../controllers/music.controller.js';
import { verifyToken, optionalVerifyToken } from '../middleware/authorization.js';

const router = express.Router();

router.post('/generate', optionalVerifyToken, generateMusic);

export default router;

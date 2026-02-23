import express from 'express';
import { convert } from '../controllers/conversionController.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

router.post('/', verifyToken, convert);

export default router;

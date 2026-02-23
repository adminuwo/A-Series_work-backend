import express from 'express';
import { webSearch } from '../controllers/searchController.js';
import { verifyToken, optionalVerifyToken } from '../middleware/authorization.js';

const router = express.Router();

router.post('/web', optionalVerifyToken, webSearch);

export default router;

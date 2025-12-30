import { upload } from '../services/cloudinary.service.js';
import logger from '../utils/logger.js';

const uploadMiddleware = (req, res, next) => {
    const uploader = upload.single('file'); // Expect form field name 'file'

    uploader(req, res, (err) => {
        if (err) {
            logger.error(`Upload Error: ${err.message}`);
            return res.status(400).json({
                success: false,
                message: err.message || 'File upload failed'
            });
        }
        next();
    });
};

export default uploadMiddleware;

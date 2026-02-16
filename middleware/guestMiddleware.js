import { v4 as uuidv4 } from 'uuid';
// import Guest from '../models/Guest.js';

export const identifyGuest = async (req, res, next) => {
    // If authenticated as user, guest logic is not needed for limits (but session might need it)
    if (req.user) return next();

    let guestId = req.cookies.guest_id;
    const fingerprint = req.headers['x-device-fingerprint'];
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        let guestId = req.cookies.guest_id || `guest_${uuidv4()}`;

        // Return a mock guest object (Lean Architecture: Model deleted)
        const guest = {
            guestId,
            fingerprint,
            ip,
            sessionIds: [],
            save: async () => { }
        };

        // Set HttpOnly cookie
        res.cookie('guest_id', guestId, {
            httpOnly: true,
            secure: true, // Always secure for HttpOnly cookies in modern browsers
            sameSite: 'none', // Needed for cross-origin if frontend/backend are on different domains
            maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
        });

        req.guest = guest;
        next();
    } catch (error) {
        console.error('[GUEST MIDDLEWARE ERROR]', error);
        next();
    }
};

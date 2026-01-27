import mongoose from 'mongoose';
import SupportTicket from './models/SupportTicket.js';
import dotenv from 'dotenv';
dotenv.config();

// Use the URI from .env directly
const uri = "mongodb+srv://gurumukhahuja3_db_user:I264cAAGxgT9YcQR@cluster0.selr4is.mongodb.net/AI_MALL";

mongoose.connect(uri)
    .then(async () => {
        console.log("Connected to DB");
        const ticket = await SupportTicket.findOne().sort({ createdAt: -1 });
        console.log("Latest Ticket:", getTicketInfo(ticket));
        process.exit();
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });

function getTicketInfo(t) {
    if (!t) return "No tickets found";
    return {
        id: t._id,
        subject: t.subject,
        userId: t.userId,
        userIdType: typeof t.userId,
        source: t.source,
        message: t.message,
        createdAt: t.createdAt,
        status: t.status
    };
}

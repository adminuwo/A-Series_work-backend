import express, { urlencoded } from "express";
import dotenv from "dotenv";
import 'dotenv/config';
import cors from "cors";
import connectDB from "./config/db.js";
import chatRoutes from "./routes/chatRoutes.js";

// Global process error handlers to prevent crashes from unhandled library errors (like Tesseract workers)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  // Optional: Graceful exit if it's a truly fatal state, but usually nodemon will restart us
  // process.exit(1); 
});

import dashboardRoutes from "./routes/dashboardRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import emailVatifiation from "./routes/emailVerification.js"
import userRoute from './routes/user.js'

import chatRoute from './routes/chat.routes.js';
import knowledgeRoute from './routes/knowledge.routes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import aibizRoutes from './routes/aibizRoutes.js';
// import fileUpload from 'express-fileupload';
import * as aibaseService from './services/aibaseService.js';
import reportRoutes from './routes/reportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import revenueRoutes from './routes/revenueRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import personalTaskRoutes from './routes/personalTaskRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import imageRoute from './routes/image.routes.js';
import videoRoutes from './routes/videoRoutes.js';
import audioRoutes from './routes/audioRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import conversionRoutes from './routes/conversionRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';


dotenv.config();
const app = express();
const PORT = process.env.PORT
import { seedTools } from "./utils/seedTools.js";

// Connect to Database
connectDB().then(async () => {
  console.log("Database connected, initializing services...");
  await aibaseService.initializeFromDB();
  await seedTools();
});


// Middleware

// Debug CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://192.168.29.47:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

console.log("Allowed CORS Origins:", allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      console.log(`[CORS BLOCK] Origin: ${origin} not allowed`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-fingerprint', 'Access-Control-Allow-Origin']
}));
app.use(cookieParser())
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
// app.use(fileUpload()); // Removed to avoid conflict with Multer (New AIBASE)

app.get("/ping-top", (req, res) => {
  res.send("Top ping works");
})

app.get("/", (req, res) => {
  res.send("All working")
})
// Debug middleware
app.use('/api', (req, res, next) => {
  console.log(`[API DEBUG] ${req.method} ${req.url}`);
  next();
});

// Mount Routes
// AIBASE Routes: /api/aibase/chat, /api/aibase/knowledge


// AIBASE Routes: /api/aibase/chat, /api/aibase/knowledge
app.use('/api/aibase/chat', chatRoute);
app.use('/api/aibase/knowledge', knowledgeRoute);

//Get user Route
app.use('/api/user', userRoute)

// Chat Routes: /api/chat (GET sessions), /api/chat/:id (GET history), /api/chat/:id/message (POST message)
app.use('/api/chat', chatRoutes);

// Image & Video Gen Routes
app.use('/api/image', imageRoute);
app.use('/api/video', videoRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/conversion', conversionRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/search', searchRoutes);


// Auth Routes: /api/auth/login, /api/auth/signup
app.use('/api/auth', authRoutes);

// Agent Routes: /api/agents (GET/POST agents)
app.use('/api/agents', agentRoutes);

//email varification route 
app.use("/api/email_varification", emailVatifiation)

// Dashboard/General Routes: /api/dashboard/stats, /api/automations, /api/admin/settings
app.use('/api', dashboardRoutes);

// PDF Analysis Routes: /api/pdf/analyze
app.use('/api/pdf', pdfRoutes);

// AIBIZ Routes
app.use('/api/aibiz', aibizRoutes);

// Report Routes
app.use('/api/reports', reportRoutes);

// Notification Routes
app.use('/api/notifications', notificationRoutes);

// Revenue Routes
app.use('/api/revenue', revenueRoutes);

// Support Routes
app.use('/api/support', supportRoutes);
app.use('/api/personal-task', personalTaskRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/personal-assistant/tasks', personalTaskRoutes);
app.use('/api/payments', paymentRoutes);

// Contact Routes
app.use('/api/contact', contactRoutes);

// Voice Routes
// Voice Routes
app.use('/api/voice', voiceRoutes);


// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI-Mall Backend running on  http://0.0.0.0:${PORT}`);
  console.log("Razorpay Config Check:", {
    KeyID: process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 8)}...` : "MISSING",
    Secret: process.env.RAZORPAY_KEY_SECRET ? "PRESENT" : "MISSING"
  });
}); // Environment variables updated loop restart
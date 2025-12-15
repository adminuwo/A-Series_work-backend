import nodemailer from "nodemailer"
const Email = process.env.Email
const pass = process.env.EMAIL_PASS_KEY
export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for port 465, false for other ports
  auth: {
    user: Email,
    pass: pass,
  },
});
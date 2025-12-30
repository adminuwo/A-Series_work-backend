import nodemailer from 'nodemailer';

// Email configuration from environment variables
const EMAIL_CONFIG = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    password: process.env.EMAIL_PASSWORD || 'your-app-password',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@aimall.com'
};

// Create transporter
const createTransporter = () => {
    try {
        return nodemailer.createTransport({
            service: EMAIL_CONFIG.service,
            auth: {
                user: EMAIL_CONFIG.user,
                pass: EMAIL_CONFIG.password
            }
        });
    } catch (error) {
        console.error('[EMAIL SERVICE] Failed to create transporter:', error);
        return null;
    }
};

// Send email notification to admin when vendor submits ticket
export const sendAdminNotification = async (ticket) => {
    const transporter = createTransporter();
    if (!transporter) {
        console.warn('[EMAIL SERVICE] Transporter not configured, skipping email');
        return { success: false, message: 'Email service not configured' };
    }

    const mailOptions = {
        from: EMAIL_CONFIG.user,
        to: EMAIL_CONFIG.adminEmail,
        subject: `🎫 New Vendor Support Ticket - ${ticket.type}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">AI-MALL Admin</h1>
                    <p style="color: #f0f0f0; margin: 5px 0 0 0;">New Support Ticket Received</p>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1e293b; margin-top: 0;">Ticket Details</h2>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <p style="margin: 10px 0;"><strong style="color: #64748b;">Ticket ID:</strong> <span style="color: #1e293b;">#${ticket._id.toString().substring(18).toUpperCase()}</span></p>
                        <p style="margin: 10px 0;"><strong style="color: #64748b;">Type:</strong> <span style="color: #1e293b;">${ticket.type}</span></p>
                        <p style="margin: 10px 0;"><strong style="color: #64748b;">User:</strong> <span style="color: #1e293b;">${ticket.userId?.name || ticket.userId || 'Anonymous'}</span></p>
                        <p style="margin: 10px 0;"><strong style="color: #64748b;">Email:</strong> <span style="color: #1e293b;">${ticket.userId?.email || 'No email provided'}</span></p>
                        <p style="margin: 10px 0;"><strong style="color: #64748b;">Status:</strong> <span style="padding: 4px 12px; background: #fef3c7; color: #92400e; border-radius: 20px; font-size: 12px; font-weight: bold;">${ticket.status.toUpperCase()}</span></p>
                    </div>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <h3 style="color: #1e293b; margin-top: 0;">Description:</h3>
                        <p style="color: #475569; line-height: 1.6;">${ticket.description}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="http://localhost:5173/dashboard/admin" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">View in Admin Dashboard</a>
                    </div>
                </div>
                
                <div style="background: #f1f5f9; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #64748b; font-size: 12px;">
                    <p style="margin: 0;">AI-MALL Platform - Admin Notifications</p>
                    <p style="margin: 5px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('[EMAIL SERVICE] Admin notification sent successfully');
        return { success: true, message: 'Email sent to admin' };
    } catch (error) {
        console.error('[EMAIL SERVICE] Failed to send admin notification:', error);
        return { success: false, message: error.message };
    }
};

// Send reply from admin to vendor
export const sendVendorReply = async (vendorEmail, vendorName, message, ticketId) => {
    const transporter = createTransporter();
    if (!transporter) {
        console.warn('[EMAIL SERVICE] Transporter not configured, skipping email');
        return { success: false, message: 'Email service not configured' };
    }

    const mailOptions = {
        from: EMAIL_CONFIG.user,
        to: vendorEmail,
        subject: `✉️ Reply from AI-MALL Admin - Ticket #${ticketId.substring(18).toUpperCase()}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">AI-MALL</h1>
                    <p style="color: #f0f0f0; margin: 5px 0 0 0;">Admin Response</p>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1e293b; margin-top: 0;">Hello ${vendorName},</h2>
                    <p style="color: #475569; margin-bottom: 20px;">Our admin team has responded to your support ticket.</p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <p style="margin: 0 0 10px 0;"><strong style="color: #64748b;">Ticket ID:</strong> <span style="color: #1e293b;">#${ticketId.substring(18).toUpperCase()}</span></p>
                        <div style="border-top: 2px solid #e2e8f0; margin: 15px 0; padding-top: 15px;">
                            <h3 style="color: #1e293b; margin-top: 0; font-size: 16px;">Admin's Response:</h3>
                            <p style="color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                        </div>
                    </div>
                    
                    <div style="background: #e0e7ff; padding: 15px; border-radius: 8px; border-left: 4px solid #4f46e5;">
                        <p style="margin: 0; color: #3730a3; font-size: 14px;"><strong>Need more help?</strong> Feel free to submit another support ticket from your vendor dashboard.</p>
                    </div>
                </div>
                
                <div style="background: #f1f5f9; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #64748b; font-size: 12px;">
                    <p style="margin: 0;">AI-MALL Platform</p>
                    <p style="margin: 5px 0 0 0;">Thank you for being a valued vendor!</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('[EMAIL SERVICE] Vendor reply sent successfully to:', vendorEmail);
        return { success: true, message: 'Email sent to vendor' };
    } catch (error) {
        console.error('[EMAIL SERVICE] Failed to send vendor reply:', error);
        return { success: false, message: error.message };
    }
};

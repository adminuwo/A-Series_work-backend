// import ContactSubmission from '../models/ContactSubmission.js';
import nodemailer from 'nodemailer';

// Configure nodemailer - only if email credentials are provided
let transporter = null;

if (process.env.EMAIL && process.env.EMAIL_PASS_KEY) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 465,
    secure: (process.env.SMTP_PORT || 465) == 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS_KEY,
    },
  });
} else {
  console.warn('⚠️  Gmail credentials not configured. Contact emails will be logged only.');
}

/**
 * Submit a contact form
 * POST /api/contact/submit
 */
export const submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, category, message } = req.body;
    console.log('📝 Contact form submission received:', { name, email, phone, subject, category, message });

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, subject, and message are required',
      });
    }

    // Get IP address
    const ipAddress = req.ip || req.connection.remoteAddress;
    console.log('🌐 IP Address:', ipAddress);

    // DB Persistence removed (Lean Architecture)
    const contactSubmission = {
      _id: 'mock_' + Date.now(),
      name,
      email,
      phone,
      subject,
      category,
      message,
      ipAddress,
      userId: req.user?._id || null,
      save: async () => { } // Mock save
    };

    console.log('💾 Attempting to save contact submission...');
    await contactSubmission.save();
    console.log('✅ Contact submission saved:', contactSubmission._id);

    // Send email notification to support team
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL,
          to: 'admin@uwo24.com',
          subject: `New Contact Submission: ${subject}`,
          html: `
            <h2>New Contact Submission</h2>
            <p><strong>From:</strong> ${name} (${email})</p>
            ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <h3>Message:</h3>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><small>Submitted on: ${new Date().toLocaleString()}</small></p>
            <p><small>Submission ID: ${contactSubmission._id}</small></p>
          `,
        });
        console.log('✅ Support notification email sent');
      } catch (emailError) {
        console.error('⚠️  Error sending email notification:', emailError);

        // Don't fail the request if email fails
      }

      // Send confirmation email to user
      try {
        await transporter.sendMail({
          from: process.env.EMAIL,
          to: email,
          subject: 'We received your message - A-Series™ Support',
          html: `
            <h2>Thank you for contacting us!</h2>
            <p>Hi ${name},</p>
            <p>We have received your message and our team will get back to you within 24 hours.</p>
            <p><strong>Your Submission Details:</strong></p>
            <ul>
              <li><strong>Subject:</strong> ${subject}</li>
              <li><strong>Category:</strong> ${category}</li>
              <li><strong>Reference ID:</strong> ${contactSubmission._id}</li>
            </ul>
            <p>If you have any urgent matters, please call us at <strong>+91 83598 90909</strong></p>
            <p>Best regards,<br>A-Series™ Support Team</p>
          `,
        });
        console.log('✅ Confirmation email sent to user');
      } catch (emailError) {
        console.error('⚠️  Error sending confirmation email:', emailError.message);
        // Don't fail the request if email fails
      }
    } else {
      console.log('📝 Email not configured. Contact submission logged instead.');
      console.log('Contact Details:', { name, email, subject, category, message });
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully. We will respond within 24 hours.',
      submissionId: contactSubmission._id,
    });
  } catch (error) {
    console.error('❌ Contact submission error:', error);

    // Handle Mongoose Validation Errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '), // Send specific validation error
      });
    }

    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error submitting contact form. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all contact submissions (Admin only)
 * GET /api/contact/submissions
 */
export const getAllSubmissions = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { status, category, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;

    res.status(410).json({
      success: false,
      message: 'Submission retrieval disabled (Lean Architecture: Model deleted)',
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching submissions',
    });
  }
};

/**
 * Get submission by ID
 * GET /api/contact/submissions/:id
 */
export const getSubmissionById = async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Submission management disabled (Lean Architecture: Model deleted)',
  });
};

/**
 * Update submission status (Admin only)
 * PATCH /api/contact/submissions/:id/status
 */
export const updateSubmissionStatus = async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Submission management disabled (Lean Architecture: Model deleted)',
  });
};

/**
 * Delete submission (Admin only)
 * DELETE /api/contact/submissions/:id
 */
export const deleteSubmission = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { id } = req.params;

    res.status(410).json({
      success: false,
      message: 'Submission management disabled (Lean Architecture: Model deleted)',
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting submission',
    });
  }
};

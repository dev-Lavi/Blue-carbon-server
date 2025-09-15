const nodemailer = require("nodemailer");

// ✅ FIXED: Accept object parameter to match your usage
async function sendEmail({ email, subject, message }) {
  try {
    console.log('🔧 Email function called with:', { email, subject: subject?.substring(0, 50) });

    // Validate required fields
    if (!email) {
      throw new Error('Email recipient is required');
    }
    if (!subject) {
      throw new Error('Email subject is required');
    }
    if (!message) {
      throw new Error('Email message is required');
    }

    // ✅ Configure transporter for Gmail with App Password
    // ✅ CORRECT
     const transporter = nodemailer.createTransport({

      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // full Gmail address
        pass: process.env.EMAIL_PASS, // 16-digit Google App Password
      },
      debug: true, // ✅ Enable debug output
      logger: true // ✅ Enable console logging
    });

    console.log('📧 Email config:');
    console.log('- From:', process.env.EMAIL_USER);
    console.log('- Pass configured:', process.env.EMAIL_PASS ? 'YES' : 'NO');

    // ✅ FIXED: Use the correct parameter names
    const mailOptions = {
      from: `"Blue Carbon Project" <${process.env.EMAIL_USER}>`,
      to: email, // ✅ Use 'email' from destructured object
      subject: subject,
      text: message // ✅ Use 'message' from destructured object
    };

    console.log('📬 Sending email to:', email);
    console.log('📬 Subject:', subject);

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent successfully to ${email}`);
    console.log(`📧 Message ID: ${info.messageId}`);
    
    return info; // ✅ Return result

  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    console.error("❌ Full error:", err);
    throw err; // ✅ Re-throw to handle in calling function
  }
}

module.exports = sendEmail;

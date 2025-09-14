const nodemailer = require("nodemailer");

async function sendEmail(to, subject, text) {
  try {
    // ✅ Configure transporter for Gmail with App Password
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // full Gmail address
        pass: process.env.EMAIL_PASS, // 16-digit Google App Password
      },
    });

    const mailOptions = {
      from: `"Blue Carbon Project" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}, Message ID: ${info.messageId}`);
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
  }
}

module.exports = sendEmail;

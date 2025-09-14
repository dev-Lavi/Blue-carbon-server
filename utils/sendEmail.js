const nodemailer = require("nodemailer");

async function sendEmail(to, subject, text) {
  try {
    // ✅ Configure transporter for Brevo SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587, // TLS
      auth: {
        user: process.env.BREVO_USER,  // your Brevo account email
        pass: process.env.BREVO_PASS,  // API key
      },
    });

    const mailOptions = {
      from: `"Blue Carbon Project" <${process.env.BREVO_USER}>`,
      to,
      subject,
      text,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Email sending failed:", err);
  }
}

module.exports = sendEmail;

const nodemailer = require('nodemailer');

async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Blue Carbon Project" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('❌ Email sending failed:', err);
  }
}

module.exports = sendEmail;

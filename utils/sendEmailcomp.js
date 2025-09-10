const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"BlueCarbon" <${process.env.SMTP_EMAIL}>`,
    to: options.email,        // match controller (options.email)
    subject: options.subject, // match controller
    text: options.message,    // match controller (message)
  });
};

module.exports = sendEmail;

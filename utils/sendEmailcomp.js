const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: options.to, // <- THIS might be undefined
    subject: options.subject,
    text: options.text,
  });
};

module.exports = sendEmail;

const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // ✅ Configure Brevo SMTP
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587, // use 465 if you want SSL
    auth: {
      user: process.env.BREVO_USER, // your Brevo account email
      pass: process.env.BREVO_PASS, // your Brevo API key
    },
  });

  await transporter.sendMail({
    from: `"BlueCarbon" <${process.env.BREVO_USER}>`, // sender must be your Brevo email
    to: options.email,        // recipient
    subject: options.subject, // subject line
    text: options.message,    // plain text body
  });

  console.log(`📧 Email sent to ${options.email}`);
};

module.exports = sendEmail;

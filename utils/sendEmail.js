const SibApiV3Sdk = require("sib-api-v3-sdk");

async function sendEmail(to, subject, text) {
  try {
    // Configure Brevo API
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications["api-key"];
    apiKey.apiKey = process.env.BREVO_API_KEY; // from Brevo dashboard

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = { email: "970037001@smtp-brevo.com", name: "BlueCarbon" };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = text;

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("📧 Email sent:", response.messageId);
  } catch (err) {
    console.error("❌ Email sending failed:", err);
  }
}

module.exports = sendEmail;

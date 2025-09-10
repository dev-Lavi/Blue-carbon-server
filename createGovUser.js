const mongoose = require('mongoose');
const dotenv = require('dotenv');
const GovUser = require('./models/GovUser');
const sendEmail = require('./utils/sendEmail');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Failed', err));

(async () => {
  try {
    const gmail = 'lavi2312042@akgec.ac.in';
    const password = 'securePass123';

    const gov = new GovUser({
      gmail,
      password
    });
    await gov.save();

    console.log(`✅ Government user created successfully! UserID: ${gov.userId}`);

    // Send email with credentials
    await sendEmail(
      gmail,
      'Blue Carbon Portal Credentials',
      `Dear Official,\n\nYour account has been created.\nUserID: ${gov.userId}\nPassword: ${password}\n\nPlease log in and change your password.\n\n- Blue Carbon Team`
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }
})();

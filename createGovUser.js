const mongoose = require('mongoose');
const dotenv = require('dotenv');
const GovUser = require('./models/GovUser');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Failed', err));

(async () => {
  try {
    const gov = new GovUser({
      password: 'securePass123',  // Only password needed now
    });
    await gov.save();
    console.log(`✅ Government user created successfully! UserID: ${gov.userId}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }
})();

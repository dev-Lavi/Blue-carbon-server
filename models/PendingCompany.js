const mongoose = require('mongoose');

const pendingCompanySchema = new mongoose.Schema({
  companyData: { type: Object, required: true }, // Store all fields temporarily
  email: { type: String, required: true },
  otp: { type: String, required: true },
  otpExpires: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PendingCompany', pendingCompanySchema);

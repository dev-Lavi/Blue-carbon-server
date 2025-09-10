const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const tempCompanySchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  type: {
  type: String,
  enum: ['other', 'partnership', 'pvtltd', 'llp'],
  required: true
},
  registrationNumber: { type: String, required: true, unique: true },
  registrationDoc: { type: String },
  PAN: { type: String },
  GSTIN: { type: String },
  address: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  pin: { type: String, required: true },
  country: { type: String, default: 'India' },
  industryType: { type: String },
  annualCarbonEmission: { type: Number },
  website: { type: String },

  // 🔹 OTP verification fields
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },

  createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('TempCompany', tempCompanySchema);

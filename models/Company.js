const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyName: String,
  email: String,
  password: String,
  phone: String,
  type: String,
  registrationNumber: String,
  registrationDoc: String,
  PAN: String,
  GSTIN: String,
  address: String,
  state: String,
  city: String,
  pin: String,
  country: { type: String, default: 'India' },
  industryType: String,
  annualCarbonEmission: Number,
  website: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', companySchema);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const companySchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { 
    type: String, 
    required: true, 
    select: false   // 🔹 Do NOT include password by default in queries
  },
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
  createdAt: { type: Date, default: Date.now }
});


// 🔹 Add a method to check password
companySchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Company', companySchema);

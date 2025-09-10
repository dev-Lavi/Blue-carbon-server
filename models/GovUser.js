const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Helper function to generate numeric userId
function generateUserId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const timestamp = now.getTime().toString().slice(-6); // Last 6 digits of timestamp
  return `${year}${timestamp}`;
}

const govUserSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: generateUserId,
    unique: true
  },
  gmail: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  }
});

// Hash password before saving
govUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('GovUser', govUserSchema);

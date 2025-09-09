const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Helper to generate numeric ID (YYYYMMDDHHMMSS + random digits)
function generateUserId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000); // 3 random digits
  return Number(`${year}${month}${day}${hour}${minute}${second}${random}`);
}

const govUserSchema = new mongoose.Schema({
  userId: { type: Number, unique: true, default: generateUserId },
  password: { type: String, required: true },
});

// Hash password before saving
govUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('GovUser', govUserSchema);

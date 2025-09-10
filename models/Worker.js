const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const workerSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },

  // Worker-specific fields
  workerId: { type: String, unique: true }, // will be generated automatically
  employeeId: { type: String }, // optional, for internal company use
  designation: { type: String, default: 'Field Data Collector' },

  // Company Association
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  companyName: { type: String, required: true },

  // Address Information
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pin: { type: String, required: true },

  // Work Assignment
  assignedAreas: [{
    areaName: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    assignedDate: { type: Date, default: Date.now }
  }],

  // Status and Access
  isActive: { type: Boolean, default: true },

  // Work Statistics
  totalDataUploads: { type: Number, default: 0 },
  lastLogin: { type: Date },

  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
});

// Auto-generate unique worker ID if missing
workerSchema.pre('save', function(next) {
  if (!this.workerId) {
    const companyCode = this.companyName.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6); // last 6 digits of timestamp
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    this.workerId = `WRK-${companyCode}-${timestamp}${random}`;
  }
  next();
});

// Hash password before saving
workerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
workerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Worker', workerSchema);

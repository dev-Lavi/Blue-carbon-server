const mongoose = require('mongoose');

const dataApprovalSchema = new mongoose.Schema({
  // Submission Details
  submissionId: { type: String, required: true, unique: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

  // Ecosystem Type
  ecosystemType: { type: String, enum: ['Mangrove', 'Forest', 'Coastal', 'Seagrass', 'Other'], required: true },

  // ✅ Plantation (Mangroves/Forests) Data
  plantationImages: [{
    originalName: String,
    filename: String,
    path: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  individualDensities: [Number],
  meanDensity: Number, // only required for plantation type
  carbonCredits: Number,

  // ✅ Seagrass Data (Research Workers upload documents instead of images)
  seagrassDocs: [{
    originalName: String,
    filename: String,
    path: String,
    size: Number,
    docType: { type: String, enum: ['survey', 'lab_report', 'water_quality', 'certification', 'other'], default: 'other' },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Location Data
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: String,
    areaName: String
  },

  // Additional Metadata
  areaSize: Number, // in hectares
  plantingDate: Date,
  surveyDate: { type: Date, default: Date.now },

  // ✅ Occupied area tracking (to block duplicate submissions in same location)
  occupiedUntil: Date, // e.g. +6 months after submission

  // Approval Status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'revision_requested'],
    default: 'pending'
  },

  // Government Review
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'GovUser' },
  reviewDate: Date,
  reviewComments: String,
  rejectionReason: String,

  // Blockchain Integration (after approval)
  blockchainTxHash: String,
  ipfsHash: String,
  isStoredOnBlockchain: { type: Boolean, default: false },
  blockchainStoredAt: Date,

  // Timestamps
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Generate unique submission ID
dataApprovalSchema.pre('save', async function (next) {
  if (!this.submissionId) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.submissionId = `SUB${timestamp}${random}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('DataApproval', dataApprovalSchema);

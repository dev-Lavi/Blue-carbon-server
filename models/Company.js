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
    enum: ['other', 'partnership', 'pvtltd', 'llp','NGO','Research Institute'],
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

  // ✅ WALLET FIELDS (NEW)
  walletAddress: {
    type: String,
    unique: true,
    sparse: true, // Allows null values but enforces uniqueness for non-null
    validate: {
      validator: function(v) {
        // Allow empty/null or valid Ethereum address format
        return !v || /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid Ethereum wallet address format. Must be 42 characters starting with 0x'
    }
  },
  walletConnectedAt: { 
    type: Date 
  },
  walletVerified: { 
    type: Boolean, 
    default: false 
  },
  
  // ✅ BLOCKCHAIN ACTIVITY TRACKING
  blockchainStats: {
    totalSubmissions: { type: Number, default: 0 },
    totalCarbonCredits: { type: Number, default: 0 },
    totalGasSpent: { type: String, default: '0' }, // in ETH (as string for precision)
    lastBlockchainActivity: { type: Date }
  },

  // ✅ BUSINESS METRICS (Enhanced)
  businessMetrics: {
    totalWorkers: { type: Number, default: 0 },
    totalSubmissions: { type: Number, default: 0 },
    approvedSubmissions: { type: Number, default: 0 },
    rejectedSubmissions: { type: Number, default: 0 },
    totalCarbonCredits: { type: Number, default: 0 },
    averageSubmissionValue: { type: Number, default: 0 }
  },

  // ✅ ACTIVITY LOG
  activityLog: {
    lastLogin: { type: Date },
    lastSubmissionReceived: { type: Date },
    lastBlockchainUpload: { type: Date },
    accountStatus: { 
      type: String, 
      enum: ['active', 'suspended', 'pending_verification'],
      default: 'active'
    }
  },

  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// ===============================
// 📌 INDEXES FOR PERFORMANCE
// ===============================
// companySchema.index({ email: 1 });
// companySchema.index({ walletAddress: 1 });
// companySchema.index({ registrationNumber: 1 });
companySchema.index({ 'activityLog.accountStatus': 1 });

// ===============================
// 📌 METHODS
// ===============================

// 🔹 Check password
companySchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ Update wallet address with validation
companySchema.methods.updateWallet = async function (walletAddress) {
  // Validate format
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new Error('Invalid wallet address format');
  }

  // Check if wallet is already used by another company
  const existingCompany = await this.constructor.findOne({
    walletAddress: walletAddress,
    _id: { $ne: this._id }
  });

  if (existingCompany) {
    throw new Error('Wallet address already registered to another company');
  }

  this.walletAddress = walletAddress;
  this.walletConnectedAt = new Date();
  this.walletVerified = false; // Reset verification status
  
  return await this.save();
};

// ✅ Update blockchain stats after successful upload
companySchema.methods.recordBlockchainActivity = async function (carbonCredits, gasUsed, gasPrice) {
  this.blockchainStats.totalSubmissions += 1;
  this.blockchainStats.totalCarbonCredits += carbonCredits;
  
  // Calculate gas cost in ETH
  if (gasUsed && gasPrice) {
    const gasCostWei = gasUsed * gasPrice;
    const gasCostEth = gasCostWei / Math.pow(10, 18);
    const currentGasSpent = parseFloat(this.blockchainStats.totalGasSpent || '0');
    this.blockchainStats.totalGasSpent = (currentGasSpent + gasCostEth).toFixed(6);
  }
  
  this.blockchainStats.lastBlockchainActivity = new Date();
  this.activityLog.lastBlockchainUpload = new Date();
  
  return await this.save();
};

// ✅ Update business metrics
companySchema.methods.updateBusinessMetrics = async function () {
  // This would typically be called after submission approval/rejection
  const DataApproval = require('./DataApproval');
  
  const stats = await DataApproval.aggregate([
    { $match: { companyId: this._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCredits: { $sum: '$carbonCredits' }
      }
    }
  ]);

  let totalSubmissions = 0;
  let approvedSubmissions = 0;
  let rejectedSubmissions = 0;
  let totalCarbonCredits = 0;

  stats.forEach(stat => {
    totalSubmissions += stat.count;
    totalCarbonCredits += stat.totalCredits || 0;
    
    if (stat._id === 'approved' || stat._id === 'company_approved') {
      approvedSubmissions += stat.count;
    } else if (stat._id === 'rejected') {
      rejectedSubmissions += stat.count;
    }
  });

  this.businessMetrics = {
    totalSubmissions,
    approvedSubmissions,
    rejectedSubmissions,
    totalCarbonCredits,
    averageSubmissionValue: totalSubmissions > 0 ? totalCarbonCredits / totalSubmissions : 0
  };

  return await this.save();
};

// ===============================
// 📌 VIRTUAL FIELDS
// ===============================

// Get wallet short format for display
companySchema.virtual('walletShort').get(function() {
  if (!this.walletAddress) return null;
  return `${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(38)}`;
});

// Check if wallet is connected
companySchema.virtual('hasWallet').get(function() {
  return !!(this.walletAddress && this.walletAddress.length === 42);
});

// Get approval rate percentage
companySchema.virtual('approvalRate').get(function() {
  if (!this.businessMetrics.totalSubmissions) return 0;
  return Math.round((this.businessMetrics.approvedSubmissions / this.businessMetrics.totalSubmissions) * 100);
});

// ===============================
// 📌 STATIC METHODS
// ===============================

// Find company by wallet address
companySchema.statics.findByWallet = function(walletAddress) {
  return this.findOne({ walletAddress: walletAddress });
};

// Get companies with blockchain activity
companySchema.statics.getActiveBlockchainCompanies = function() {
  return this.find({
    'blockchainStats.totalSubmissions': { $gt: 0 }
  }).sort({ 'blockchainStats.lastBlockchainActivity': -1 });
};

// ===============================
// 📌 PRE/POST HOOKS
// ===============================

// Update businessMetrics before saving
companySchema.pre('save', function(next) {
  if (this.isModified('walletAddress')) {
    this.activityLog.lastLogin = new Date();
  }
  next();
});

// Ensure virtual fields are included in JSON output
companySchema.set('toJSON', { virtuals: true });
companySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Company', companySchema);

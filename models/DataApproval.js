const mongoose = require('mongoose');

const dataApprovalSchema = new mongoose.Schema({
  // ===============================
  // 📌 SUBMISSION DETAILS
  // ===============================
  submissionId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  workerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Worker', 
    required: true 
  },
  companyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },

  // ===============================
  // 📌 ECOSYSTEM TYPE
  // ===============================
  ecosystemType: { 
    type: String, 
    enum: ['Mangrove', 'Forest', 'Coastal', 'Seagrass', 'Other'], 
    required: true 
  },

  // ===============================
  // 📌 PLANTATION DATA (Mangroves/Forests)
  // ===============================
  plantationImages: [{
    originalName: String,
    filename: String,
    path: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  individualDensities: [Number],
  meanDensity: Number, // Only for plantation type
  
  // ===============================
  // 📌 SEAGRASS DOCUMENTS & RESEARCH DATA
  // ===============================
  seagrassDocs: [{
    originalName: String,
    filename: String,
    path: String,
    size: Number,
    docType: { 
      type: String, 
      enum: ['survey', 'lab_report', 'water_quality', 'certification', 'other'], 
      default: 'other' 
    },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // ✅ NEW: Detailed Seagrass Research Data
  seagrassResearchData: {
    species: { 
      type: String,
      trim: true
    },
    height: { 
      type: Number, // in cm
      min: 0,
      max: 300
    },
    organicCarbonStock: { 
      type: Number, // percentage
      min: 0,
      max: 100
    },
    waterDepth: { 
      type: Number, // in meters
      min: 0,
      max: 50
    },
    meadowArea: { 
      type: Number, // in hectares
      min: 0.1,
      max: 1000
    },
    density: { 
      type: Number, // shoots/m²
      min: 0,
      max: 10000
    },
    researchMethodology: {
      type: String,
      trim: true
    },
    labCertificationNumber: {
      type: String,
      trim: true
    },
    thirdPartyValidation: {
      type: Boolean,
      default: false
    },
    // ✅ Carbon Credit Breakdown
    carbonBreakdown: {
      fromBiomass: { type: Number, default: 0 },
      fromSediment: { type: Number, default: 0 },
      annualSequestration: { type: Number, default: 0 }
    }
  },

  // ===============================
  // 📌 CARBON CREDITS
  // ===============================
  carbonCredits: { 
    type: Number, 
    min: 0,
    default: 0
  },

  // ===============================
  // 📌 LOCATION DATA
  // ===============================
  location: {
    latitude: { 
      type: Number, 
      required: true,
      min: -90,
      max: 90
    },
    longitude: { 
      type: Number, 
      required: true,
      min: -180,
      max: 180
    },
    address: {
      type: String,
      trim: true
    },
    areaName: {
      type: String,
      trim: true
    }
  },

  // ===============================
  // 📌 ADDITIONAL METADATA
  // ===============================
  areaSize: { 
    type: Number, // in hectares
    min: 0
  },
  plantingDate: Date,
  surveyDate: { 
    type: Date, 
    default: Date.now 
  },

  // ===============================
  // 📌 AREA OCCUPATION TRACKING
  // ===============================
  occupiedUntil: { 
    type: Date
  },

  // ✅ Enhanced occupation tracking
  exclusionZone: {
    radius: { 
      type: Number, 
      default: 2000 // meters
    },
    center: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere' // For geospatial queries
    }
  },

  // ===============================
  // 📌 APPROVAL STATUS
  // ===============================
  status: {
    type: String,
    enum: [
      'pending', 
      'under_review', 
      'approved', 
      'rejected', 
      'revision_requested',
      'company_approved', // ✅ NEW: For company dashboard approval
      'government_review'  // ✅ NEW: After company approval
    ],
    default: 'pending'
  },

  // ✅ Company Approval (Before Government Review)
  companyApproval: {
    approvedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Company' 
    },
    approvedAt: Date,
    approvalComments: String,
    approved: { 
      type: Boolean, 
      default: false 
    }
  },

  // ===============================
  // 📌 GOVERNMENT REVIEW
  // ===============================
  governmentReview: {
    reviewedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'GovUser' 
    },
    reviewDate: Date,
    reviewComments: String,
    rejectionReason: String,
    approved: { 
      type: Boolean, 
      default: false 
    }
  },

  // ===============================
  // 📌 VALIDATION & VERIFICATION
  // ===============================
  validation: {
    dataQuality: {
      type: String,
      enum: ['poor', 'fair', 'good', 'excellent'],
      default: 'fair'
    },
    completeness: {
      type: Number, // percentage
      min: 0,
      max: 100,
      default: 0
    },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'verified', 'failed_verification'],
      default: 'unverified'
    }
  },

  // ===============================
  // 📌 BLOCKCHAIN INTEGRATION
  // ===============================
  blockchain: {
    txHash: String,
    ipfsHash: String,
    isStored: { 
      type: Boolean, 
      default: false 
    },
    storedAt: Date,
    networkUsed: {
      type: String,
      enum: ['ethereum', 'polygon', 'binance', 'sepolia', 'other'],
      default: 'polygon'
    }
  },

  // ===============================
  // 📌 AUDIT TRAIL
  // ===============================
  auditTrail: [{
    action: {
      type: String,
      enum: [
        'created', 'updated', 'company_approved', 'company_rejected',
        'sent_for_government_review', 'government_approved', 'government_rejected',
        'stored_on_blockchain', 'credits_issued'
      ]
    },
    performedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      refPath: 'auditTrail.performerType' 
    },
    performerType: {
      type: String,
      enum: ['Worker', 'Company', 'GovUser', 'System']
    },
    timestamp: { 
      type: Date, 
      default: Date.now 
    },
    comments: String,
    previousStatus: String,
    newStatus: String
  }],

  // ===============================
  // 📌 TIMESTAMPS
  // ===============================
  submittedAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// ===============================
// 📌 INDEXES FOR PERFORMANCE
// ===============================
dataApprovalSchema.index({ workerId: 1 });
dataApprovalSchema.index({ companyId: 1 });
dataApprovalSchema.index({ status: 1 });
dataApprovalSchema.index({ ecosystemType: 1 });
dataApprovalSchema.index({ occupiedUntil: 1 });
dataApprovalSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
dataApprovalSchema.index({ submittedAt: -1 });

// ===============================
// 📌 PRE-SAVE MIDDLEWARE
// ===============================
dataApprovalSchema.pre('save', async function (next) {
  // Generate unique submission ID if not exists
  if (!this.submissionId) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // Different prefixes for different ecosystem types
    const prefix = this.ecosystemType === 'Seagrass' ? 'SG' : 
                  this.ecosystemType === 'Mangrove' ? 'MG' : 
                  'SUB';
    
    this.submissionId = `${prefix}${timestamp}${random}`;
  }

  // Update timestamp
  this.updatedAt = new Date();

  // Set exclusion zone center if location exists
  if (this.location && this.location.latitude && this.location.longitude) {
    this.exclusionZone = {
      ...this.exclusionZone,
      center: [this.location.longitude, this.location.latitude]
    };
  }

  next();
});

// ===============================
// 📌 METHODS
// ===============================
// Method to add audit trail entry
dataApprovalSchema.methods.addAuditEntry = function(action, performedBy, performerType, comments, previousStatus) {
  this.auditTrail.push({
    action,
    performedBy,
    performerType,
    comments,
    previousStatus: previousStatus || this.status,
    newStatus: this.status,
    timestamp: new Date()
  });
  return this.save();
};

// Method to approve by company
dataApprovalSchema.methods.approveByCompany = function(companyId, comments) {
  this.companyApproval = {
    approvedBy: companyId,
    approvedAt: new Date(),
    approvalComments: comments,
    approved: true
  };
  this.status = 'company_approved';
  return this.addAuditEntry('company_approved', companyId, 'Company', comments);
};

// Method to check if area is still occupied
dataApprovalSchema.methods.isAreaOccupied = function() {
  return this.occupiedUntil && this.occupiedUntil > new Date();
};

// ===============================
// 📌 STATIC METHODS
// ===============================
// Find submissions within exclusion zone
dataApprovalSchema.statics.findWithinExclusionZone = function(latitude, longitude, radius = 2000) {
  return this.find({
    'exclusionZone.center': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radius
      }
    },
    occupiedUntil: { $gt: new Date() },
    status: { $in: ['pending', 'under_review', 'approved', 'company_approved'] }
  });
};

// Get company dashboard statistics
dataApprovalSchema.statics.getCompanyStats = function(companyId) {
  return this.aggregate([
    { $match: { companyId: mongoose.Types.ObjectId(companyId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCarbonCredits: { $sum: '$carbonCredits' }
      }
    }
  ]);
};

module.exports = mongoose.model('DataApproval', dataApprovalSchema);

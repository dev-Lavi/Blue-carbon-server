const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const workerSchema = new mongoose.Schema({
  // ✅ CORE IDENTITY FIELDS
  workerId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6,
    select: false
  },
  phone: { 
    type: String, 
    required: true 
  },
  
  // ✅ LOCATION & CONTACT
  address: { 
    type: String, 
    required: true 
  },
  city: { 
    type: String, 
    required: true 
  },
  state: { 
    type: String, 
    required: true 
  },
  pin: { 
    type: String, 
    required: true 
  },
  
  // ✅ ROLE & AUTHORITY (IMPORTANT for carbon credit verification)
  designation: { 
    type: String, 
    required: true,
    enum: [
      'Field Data Collector',
      'Senior Field Collector', 
      'Marine Research Scientist',
      'Senior Marine Researcher',
      'Research Associate',
      'Project Coordinator'
    ],
    default: 'Field Data Collector'
  },
  
  // ✅ WORKER TYPE (Core business logic)
  workerType: {
    type: String,
    enum: ['field_collector', 'seagrass_researcher'],
    required: true,
    default: 'field_collector'
  },
  
  // ✅ TERRITORIAL MANAGEMENT (Critical for area exclusion)
  assignedAreas: {
    type: [String], // Geographic zones: ["Mumbai Coast", "Chennai Backwaters"]
    default: [],
    validate: {
      validator: function(areas) {
        return areas.length <= 10; // Max 10 areas per worker
      },
      message: 'Worker cannot be assigned more than 10 areas'
    }
  },
  
  // ✅ COMPANY RELATIONSHIP
  companyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  companyName: { 
    type: String, 
    required: true 
  },
  
  // ✅ SEAGRASS RESEARCHER CREDENTIALS (Only for regulatory compliance)
  researchCredentials: {
    qualifications: {
      type: [String],
      default: []
    },
    institutionAffiliation: {
      type: String,
      trim: true
    },
    certificationNumber: { // For official marine research certification
      type: String,
      sparse: true
    }
  },
  
  // ✅ PERFORMANCE METRICS (Essential for carbon credit tracking)
  metrics: {
    totalSubmissions: { type: Number, default: 0 },
    approvedSubmissions: { type: Number, default: 0 },
    totalCarbonCredits: { type: Number, default: 0 },
    lastSubmissionDate: { type: Date }
  },
  
  // ✅ SYSTEM FIELDS
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastLogin: { 
    type: Date, 
    default: Date.now 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company' 
  }
}, {
  timestamps: true
});

// ✅ INDEXES for performance
workerSchema.index({ email: 1 });
workerSchema.index({ workerId: 1 });
workerSchema.index({ companyId: 1 });
workerSchema.index({ workerType: 1 });
workerSchema.index({ assignedAreas: 1 });

// ✅ PASSWORD HASHING
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

// ✅ PASSWORD COMPARISON
workerSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ UPDATE METRICS METHOD
workerSchema.methods.updateMetrics = async function(submissionData) {
  this.metrics.totalSubmissions += 1;
  if (submissionData.status === 'approved') {
    this.metrics.approvedSubmissions += 1;
    this.metrics.totalCarbonCredits += submissionData.carbonCredits || 0;
  }
  this.metrics.lastSubmissionDate = new Date();
  return await this.save();
};

// ✅ CHECK AREA ASSIGNMENT METHOD
workerSchema.methods.hasAreaAccess = function(areaName) {
  return this.assignedAreas.includes(areaName) || this.assignedAreas.length === 0;
};

// ✅ REMOVE PASSWORD FROM JSON
workerSchema.methods.toJSON = function() {
  const workerObject = this.toObject();
  delete workerObject.password;
  return workerObject;
};

module.exports = mongoose.model('Worker', workerSchema);

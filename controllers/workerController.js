const Worker = require('../models/Worker'); 
const Company = require('../models/Company');
const crypto = require('crypto');
const sendEmail = require('../utils/workeremail');
const jwt = require('jsonwebtoken');
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const DataApproval = require('../models/DataApproval');

// ===============================
// 📌 Create Seagrass Research Worker
// ===============================
// exports.createSeagrassWorker = async (req, res) => {
//   try {
//     const {
//       name,
//       email,
//       phone,
//       address,
//       city,
//       state,
//       pin,
//       designation,
//       assignedCoastalAreas,
//       researchQualifications,
//       institutionAffiliation
//     } = req.body;

//     console.log("Create Seagrass Worker Request Body");

//     // Validate required fields
//     if (!name || !email || !phone || !address || !city || !state || !pin) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide all required fields.'
//       });
//     }

//     // Check if worker with email already exists
//     const existingWorker = await Worker.findOne({ email });
//     if (existingWorker) {
//       return res.status(409).json({
//         success: false,
//         message: 'Worker with this email already exists.'
//       });
//     }

//     // Get company from auth middleware
//     const company = await Company.findById(req.user.id);
//     if (!company) {
//       return res.status(404).json({
//         success: false,
//         message: 'Company not found.'
//       });
//     }

//     // Generate temporary password
//     const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

//     // Generate unique Seagrass Worker ID
//     const workerId = `SGW-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

//     // Create seagrass research worker
//     const seagrassWorker = new Worker({
//       workerId,
//       name,
//       email,
//       phone,
//       address,
//       city,
//       state,
//       pin,
//       designation: designation || 'Marine Research Scientist',
//       workerType: 'seagrass_researcher', // ✅ New field to distinguish worker types
//       companyId: company._id,
//       companyName: company.companyName,
//       password: tempPassword,
//       assignedAreas: assignedCoastalAreas || [],
//       researchQualifications: researchQualifications || [],
//       institutionAffiliation: institutionAffiliation || '',
//       createdBy: company._id,
//       specializations: ['Blue Carbon Research', 'Seagrass Ecosystem Analysis', 'Marine Lab Testing']
//     });

//     await seagrassWorker.save();

//     // Send email with credentials
//     const subject = `Welcome to ${company.companyName} - Seagrass Research Account Created`;
//     const message = `
// Dear ${name},

// Welcome to ${company.companyName}! Your seagrass research account has been created for blue carbon credit data collection.

// Your Login Credentials:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👤 Worker ID: ${seagrassWorker.workerId}
// 📧 Email: ${email}
// 🔑 Password: ${tempPassword}
// 🌊 Role: Seagrass Research Specialist
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// You are authorized to submit:
// • Lab analysis reports
// • Bathymetric surveys
// • Carbon stock assessments
// • Seagrass monitoring data
// • Environmental compliance documents

// Please login and change your password after first login.

// Best regards,  
// ${company.companyName} Marine Research Team
//     `;

//     await sendEmail({ email, subject, message });

//     // Remove password before sending back
//     const workerResponse = seagrassWorker.toObject();
//     delete workerResponse.password;

//     res.status(201).json({
//       success: true,
//       message: 'Seagrass research worker created successfully! Login credentials sent to researcher email.',
//       data: workerResponse
//     });

//   } catch (error) {
//     console.error('Create seagrass worker error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

// ===============================
// 📌 Seagrass Research Data Upload (Documents & Lab Results)
// ===============================
exports.uploadSeagrassResearchData = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No research documents uploaded. Please upload required research documents." 
      });
    }

    // ✅ Extract specific seagrass research data as requested
    const {
      latitude,
      longitude,
      coastalAreaName,
      seagrassSpecies,           // ✅ Seagrass species
      seagrassHeight,            // ✅ Seagrass height (cm)
      sedimentOrganicCarbon,     // ✅ Sediment organic carbon stock (%)
      waterDepth,                // ✅ Water depth (meters)
      seagrassMeadowArea,        // ✅ Seagrass meadow area (hectares)
      seagrassDensity,           // ✅ Seagrass density (shoots/m²)
      samplingDate,
      researchMethodology,
      labCertificationNumber,
      thirdPartyValidation
    } = req.body;

    console.log('📊 Received seagrass data:', {
      species: seagrassSpecies,
      height: seagrassHeight,
      organicCarbon: sedimentOrganicCarbon,
      waterDepth,
      meadowArea: seagrassMeadowArea,
      density: seagrassDensity
    });

    // ✅ Validate required seagrass research data
    if (!latitude || !longitude || !coastalAreaName || !seagrassSpecies || !seagrassMeadowArea) {
      return res.status(400).json({
        success: false,
        message: "Location coordinates, coastal area name, seagrass species, and meadow area are required"
      });
    }

    // Validate numeric fields
    const numericValidations = [
      { field: 'seagrassHeight', value: seagrassHeight, min: 0, max: 300 },
      { field: 'sedimentOrganicCarbon', value: sedimentOrganicCarbon, min: 0, max: 100 },
      { field: 'waterDepth', value: waterDepth, min: 0, max: 50 },
      { field: 'seagrassMeadowArea', value: seagrassMeadowArea, min: 0.1, max: 1000 },
      { field: 'seagrassDensity', value: seagrassDensity, min: 0, max: 10000 }
    ];

    for (const validation of numericValidations) {
      if (validation.value && (isNaN(validation.value) || validation.value < validation.min || validation.value > validation.max)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${validation.field}. Must be between ${validation.min} and ${validation.max}`
        });
      }
    }

    // Get seagrass worker details
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Seagrass researcher not found"
      });
    }

    // Verify worker is seagrass researcher type
    if (worker.workerType !== 'seagrass_researcher') {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for seagrass researchers only."
      });
    }

    // ===============================
    // 📌 Area Occupation Check (Prevent Duplicate Claims)
    // ===============================
    const exclusionRadius = 2000; // 2km radius exclusion zone
    const existingClaim = await DataApproval.findOne({
      'location.latitude': {
        $gte: parseFloat(latitude) - 0.018, // ~2km buffer
        $lte: parseFloat(latitude) + 0.018
      },
      'location.longitude': {
        $gte: parseFloat(longitude) - 0.018,
        $lte: parseFloat(longitude) + 0.018
      },
      ecosystemType: 'Seagrass',
      status: { $in: ['pending', 'under_review', 'approved'] },
      occupiedUntil: { $gt: new Date() }
    });

    if (existingClaim) {
      return res.status(409).json({
        success: false,
        message: `This coastal area is already occupied by another seagrass research project. Exclusion zone: ${exclusionRadius}m radius.`,
        existingClaim: {
          submissionId: existingClaim.submissionId,
          occupiedBy: existingClaim.companyId,
          occupiedUntil: existingClaim.occupiedUntil
        }
      });
    }

    // ===============================
    // 📌 Document Processing
    // ===============================
    const seagrassDocuments = req.files.map(file => {
      // Get document type from form field or default to 'other'
      const docType = req.body[`docType_${file.originalname}`] || 'other';
      
      return {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        docType: ['survey', 'lab_report', 'water_quality', 'certification', 'other'].includes(docType) ? docType : 'other',
        uploadedAt: new Date()
      };
    });

    // ===============================
    // 📌 Enhanced Carbon Credit Calculation for Seagrass
    // ===============================
    const calculateSeagrassCarbonCredits = () => {
      try {
        // Convert inputs to numbers with defaults
        const height = parseFloat(seagrassHeight || 20); // cm
        const organicCarbon = parseFloat(sedimentOrganicCarbon || 2.0); // %
        const depth = parseFloat(waterDepth || 2.0); // meters
        const meadowArea = parseFloat(seagrassMeadowArea || 0); // hectares
        const density = parseFloat(seagrassDensity || 500); // shoots/m²

        console.log('🧮 Carbon calculation inputs:', { height, organicCarbon, depth, meadowArea, density });

        // Enhanced seagrass carbon sequestration formula
        // Based on scientific studies and VM0033 methodology
        
        // Step 1: Calculate biomass per hectare based on height and density
        const biomassPerSqM = (height / 100) * (density / 1000) * 0.8; // kg dry weight/m²
        const totalBiomass = biomassPerSqM * 10000 * meadowArea; // kg dry weight (10000 m²/ha)
        
        // Step 2: Calculate sediment carbon stock
        const sedimentCarbonStock = organicCarbon * 0.01 * meadowArea * 100; // tons C/ha
        
        // Step 3: Calculate annual sequestration rate
        // Seagrass typically sequesters 0.5-2.0 tC/ha/year
        const annualSequestrationRate = Math.min(2.0, Math.max(0.5, 
          (height / 50) * (density / 1000) * (organicCarbon / 10)
        ));
        
        // Step 4: Calculate total carbon credits (convert to CO2 equivalent)
        const carbonCreditsFromBiomass = (totalBiomass * 0.4 * 3.67) / 1000; // tCO2e
        const carbonCreditsFromSediment = (sedimentCarbonStock * 3.67); // tCO2e
        const annualCarbonCredits = (annualSequestrationRate * meadowArea * 3.67); // tCO2e/year
        
        // Total estimated carbon credits (10-year projection)
        const totalCarbonCredits = carbonCreditsFromBiomass + carbonCreditsFromSediment + (annualCarbonCredits * 10);
        
        console.log('🧮 Carbon calculation results:', {
          biomass: carbonCreditsFromBiomass,
          sediment: carbonCreditsFromSediment,
          annual: annualCarbonCredits,
          total: totalCarbonCredits
        });
        
        return {
          totalCredits: Math.max(0, Math.round(totalCarbonCredits * 100) / 100),
          breakdown: {
            fromBiomass: Math.round(carbonCreditsFromBiomass * 100) / 100,
            fromSediment: Math.round(carbonCreditsFromSediment * 100) / 100,
            annualSequestration: Math.round(annualCarbonCredits * 100) / 100
          }
        };
        
      } catch (error) {
        console.error('Carbon calculation error:', error);
        return { totalCredits: 0, breakdown: { fromBiomass: 0, fromSediment: 0, annualSequestration: 0 } };
      }
    };

    const carbonCalculation = calculateSeagrassCarbonCredits();

    // ===============================
    // 📌 Create DataApproval Record (Updated for your schema)
    // ===============================
const seagrassDataApproval = new DataApproval({
  // ✅ EXPLICITLY SET submissionId (don't rely on pre-save middleware)
  submissionId: `SG${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
  
  workerId: worker._id,
  companyId: worker.companyId,
  ecosystemType: 'Seagrass',
  
  // ✅ Use seagrassDocs field from your schema
  seagrassDocs: seagrassDocuments,
  
  // ✅ Store the carbon credits
  carbonCredits: carbonCalculation.totalCredits,
  
  // ✅ Location data
  location: {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    address: `${coastalAreaName} Coastal Research Area`,
    areaName: coastalAreaName
  },
  
  // ✅ Additional fields from your schema
  areaSize: parseFloat(seagrassMeadowArea),
  surveyDate: samplingDate ? new Date(samplingDate) : new Date(),
  
  // ✅ Set occupation period (6 months)
  occupiedUntil: new Date(Date.now() + (6 * 30 * 24 * 60 * 60 * 1000)),
  
  status: 'pending',

  // ✅ NEW: Store seagrass research data
  seagrassResearchData: {
    species: seagrassSpecies,
    height: parseFloat(seagrassHeight || 0),
    organicCarbonStock: parseFloat(sedimentOrganicCarbon || 0),
    waterDepth: parseFloat(waterDepth || 0),
    meadowArea: parseFloat(seagrassMeadowArea || 0),
    density: parseFloat(seagrassDensity || 0),
    researchMethodology: researchMethodology || '',
    labCertificationNumber: labCertificationNumber || '',
    thirdPartyValidation: thirdPartyValidation === 'true',
    carbonBreakdown: carbonCalculation.breakdown
  }
});

    await seagrassDataApproval.save();
    console.log('✅ Seagrass data approval saved with ID:', seagrassDataApproval.submissionId);

    // ===============================
    // 📌 Update Worker Statistics
    // ===============================
    await Worker.findByIdAndUpdate(
      worker._id,
      { 
        $inc: { 
          'metrics.totalSubmissions': 1
        },
        lastLogin: new Date()
      }
    );

    // ===============================
    // 📌 Update Company Statistics
    // ===============================
    await Company.findByIdAndUpdate(
      worker.companyId,
      {
        $inc: {
          'businessMetrics.totalSubmissions': 1,
          'businessMetrics.totalCarbonCredits': carbonCalculation.totalCredits
        },
        'activityLog.lastSubmissionReceived': new Date()
      }
    );

    // ===============================
    // 📌 Send Response
    // ===============================
    res.json({
      success: true,
      message: "Seagrass research data submitted successfully and awaiting company approval",
      data: {
        submissionId: seagrassDataApproval.submissionId,
        seagrassData: {
          species: seagrassSpecies,
          height: `${seagrassHeight || 0} cm`,
          organicCarbonStock: `${sedimentOrganicCarbon || 0}%`,
          waterDepth: `${waterDepth || 0} meters`,
          meadowArea: `${seagrassMeadowArea} hectares`,
          density: `${seagrassDensity || 0} shoots/m²`
        },
        carbonCredits: {
          total: carbonCalculation.totalCredits,
          breakdown: carbonCalculation.breakdown,
          unit: 'tCO2e'
        },
        location: {
          area: coastalAreaName,
          coordinates: `${latitude}, ${longitude}`,
          exclusionZone: `${exclusionRadius}m radius`
        },
        submissionDetails: {
          status: 'pending_company_approval',
          occupiedUntil: seagrassDataApproval.occupiedUntil,
          documentsUploaded: seagrassDocuments.length,
          nextStep: "Company dashboard review and approval required"
        }
      }
    });

  } catch (error) {
    console.error("Error processing seagrass research data:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to process seagrass research submission",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// ===============================
// 📌 Get Seagrass Research Submissions
// ===============================
// exports.getMySeagrassSubmissions = async (req, res) => {
//   try {
//     const submissions = await DataApproval.find({ 
//       workerId: req.user.id,
//       dataType: 'seagrass_research'
//     })
//     .populate('reviewedBy', 'name email')
//     .sort({ submittedAt: -1 });

//     // Add area occupation status
//     const submissionsWithStatus = submissions.map(sub => ({
//       ...sub.toObject(),
//       areaStatus: sub.areaOccupation?.occupiedUntil > new Date() ? 'occupied' : 'available',
//       timeRemaining: sub.areaOccupation?.occupiedUntil > new Date() 
//         ? Math.ceil((sub.areaOccupation.occupiedUntil - new Date()) / (24 * 60 * 60 * 1000))
//         : 0
//     }));

//     res.json({
//       success: true,
//       count: submissions.length,
//       data: { 
//         submissions: submissionsWithStatus,
//         totalSeagrassArea: submissions.reduce((sum, sub) => sum + (sub.seagrassData?.meadowArea || 0), 0),
//         totalCarbonCredits: submissions
//           .filter(sub => sub.status === 'approved')
//           .reduce((sum, sub) => sum + sub.carbonCredits, 0)
//       }
//     });

//   } catch (error) {
//     console.error("Error fetching seagrass submissions:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch seagrass submissions"
//     });
//   }
// };

// ===============================
// 📌 Check Area Availability
// ===============================
exports.checkCoastalAreaAvailability = async (req, res) => {
  try {
    const { latitude, longitude, radius = 2000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    const bufferDegrees = radius / 111000; // Convert meters to degrees (approximate)

    const occupiedAreas = await DataApproval.find({
      'location.latitude': {
        $gte: parseFloat(latitude) - bufferDegrees,
        $lte: parseFloat(latitude) + bufferDegrees
      },
      'location.longitude': {
        $gte: parseFloat(longitude) - bufferDegrees,
        $lte: parseFloat(longitude) + bufferDegrees
      },
      status: { $in: ['pending', 'approved'] },
      'areaOccupation.occupiedUntil': { $gt: new Date() }
    });

    res.json({
      success: true,
      available: occupiedAreas.length === 0,
      occupiedAreas: occupiedAreas.map(area => ({
        submissionId: area.submissionId,
        companyName: area.companyId,
        occupiedUntil: area.areaOccupation?.occupiedUntil,
        exclusionRadius: area.location?.exclusionRadius || 2000
      }))
    });

  } catch (error) {
    console.error("Error checking area availability:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to check area availability"
    });
  }
};


exports.createWorker = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      pin,
      designation,
      assignedAreas,
      workerType, // ✅ ADD this field
      researchCredentials // ✅ ADD this field
    } = req.body;

    console.log("Create Worker Request Body:", req.body);

    // Validate required fields
    if (!name || !email || !phone || !address || !city || !state || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields.'
      });
    }

    // ✅ Validate worker type
    const validWorkerTypes = ['field_collector', 'seagrass_researcher'];
    const selectedWorkerType = workerType || 'field_collector';
    
    if (!validWorkerTypes.includes(selectedWorkerType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid worker type. Must be either "field_collector" or "seagrass_researcher".'
      });
    }

    console.log('🔍 Selected worker type:', selectedWorkerType);

    // Check if worker with email already exists
    const existingWorker = await Worker.findOne({ email });
    if (existingWorker) {
      return res.status(409).json({
        success: false,
        message: 'Worker with this email already exists.'
      });
    }

    // Get company from auth middleware
    const company = await Company.findById(req.user.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found.'
      });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
    console.log('🔑 Generated temp password:', tempPassword);

    // ✅ Generate Worker ID based on type
    const workerIdPrefix = selectedWorkerType === 'seagrass_researcher' ? 'SGW' : 'WKR';
    const workerId = `${workerIdPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    console.log('🆔 Generated worker ID:', workerId);

    // ✅ Set default designation based on type
    const defaultDesignation = selectedWorkerType === 'seagrass_researcher' 
      ? 'Marine Research Scientist' 
      : 'Field Data Collector';

    // ✅ Process research credentials
    let processedCredentials = {
      qualifications: [],
      institutionAffiliation: '',
      certificationNumber: ''
    };

    if (selectedWorkerType === 'seagrass_researcher' && researchCredentials) {
      processedCredentials = {
        qualifications: Array.isArray(researchCredentials.qualifications) 
          ? researchCredentials.qualifications 
          : [],
        institutionAffiliation: researchCredentials.institutionAffiliation || '',
        certificationNumber: researchCredentials.certificationNumber || ''
      };
    }

    console.log('🎓 Processed credentials:', processedCredentials);

    // ✅ Process assigned areas
    let processedAssignedAreas = [];
    if (assignedAreas) {
      if (Array.isArray(assignedAreas)) {
        processedAssignedAreas = assignedAreas.map(area => 
          typeof area === 'string' ? area : String(area)
        );
      } else if (typeof assignedAreas === 'string') {
        processedAssignedAreas = [assignedAreas];
      }
    }

    // Create worker with all fields
    const worker = new Worker({
      workerId,
      name,
      email,
      phone,
      address,
      city,
      state,
      pin,
      designation: designation || defaultDesignation,
      workerType: selectedWorkerType, // ✅ IMPORTANT: Use the selected type
      companyId: company._id,
      companyName: company.companyName,
      password: tempPassword,
      assignedAreas: processedAssignedAreas,
      researchCredentials: processedCredentials, // ✅ IMPORTANT: Add credentials
      createdBy: company._id,
      // Initialize metrics
      metrics: {
        totalSubmissions: 0,
        approvedSubmissions: 0,
        totalCarbonCredits: 0
      },
      isActive: true
    });

    console.log('💾 Saving worker with type:', worker.workerType);
    console.log('🎓 Saving worker with credentials:', worker.researchCredentials);

    await worker.save();

    console.log('✅ Worker saved to database');

    // ✅ Send type-specific email
    try {
      console.log('📧 Attempting to send email to:', email);
      
      const emailSubject = selectedWorkerType === 'seagrass_researcher' 
        ? `Welcome to ${company.companyName} - Seagrass Research Account Created`
        : `Welcome to ${company.companyName} - Worker Account Created`;
      
      const roleInfo = selectedWorkerType === 'seagrass_researcher' 
        ? `🌊 Role: Seagrass Research Specialist

You are authorized to submit:
• Lab analysis reports
• Bathymetric surveys  
• Carbon stock assessments
• Environmental compliance documents`
        : `🌱 Role: Field Data Collector

You are authorized to submit:
• Drone imagery of plantation areas
• GPS coordinates & measurements
• Field monitoring reports`;

      const message = `
Dear ${name},

Welcome to ${company.companyName}! Your account has been created for carbon credit data collection.

Your Login Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Worker ID: ${worker.workerId}
📧 Email: ${email}
🔑 Password: ${tempPassword}
${roleInfo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please login and change your password after first login.

Best regards,  
${company.companyName} Team`;

      await sendEmail({ 
        email: email, 
        subject: emailSubject, 
        message: message 
      });

      console.log('✅ Email sent successfully');

    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      console.warn('⚠️ Continuing without email notification');
    }

    // Remove password before sending back
    const workerResponse = worker.toObject();
    delete workerResponse.password;

    res.status(201).json({
      success: true,
      message: `${selectedWorkerType === 'seagrass_researcher' ? 'Seagrass research worker' : 'Field worker'} created successfully! Login credentials sent to email.`,
      data: workerResponse,
      debug: {
        requestedWorkerType: workerType,
        finalWorkerType: worker.workerType,
        credentialsProcessed: !!researchCredentials
      }
    });

  } catch (error) {
    console.error('Create worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



// ✅ Get all workers for the logged-in company
exports.getAllWorkers = async (req, res) => {
  try {
    const company = await Company.findById(req.user.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found.'
      });
    }

    const workers = await Worker.find({ companyId: company._id })
      .select('-password') // hide password field
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json({
      success: true,
      count: workers.length,
      data: workers
    });
  } catch (error) {
    console.error('Fetch workers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.signinWorker = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // ✅ FIXED: Explicitly select the password field
    const worker = await Worker.findOne({ email }).select('+password');
    
    if (!worker) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // ✅ DEBUG: Log to check if password hash exists
    console.log('🔍 Worker found:', worker.email);
    console.log('🔍 Password hash exists:', !!worker.password);
    console.log('🔍 Password hash length:', worker.password?.length);

    // Check if password hash exists
    if (!worker.password) {
      console.error('❌ No password hash found for worker:', worker.email);
      return res.status(401).json({
        success: false,
        message: 'Account setup incomplete. Please contact administrator.',
      });
    }

    const isMatch = await worker.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // ✅ Include worker type in JWT
    const token = jwt.sign(
      { 
        id: worker._id, 
        role: 'worker', 
        workerId: worker.workerId,
        workerType: worker.workerType || 'field_collector'
      },
      process.env.JWT_WORKER_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    worker.lastLogin = Date.now();
    await worker.save();

    // Remove password from response
    const workerData = worker.toObject();
    delete workerData.password;

    console.log('✅ Worker signed in successfully:', worker.email);

    res.status(200).json({
      success: true,
      message: 'Worker signed in successfully',
      token,
      worker: workerData,
    });
  } catch (error) {
    console.error('Worker signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

//ml data upoad old
// ===============================
// 📌 Worker uploads plantation images → ML server → Carbon Credit
// ===============================
// exports.uploadPlantationImages = async (req, res) => {
//   try {
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ success: false, message: "No files uploaded" });
//     }

//     // Step 1: Prepare form-data for ML server
//     const formData = new FormData();
//     req.files.forEach(file => {
//       formData.append("files", fs.createReadStream(file.path));
//     });

//     // Step 2: Send to ML server
//     const mlResponse = await axios.post(
//       "https://mangrove-density.onrender.com",
//       formData,
//       { headers: formData.getHeaders() }
//     );

//     const { individual_densities, mean_density } = mlResponse.data;

//     // Step 3: Calculate carbon credits (adjust formula as needed)
//     const carbonCredits = mean_density * 0.5; // Example formula

//     // Step 4: Send response
//     res.json({
//       success: true,
//       individual_densities,
//       mean_density,
//       carbonCredits,
//     });
//   } catch (error) {
//     console.error("Error processing images:", error.message);
//     res.status(500).json({ 
//       success: false, 
//       message: "Failed to process images" 
//     });
//   }
// };

// ===============================
// 📌 Worker uploads plantation images → ML server → Store in DataApproval (Government Review)
// ===============================
 


exports.uploadPlantationImages = async (req, res) => {
  try {
    console.log('📁 Files received:', req.files);
    console.log('📋 Body received:', req.body);

    // ✅ Extract files from the new structure
    const verticalFiles = req.files.vertical || [];
    const horizontalFiles = req.files.horizontals || [];
    
    if (verticalFiles.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No vertical image uploaded. Please select 1 vertical image for height calculation." 
      });
    }

    if (horizontalFiles.length < 2) {
      return res.status(400).json({
        success: false,
        message: `Need at least 2 horizontal images for analysis. Found only ${horizontalFiles.length} horizontal images.`
      });
    }

    // ✅ Combine all files for total count
    const allFiles = [...verticalFiles, ...horizontalFiles];
    const verticalImage = verticalFiles[0];

    console.log('📷 Image breakdown:', {
      vertical: verticalImage.originalname,
      horizontals: horizontalFiles.map(f => f.originalname),
      totalFiles: allFiles.length
    });

    // Extract additional data from request body
    const {
      latitude,
      longitude,
      address,
      areaName,
      plantationType,
      areaSize,
      plantingDate
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Location coordinates (latitude, longitude) are required"
      });
    }

    // Get worker details
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found"
      });
    }

    // ===============================
    // 📌 PREPARE FORM DATA FOR ML SERVER
    // ===============================
    console.log('📤 Preparing images for ML analysis...');
    
    const formData = new FormData();
    
    // Add vertical image
    console.log('📷 Adding vertical image:', verticalImage.originalname);
    formData.append('vertical', fs.createReadStream(verticalImage.path));
    
    // Add horizontal images
    horizontalFiles.forEach((file, index) => {
      console.log(`📷 Adding horizontal image ${index + 1}:`, file.originalname);
      formData.append('horizontals', fs.createReadStream(file.path));
    });

    // ===============================
    // 📌 CALL ML SERVER
    // ===============================
    let mlAnalysis;
    try {
      console.log('🤖 Sending to ML server:', 'https://ml-pipeline-4cb7.onrender.com/analyze');
      console.log('⏱️ Using 180 second timeout...');
      
      const mlResponse = await axios.post(
        'https://ml-pipeline-4cb7.onrender.com/analyze',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/json'
          },
          timeout: 180000, // 3 minutes
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      mlAnalysis = mlResponse.data;
      console.log('🤖 ML Response:', mlAnalysis);

    } catch (mlError) {
      console.error('❌ ML Server Error:', mlError.message);
      
      // Clean up uploaded files
      allFiles.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to analyze images with ML server',
        error: process.env.NODE_ENV === 'development' ? mlError.message : 'ML analysis failed'
      });
    }

    // ===============================
    // 📌 VALIDATE ML RESPONSE
    // ===============================
    
    // Check for duplicates
    if (mlAnalysis.horizontal_summary?.anomaly_counts?.duplicate > 0) {
      console.log('🚫 Duplicate images detected');
      
      // Clean up files
      allFiles.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      return res.status(400).json({
        success: false,
        message: 'Duplicate images found! Please upload unique plantation images and try again.',
        details: {
          duplicateCount: mlAnalysis.horizontal_summary.anomaly_counts.duplicate,
          totalHorizontalImages: horizontalFiles.length
        }
      });
    }

    // Check mangrove count
    const mangroveCount = mlAnalysis.horizontal_summary?.mangrove_count || 0;
    if (mangroveCount < 2) {
      console.log('🚫 Insufficient mangrove detection');
      
      // Clean up files
      allFiles.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      return res.status(400).json({
        success: false,
        message: 'Plantation is not of mangroves! Please upload images showing clear mangrove plantation.',
        details: {
          mangroveDetected: mangroveCount,
          minimumRequired: 2,
          nonMangroveCount: mlAnalysis.horizontal_summary?.non_mangrove_count || 0
        }
      });
    }

    // ===============================
    // 📌 EXTRACT RESULTS & CALCULATE CREDITS
    // ===============================
    const meanDensity = mlAnalysis.horizontal_summary?.mean_density || 0;
    const heightEstimate = mlAnalysis.height_estimate || "0 ft";
    
    // Extract height in feet and convert to meters
    const heightMatch = heightEstimate.match(/(\d+\.?\d*)/);
    const heightInFt = heightMatch ? parseFloat(heightMatch[1]) : 0;
    const heightInMeters = heightInFt * 0.3048;

    const areaSizeHa = areaSize ? parseFloat(areaSize) : 1.0;
    const carbonFactor = 0.18;
    const carbonCredits = meanDensity * heightInMeters * areaSizeHa * carbonFactor;

    // ===============================
    // 📌 PREPARE IMAGE DATA
    // ===============================
    const plantationImages = allFiles.map((file, index) => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      imageType: verticalFiles.includes(file) ? 'vertical' : 'horizontal',
      uploadedAt: new Date()
    }));

    // ===============================
    // 📌 CREATE DATA APPROVAL RECORD
    // ===============================
    const dataApproval = new DataApproval({
      workerId: worker._id,
      companyId: worker.companyId,
      ecosystemType: 'Mangrove',
      plantationImages,
      meanDensity: meanDensity,
      carbonCredits: Math.round(carbonCredits * 100) / 100,
      
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || '',
        areaName: areaName || 'Mangrove Plantation Site'
      },
      
      areaSize: areaSizeHa,
      plantingDate: plantingDate ? new Date(plantingDate) : new Date(),
      surveyDate: new Date(),
      
      validation: {
        dataQuality: 'excellent',
        completeness: 100,
        verificationStatus: 'verified'
      },
      
      status: 'pending'
    });

    await dataApproval.save();

    // ===============================
    // 📌 UPDATE WORKER STATS
    // ===============================
    await Worker.findByIdAndUpdate(
      worker._id,
      { 
        $inc: { totalDataUploads: 1 },
        lastLogin: new Date()
      }
    );

    console.log('✅ Plantation data saved:', dataApproval.submissionId);

    // ===============================
    // 📌 SUCCESS RESPONSE
    // ===============================
    res.json({
      success: true,
      message: "Mangrove plantation analysis completed successfully!",
      data: {
        submissionId: dataApproval.submissionId,
        analysisResults: {
          mangroveCount: mangroveCount,
          meanDensity: meanDensity,
          heightFromVertical: {
            estimate: heightEstimate,
            heightFt: heightInFt,
            heightMeters: Math.round(heightInMeters * 100) / 100
          },
          imageAnalysis: {
            verticalImage: verticalImage.originalname,
            horizontalImages: horizontalFiles.length,
            duplicatesFound: false
          }
        },
        carbonCredits: {
          estimated: Math.round(carbonCredits * 100) / 100,
          calculation: {
            density: meanDensity,
            heightMeters: Math.round(heightInMeters * 100) / 100,
            areaHectares: areaSizeHa,
            carbonFactor: carbonFactor
          }
        },
        status: 'pending_company_approval'
      }
    });

  } catch (error) {
    console.error("❌ Error processing plantation images:", error);
    
    // Clean up files on error
    if (req.files) {
      const allFiles = [...(req.files.vertical || []), ...(req.files.horizontals || [])];
      allFiles.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to process plantation images",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};



// Get worker's submissions status
exports.getMySubmissions = async (req, res) => {
  try {
    console.log('📋 Fetching submissions for worker:', req.user.id);
    
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found"
      });
    }

    console.log('👤 Worker found:', worker.email, 'Type:', worker.workerType);

    // ✅ FIXED: Use correct populate paths from your schema
    const submissions = await DataApproval.find({ workerId: req.user.id })
      .populate('governmentReview.reviewedBy', 'name email') // ✅ Correct path
      .populate('companyApproval.approvedBy', 'companyName email') // ✅ Company approval
      .sort({ submittedAt: -1 });

    console.log('📊 Found submissions:', submissions.length);

    // ✅ Separate by ecosystem type instead of dataType
    const submissionsByType = {
      seagrass: submissions.filter(s => s.ecosystemType === 'Seagrass'),
      mangrove: submissions.filter(s => s.ecosystemType === 'Mangrove'),
      other: submissions.filter(s => !['Seagrass', 'Mangrove'].includes(s.ecosystemType))
    };

    // ✅ Enhanced statistics
    const statistics = {
      total: submissions.length,
      pending: submissions.filter(s => s.status === 'pending').length,
      companyApproved: submissions.filter(s => s.status === 'company_approved').length,
      underReview: submissions.filter(s => s.status === 'under_review').length,
      approved: submissions.filter(s => s.status === 'approved').length,
      rejected: submissions.filter(s => s.status === 'rejected').length,
      totalCarbonCredits: submissions
        .filter(s => s.status === 'approved')
        .reduce((sum, s) => sum + (s.carbonCredits || 0), 0),
      averageCarbonCredits: submissions.length > 0 
        ? submissions.reduce((sum, s) => sum + (s.carbonCredits || 0), 0) / submissions.length 
        : 0
    };

    res.json({
      success: true,
      workerType: worker.workerType || 'field_collector',
      totalSubmissions: submissions.length,
      data: { 
        allSubmissions: submissions,
        byEcosystemType: submissionsByType,
        statistics: statistics,
        workerInfo: {
          workerId: worker.workerId,
          name: worker.name,
          email: worker.email,
          assignedAreas: worker.assignedAreas || []
        }
      }
    });

  } catch (error) {
    console.error("Error fetching submissions:", error.message);
    console.error("Full error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch submissions",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

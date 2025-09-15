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
        message: "No documents uploaded. Please upload required research documents." 
      });
    }

    // Extract seagrass research data from request body
    const {
      latitude,
      longitude,
      coastalAreaName,
      seagrassSpecies,
      meadowArea, // in hectares
      waterDepth,
      samplingDate,
      researchDuration, // in months
      carbonStockData,
      biomassData,
      sedimentData,
      environmentalData,
      researchMethodology,
      labCertificationNumber,
      thirdPartyValidation
    } = req.body;

    // Validate required seagrass research data
    if (!latitude || !longitude || !coastalAreaName || !seagrassSpecies) {
      return res.status(400).json({
        success: false,
        message: "Location coordinates, coastal area name, and seagrass species are required"
      });
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
      status: { $in: ['pending', 'approved'] },
      dataType: 'seagrass_research'
    });

    if (existingClaim) {
      return res.status(409).json({
        success: false,
        message: `This coastal area is already occupied by another research project. Exclusion zone: ${exclusionRadius}m radius.`,
        existingClaim: {
          submissionId: existingClaim.submissionId,
          occupiedBy: existingClaim.companyId,
          occupiedUntil: new Date(existingClaim.submittedAt.getTime() + (6 * 30 * 24 * 60 * 60 * 1000)) // 6 months
        }
      });
    }

    // ===============================
    // 📌 Document Validation & Processing
    // ===============================
    const requiredDocTypes = [
      'bathymetric_survey',
      'carbon_stock_analysis', 
      'lab_results',
      'environmental_permits',
      'species_identification',
      'monitoring_protocol'
    ];

    // Categorize uploaded documents
    const researchDocuments = req.files.map(file => {
      // Extract document type from filename or form field
      const docType = req.body[`docType_${file.originalname}`] || 'general_research';
      
      return {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        documentType: docType,
        uploadedAt: new Date()
      };
    });

    // ===============================
    // 📌 Carbon Credit Calculation (Seagrass Formula)
    // ===============================
    // Based on VM0033 methodology and research results
    const calculateSeagrassCarbonCredits = () => {
      try {
        // Parse carbon stock data
        const organicCarbon = parseFloat(carbonStockData?.organicCarbonPercent || 0);
        const sedimentAccumulation = parseFloat(sedimentData?.accumulationRate || 0);
        const meadowAreaHa = parseFloat(meadowArea || 0);
        
        // Seagrass carbon sequestration formula (tCO2/ha/year)
        // Formula: (Sediment accumulation rate × Organic carbon % × Meadow area × 3.67 CO2 conversion)
        const carbonSequestrationRate = (sedimentAccumulation * organicCarbon * 0.01 * 3.67);
        const totalCarbonCredits = carbonSequestrationRate * meadowAreaHa;
        
        return Math.max(0, totalCarbonCredits); // Ensure non-negative
      } catch (error) {
        console.log('Carbon calculation error:', error);
        return 0;
      }
    };

    const estimatedCarbonCredits = calculateSeagrassCarbonCredits();

    // ===============================
    // 📌 Create Seagrass Research Approval Record
    // ===============================
    const seagrassDataApproval = new DataApproval({
      workerId: worker._id,
      companyId: worker.companyId,
      dataType: 'seagrass_research', // ✅ New field to distinguish data types
      researchDocuments,
      
      // Seagrass-specific data
      seagrassData: {
        species: seagrassSpecies,
        meadowArea: parseFloat(meadowArea || 0),
        waterDepth: parseFloat(waterDepth || 0),
        samplingDate: samplingDate ? new Date(samplingDate) : new Date(),
        researchDuration: parseInt(researchDuration || 6),
        carbonStockData: carbonStockData || {},
        biomassData: biomassData || {},
        sedimentData: sedimentData || {},
        environmentalData: environmentalData || {},
        researchMethodology: researchMethodology || '',
        labCertificationNumber: labCertificationNumber || '',
        thirdPartyValidation: thirdPartyValidation === 'true'
      },
      
      carbonCredits: estimatedCarbonCredits,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: `${coastalAreaName} Coastal Area`,
        areaName: coastalAreaName,
        exclusionRadius: exclusionRadius
      },
      
      // Area occupation details
      areaOccupation: {
        occupiedFrom: new Date(),
        occupiedUntil: new Date(Date.now() + (6 * 30 * 24 * 60 * 60 * 1000)), // 6 months
        exclusionZone: {
          center: [parseFloat(longitude), parseFloat(latitude)],
          radius: exclusionRadius
        }
      },
      
      status: 'pending', // Waiting for government approval
      submissionType: 'document_based'
    });

    await seagrassDataApproval.save();

    // ===============================
    // 📌 Update Worker Statistics
    // ===============================
    await Worker.findByIdAndUpdate(
      worker._id,
      { 
        $inc: { 
          totalDataUploads: 1,
          seagrassSubmissions: 1 
        },
        lastLogin: new Date(),
        $push: {
          researchHistory: {
            submissionId: seagrassDataApproval.submissionId,
            location: coastalAreaName,
            submittedAt: new Date()
          }
        }
      }
    );

    // ===============================
    // 📌 Send Response
    // ===============================
    res.json({
      success: true,
      message: "Seagrass research data submitted successfully and under government review",
      data: {
        submissionId: seagrassDataApproval.submissionId,
        estimatedCarbonCredits: estimatedCarbonCredits,
        meadowArea: `${meadowArea} hectares`,
        seagrassSpecies: seagrassSpecies,
        exclusionZone: `${exclusionRadius}m radius`,
        occupiedUntil: seagrassDataApproval.areaOccupation.occupiedUntil,
        status: 'pending_government_approval',
        note: "Your research submission will be reviewed by marine biologists and government officials before carbon credits are issued.",
        documentsUploaded: researchDocuments.length,
        requiredDocuments: requiredDocTypes
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
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

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

    // Validate required location data
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

    // Step 1: Prepare form-data for ML server
    const formData = new FormData();
    req.files.forEach(file => {
      formData.append("files", fs.createReadStream(file.path));
    });

    // Step 2: Send to ML server
    console.log('📤 Sending images to ML server...');
    const mlResponse = await axios.post(
      "https://mangrove-density.onrender.com",
      formData,
      { headers: formData.getHeaders() }
    );

    const { individual_densities, mean_density } = mlResponse.data;

    // Step 3: Calculate carbon credits (adjust formula as needed)
    const carbonCredits = mean_density * 0.5; // Example formula

    // Step 4: Prepare image data for storage
    const plantationImages = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size
    }));

    // Step 5: Create DataApproval record (NOT blockchain storage yet)
    const dataApproval = new DataApproval({
      workerId: worker._id,
      companyId: worker.companyId,
      plantationImages,
      individualDensities: individual_densities,
      meanDensity: mean_density,
      carbonCredits: carbonCredits,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        areaName
      },
      plantationType: plantationType || 'Mangrove',
      areaSize: areaSize ? parseFloat(areaSize) : null,
      plantingDate: plantingDate ? new Date(plantingDate) : null,
      status: 'pending' // Waiting for government approval
    });

    await dataApproval.save();

    // Step 6: Update worker statistics
    await Worker.findByIdAndUpdate(
      worker._id,
      { 
        $inc: { totalDataUploads: 1 },
        lastLogin: new Date()
      }
    );

    // Step 7: Send response (NO blockchain storage yet)
    res.json({
      success: true,
      message: "Data uploaded successfully and submitted for government approval",
      data: {
        submissionId: dataApproval.submissionId,
        individual_densities,
        mean_density,
        carbonCredits,
        status: 'pending_approval',
        note: "Your submission will be reviewed by government officials before being stored on blockchain"
      }
    });

  } catch (error) {
    console.error("Error processing images:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to process images",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get worker's submissions status
exports.getMySubmissions = async (req, res) => {
  try {
    const submissions = await DataApproval.find({ workerId: req.user.id })
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      count: submissions.length,
      data: { submissions }
    });

  } catch (error) {
    console.error("Error fetching submissions:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch submissions"
    });
  }
};
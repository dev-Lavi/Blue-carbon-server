const Worker = require('../models/Worker'); 
const Company = require('../models/Company');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmailcomp');
const jwt = require('jsonwebtoken');
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

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
      assignedAreas
    } = req.body;

    console.log("Create Worker Request Body");

    // Validate required fields
    if (!name || !email || !phone || !address || !city || !state || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields.'
      });
    }

    // Check if worker with email already exists
    const existingWorker = await Worker.findOne({ email });
    if (existingWorker) {
      return res.status(409).json({
        success: false,
        message: 'Worker with this email already exists.'
      });
    }

    // Get company from auth middleware (req.user set in companyAuth)
    const company = await Company.findById(req.user.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found.'
      });
    }

    // Generate temporary password (8 chars, alphanumeric)
    const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Generate unique Worker ID
    const workerId = `WKR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create worker
    const worker = new Worker({
      workerId, // ✅ FIX: now we assign the generated ID
      name,
      email,
      phone,
      address,
      city,
      state,
      pin,
      designation: designation || 'Field Data Collector',
      companyId: company._id,
      companyName: company.companyName,
      password: tempPassword, // will be hashed by schema pre-save
      assignedAreas: assignedAreas || [],
      createdBy: company._id
    });

    await worker.save();

    // Send email with credentials
    const subject = `Welcome to ${company.companyName} - Worker Account Created`;
    const message = `
Dear ${name},

Welcome to ${company.companyName}! Your worker account has been created for carbon credit data collection.

Your Login Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Worker ID: ${worker.workerId}
📧 Email: ${email}
🔑 Password: ${tempPassword}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please login and change your password after first login.

Best regards,  
${company.companyName} Team
    `;

    await sendEmail({ email, subject, message });

    // Remove password before sending back
    const workerResponse = worker.toObject();
    delete workerResponse.password;

    res.status(201).json({
      success: true,
      message: 'Worker created successfully! Login credentials sent to worker email.',
      data: workerResponse
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

    const worker = await Worker.findOne({ email });
    if (!worker) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await worker.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: worker._id, role: 'worker', workerId: worker.workerId },
      process.env.JWT_WORKER_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    worker.lastLogin = Date.now();
    await worker.save();

    // Remove password from response
    const workerData = worker.toObject();
    delete workerData.password;

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

// ===============================
// 📌 Worker uploads plantation images → ML server → Carbon Credit
// ===============================
exports.uploadPlantationImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    // Step 1: Prepare form-data for ML server
    const formData = new FormData();
    req.files.forEach(file => {
      formData.append("files", fs.createReadStream(file.path));
    });

    // Step 2: Send to ML server
    const mlResponse = await axios.post(
      "https://mangrove-density.onrender.com",
      formData,
      { headers: formData.getHeaders() }
    );

    const { individual_densities, mean_density } = mlResponse.data;

    // Step 3: Calculate carbon credits (adjust formula as needed)
    const carbonCredits = mean_density * 0.5; // Example formula

    // Step 4: Send response
    res.json({
      success: true,
      individual_densities,
      mean_density,
      carbonCredits,
    });
  } catch (error) {
    console.error("Error processing images:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to process images" 
    });
  }
};
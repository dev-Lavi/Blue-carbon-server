const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✅ Import ALL functions from controller
const {
  createWorker,
  getAllWorkers,
  signinWorker,
  uploadPlantationImages,
  uploadSeagrassResearchData,
  getMySubmissions,
  checkCoastalAreaAvailability
} = require('../controllers/workerController');

// ✅ Import middleware
const { companyAuth, workerAuth } = require('../middleware/auth');
const upload = require('../middleware/upload2');

// ===============================
// 📌 MULTER CONFIGURATION FOR PLANTATION IMAGES
// ===============================

// Create upload directory if it doesn't exist
const uploadDir = 'uploads/plantations';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created plantation upload directory');
}

// Configure storage for plantation images
const plantationStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Create multer instance for plantation images
const plantationUpload = multer({ 
  storage: plantationStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 15 // Max 15 files total
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
}).fields([
  { name: 'vertical', maxCount: 1 },      // 1 vertical image
  { name: 'horizontals', maxCount: 10 }   // Up to 10 horizontal images
]);



// ===============================
// 📌 PUBLIC ROUTES (No Authentication)
// ===============================
// Health check for workers API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Workers API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get worker types and designations (for frontend dropdowns)
router.get('/metadata', (req, res) => {
  res.json({
    success: true,
    data: {
      workerTypes: [
        { value: 'field_collector', label: 'Field Data Collector' },
        { value: 'seagrass_researcher', label: 'Seagrass Researcher' }
      ],
      designations: [
        'Field Data Collector',
        'Senior Field Collector', 
        'Marine Research Scientist',
        'Senior Marine Researcher',
        'Research Associate',
        'Project Coordinator'
      ],
      supportedFileTypes: {
        images: ['jpg', 'jpeg', 'png', 'webp'],
        documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv']
      }
    }
  });
});

// ===============================
// 📌 WORKER AUTHENTICATION
// ===============================
router.post('/signin', signinWorker);

// Worker profile (get own profile)
router.get('/profile', workerAuth, async (req, res) => {
  try {
    const Worker = require('../models/Worker');
    const worker = await Worker.findById(req.user.id)
      .populate('companyId', 'companyName email')
      .select('-password');
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// ===============================
// 📌 COMPANY ROUTES (Create & Manage Workers)
// ===============================
router.post('/create', companyAuth, createWorker);
router.get('/company-workers', companyAuth, getAllWorkers);

// Get worker by ID (company access)
router.get('/company-workers/:workerId', companyAuth, async (req, res) => {
  try {
    const Worker = require('../models/Worker');
    const worker = await Worker.findOne({ 
      workerId: req.params.workerId,
      companyId: req.user.id 
    }).select('-password');
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found or unauthorized'
      });
    }

    res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error('Worker fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching worker details'
    });
  }
});

// Get company worker statistics
router.get('/company-statistics', companyAuth, async (req, res) => {
  try {
    const Worker = require('../models/Worker');
    const workers = await Worker.find({ companyId: req.user.id });
    
    const stats = {
      totalWorkers: workers.length,
      activeWorkers: workers.filter(w => w.isActive !== false).length,
      workersByType: {
        fieldCollectors: workers.filter(w => !w.workerType || w.workerType === 'field_collector').length,
        seagrassResearchers: workers.filter(w => w.workerType === 'seagrass_researcher').length
      },
      totalSubmissions: workers.reduce((sum, w) => sum + (w.metrics?.totalSubmissions || 0), 0),
      totalCarbonCredits: workers.reduce((sum, w) => sum + (w.metrics?.totalCarbonCredits || 0), 0)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Statistics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company statistics'
    });
  }
});

// ===============================
// 📌 WORKER DATA UPLOAD ROUTES
// ===============================
// Field workers - Upload plantation images
// ✅ NEW: Upload plantation images with ML analysis
router.post('/upload-plantation-images', workerAuth, plantationUpload, uploadPlantationImages);

// Seagrass researchers - Upload research documents  
router.post('/upload-seagrass-data', workerAuth, upload.array('documents', 20), uploadSeagrassResearchData);

// Test file upload (without processing)
router.post('/test-upload', workerAuth, upload.array('files', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const fileInfo = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }));

    res.json({
      success: true,
      message: 'Files uploaded successfully (test mode)',
      data: {
        filesUploaded: req.files.length,
        files: fileInfo,
        workerType: req.user.workerType || 'field_collector'
      }
    });
  } catch (error) {
    console.error('Upload test error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload test failed',
      error: error.message
    });
  }
});

// ===============================
// 📌 WORKER QUERY ROUTES
// ===============================
router.get('/my-submissions', workerAuth, getMySubmissions);

// Check area availability
router.get('/check-area', workerAuth, checkCoastalAreaAvailability);

// Get worker's assigned areas
router.get('/my-areas', workerAuth, (req, res) => {
  try {
    const assignedAreas = req.user.assignedAreas || [];
    
    res.json({
      success: true,
      data: {
        workerId: req.user.workerId,
        assignedAreas: assignedAreas,
        totalAreas: assignedAreas.length,
        workerType: req.user.workerType || 'field_collector'
      }
    });
  } catch (error) {
    console.error('Areas fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assigned areas'
    });
  }
});

// Get worker's performance metrics
router.get('/my-metrics', workerAuth, (req, res) => {
  try {
    const metrics = req.user.metrics || {
      totalSubmissions: 0,
      approvedSubmissions: 0,
      totalCarbonCredits: 0
    };

    const performanceScore = metrics.totalSubmissions > 0 
      ? Math.round((metrics.approvedSubmissions / metrics.totalSubmissions) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        ...metrics,
        performanceScore,
        workerType: req.user.workerType || 'field_collector',
        lastSubmissionDate: metrics.lastSubmissionDate
      }
    });
  } catch (error) {
    console.error('Metrics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching worker metrics'
    });
  }
});

// ===============================
// 📌 UTILITY ROUTES
// ===============================
// Validate coordinates
router.post('/validate-coordinates', workerAuth, (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    // Validate coordinate ranges
    const isValidLat = lat >= -90 && lat <= 90;
    const isValidLng = lng >= -180 && lng <= 180;
    
    if (!isValidLat || !isValidLng) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }

    res.json({
      success: true,
      message: 'Coordinates are valid',
      data: {
        latitude: lat,
        longitude: lng,
        isCoastalArea: Math.abs(lat) < 60,
        suggestedRadius: 2000
      }
    });
  } catch (error) {
    console.error('Coordinate validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Error validating coordinates'
    });
  }
});

// Get supported file types
router.get('/file-types', (req, res) => {
  res.json({
    success: true,
    data: {
      images: {
        allowed: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        maxSize: '10MB',
        maxCount: 10,
        endpoint: '/upload-images'
      },
      documents: {
        allowed: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv'
        ],
        maxSize: '50MB',
        maxCount: 20,
        endpoint: '/upload-seagrass-data'
      }
    }
  });
});

module.exports = router;

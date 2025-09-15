const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===============================
// 📌 Ensure Upload Directories Exist
// ===============================
const createUploadDirs = () => {
  const dirs = ['uploads/images', 'uploads/documents', 'uploads/temp'];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};

// Create directories on startup
createUploadDirs();

// ===============================
// 📌 Storage Configuration
// ===============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine upload path based on file type and route
    let uploadPath = 'uploads/temp';
    
    if (req.route.path.includes('images') || file.mimetype.startsWith('image/')) {
      uploadPath = 'uploads/images';
    } else if (req.route.path.includes('documents') || req.route.path.includes('seagrass')) {
      uploadPath = 'uploads/documents';
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    
    // Clean filename (remove special characters)
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${cleanBaseName}_${uniqueSuffix}${fileExtension}`);
  }
});

// ===============================
// 📌 File Filter Function
// ===============================
const fileFilter = (req, file, cb) => {
  console.log('📤 Uploading file:', file.originalname, 'Type:', file.mimetype);
  
  // Define allowed file types based on route
  const isImageUpload = req.route.path.includes('images');
  const isDocumentUpload = req.route.path.includes('documents') || req.route.path.includes('seagrass');
  
  if (isImageUpload) {
    // Allow only images for plantation image uploads
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image format. Only JPEG, PNG, and WebP files are allowed. Received: ${file.mimetype}`), false);
    }
  } 
  else if (isDocumentUpload) {
    // Allow documents for seagrass research uploads
    const allowedDocTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
      'image/jpeg',
      'image/jpg', 
      'image/png'
    ];
    
    if (allowedDocTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid document format. Allowed: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, JPG, PNG. Received: ${file.mimetype}`), false);
    }
  } 
  else {
    // Default: allow both images and documents
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  }
};

// ===============================
// 📌 Multer Configuration
// ===============================
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 20 // Maximum 20 files per upload
  }
});

// ===============================
// 📌 Error Handling Middleware
// ===============================
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size allowed is 50MB per file.',
        error: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 20 files allowed per upload.',
        error: 'TOO_MANY_FILES'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name for file upload.',
        error: 'UNEXPECTED_FIELD'
      });
    }
  }
  
  if (error.message) {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: 'FILE_FILTER_ERROR'
    });
  }
  
  next(error);
};

// ===============================
// 📌 File Cleanup Utility
// ===============================
const cleanupFiles = (files) => {
  if (!files || !Array.isArray(files)) return;
  
  files.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, (err) => {
        if (err) console.error('Error deleting file:', file.path, err);
      });
    }
  });
};

// ===============================
// 📌 Export Configured Multer Instance
// ===============================
module.exports = upload;
module.exports.handleUploadError = handleUploadError;
module.exports.cleanupFiles = cleanupFiles;

// ===============================
// 📌 Alternative Export Methods for Different Use Cases
// ===============================
module.exports.imageUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 10 } // 10MB, 10 files
});

module.exports.documentUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedDocTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    if (allowedDocTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only document files are allowed'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024, files: 20 } // 50MB, 20 files
});

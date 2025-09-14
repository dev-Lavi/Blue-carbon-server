const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📂 Created directory: ${dirPath}`);
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'uploads/';
    
    // Create different folders based on file type or route
    if (file.fieldname === 'plantationImages') {
      uploadPath = 'uploads/plantation-images/';
    } else if (file.fieldname === 'registrationDoc') {
      uploadPath = 'uploads/registration-docs/';
    } else {
      uploadPath = 'uploads/general/';
    }
    
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    
    // Clean filename - remove special characters
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${file.fieldname}-${uniqueSuffix}-${cleanBaseName}${fileExtension}`);
  }
});

// File filter function for validation
const fileFilter = (req, file, cb) => {
  console.log(`📎 Uploading file: ${file.originalname}, Type: ${file.mimetype}`);
  
  // Define allowed file types based on field name
  const allowedTypes = {
    plantationImages: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    registrationDoc: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    profilePicture: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };

  const fieldAllowedTypes = allowedTypes[file.fieldname] || allowedTypes.documents;
  
  if (fieldAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${fieldAllowedTypes.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Configure multer with enhanced options
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 15, // Maximum 15 files per request
    fields: 10 // Maximum 10 non-file fields
  }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size allowed is 10MB per file.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 15 files allowed per upload.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Please check your form field names.'
      });
    }
  }
  
  if (error && error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

module.exports = {
  upload,
  handleMulterError,
  // Export specific upload configurations for different use cases
  uploadSingle: (fieldName) => upload.single(fieldName),
  uploadArray: (fieldName, maxCount = 10) => upload.array(fieldName, maxCount),
  uploadFields: (fields) => upload.fields(fields),
  uploadAny: () => upload.any(),
  uploadNone: () => upload.none()
};

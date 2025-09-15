const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const Worker = require('../models/Worker');

// ===============================
// 📌 Company Authentication Middleware
// ===============================
exports.companyAuth = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login as a company.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_COMPANY_SECRET || 'company_jwt_secret_key');
      
      // Get company from token
      const company = await Company.findById(decoded.id);
      if (!company) {
        return res.status(401).json({
          success: false,
          message: 'Company not found. Please login again.'
        });
      }

      // Add company to request object
      req.user = company;
      next();

    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// ===============================
// 📌 Worker Authentication Middleware
// ===============================
exports.workerAuth = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login as a worker.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_WORKER_SECRET || 'worker_jwt_secret_key');
      
      // Get worker from token
      const worker = await Worker.findById(decoded.id);
      if (!worker) {
        return res.status(401).json({
          success: false,
          message: 'Worker not found. Please login again.'
        });
      }

      // Add worker to request object
      req.user = worker;
      req.workerType = worker.workerType || 'field_collector';
      next();

    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }

  } catch (error) {
    console.error('Worker auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// ===============================
// 📌 Admin/Government Authentication Middleware
// ===============================
exports.adminAuth = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Admin access required.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET || 'admin_jwt_secret_key');
      
      // Check if user has admin role
      if (decoded.role !== 'admin' && decoded.role !== 'government') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      req.user = decoded;
      next();

    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token.'
      });
    }

  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// ===============================
// 📌 Role-Based Access Control
// ===============================
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Please login to access this resource'
      });
    }

    const userRole = req.user.role || req.workerType || 'user';
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Role '${userRole}' is not authorized to access this resource`
      });
    }

    next();
  };
};

// ===============================
// 📌 Optional Auth (for public + private routes)
// ===============================
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_COMPANY_SECRET || 'company_jwt_secret_key');
        const company = await Company.findById(decoded.id);
        if (company) {
          req.user = company;
        }
      } catch (error) {
        // Token invalid, but continue as guest
      }
    }

    next();
  } catch (error) {
    next();
  }
};

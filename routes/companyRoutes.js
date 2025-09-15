const express = require('express');
const router = express.Router();

// Import controller functions
const {
  getDashboardStats,
  getAllSubmissions,
  getSubmissionById,
  approveSubmission,
  rejectSubmission,
  uploadToBlockchain,
  getBlockchainStatus
} = require('../controllers/companyController');

// Import middleware
const { companyAuth } = require('../middleware/auth');

// ===============================
// 📌 COMPANY DASHBOARD ROUTES
// ===============================

// Get company dashboard statistics
router.get('/dashboard-stats', companyAuth, getDashboardStats);

// Get all submissions from company workers
router.get('/submissions', companyAuth, getAllSubmissions);

// Get specific submission details
router.get('/submissions/:submissionId', companyAuth, getSubmissionById);

// Approve a submission (triggers Pinata upload)
router.post('/submissions/:submissionId/approve', companyAuth, approveSubmission);

// Reject a submission
router.post('/submissions/:submissionId/reject', companyAuth, rejectSubmission);

// Upload approved submission to blockchain
router.post('/submissions/:submissionId/blockchain', companyAuth, uploadToBlockchain);

// Get blockchain upload status
router.get('/submissions/:submissionId/blockchain-status', companyAuth, getBlockchainStatus);

module.exports = router;

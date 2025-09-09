const express = require('express');
const { getPendingCompanies, approveCompany } = require('../controllers/govController');
const authMiddleware = require('../middleware/authMiddleware'); // Gov login protection
const { loginGovUser } = require('../controllers/authController');

const router = express.Router();

// Government-only routes
router.post('/login', loginGovUser);
router.get('/pending', authMiddleware, getPendingCompanies);
router.post('/approve/:id', authMiddleware, approveCompany);

module.exports = router;

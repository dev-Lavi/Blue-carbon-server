const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const companyController = require('../controllers/companyController');

// Send OTP & Save Temporarily
router.post('/send-otp', upload.single('registrationDoc'), companyController.sendOtpAndSaveTemp);

// Verify OTP & Register
router.post('/verify-otp', companyController.verifyOtpAndRegister);

module.exports = router;

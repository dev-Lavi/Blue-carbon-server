const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload1');
const companyController = require('../controllers/companyauth');

// Send OTP & Save Temporarily
router.post('/send-otp', upload.single('registrationDoc'), companyController.sendOtpAndSaveTemp);

// Verify OTP & Register
router.post('/verify-otp', companyController.verifyOtpAndRegister);

router.post('/login', companyController.loginCompany);

module.exports = router;

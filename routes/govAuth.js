const express = require('express');
const { loginGovUser, forgotPasswordGov, resetPasswordGov } = require('../controllers/authController');
const router = express.Router();

router.post('/login', loginGovUser);
router.post('/forgot-password', forgotPasswordGov);
router.post('/reset-password/:token', resetPasswordGov);

module.exports = router;

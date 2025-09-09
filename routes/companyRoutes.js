const express = require('express');
const { registerCompany } = require('../controllers/companyController');
const upload = require('../middleware/upload');

const router = express.Router();

// Company registration with file upload
router.post('/register', upload.single('registrationDoc'), registerCompany);

module.exports = router;

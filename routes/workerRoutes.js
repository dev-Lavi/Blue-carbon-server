const express = require('express');
const { createWorker, getAllWorkers, signinWorker } = require('../controllers/workerController');
const companyAuth = require('../middleware/companyauthmidd');


const router = express.Router();

// ✅ Protected route - only companies can create workers
router.post('/create', companyAuth , createWorker);

// ✅ Fetch All Workers (Protected)
router.get('/all', companyAuth, getAllWorkers);

// ✅ Public - worker login
router.post('/signin', signinWorker);



module.exports = router;

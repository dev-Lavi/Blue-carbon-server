const express = require('express');
const { createWorker, getAllWorkers, signinWorker, uploadPlantationImages  } = require('../controllers/workerController');
const companyAuth = require('../middleware/companyauthmidd');
const multer = require("multer");


const router = express.Router();

// ✅ Protected route - only companies can create workers
router.post('/create', companyAuth , createWorker);

// ✅ Fetch All Workers (Protected)
router.get('/all', companyAuth, getAllWorkers);

// ✅ Public - worker login
router.post('/signin', signinWorker);

// ✅ Worker uploads images for density & carbon credit calculation
const upload = multer({ dest: "uploads/" });
router.post("/upload-images", upload.array("files", 10), uploadPlantationImages);



module.exports = router;

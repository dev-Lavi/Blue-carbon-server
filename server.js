const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');

// ✅ Import all route files with clear names
const companyAuthRoutes = require('./routes/companyauth'); // Company authentication (signup/signin)
const companyDashboardRoutes = require('./routes/companyRoutes'); // Company dashboard & data approval
const govRoutes = require('./routes/govRoutes');
const govAuthRoutes = require('./routes/govAuth');
const workerRoutes = require('./routes/workerRoutes');

dotenv.config();
connectDB();

const app = express();

// ✅ Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("📂 Created 'uploads' folder");
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ✅ CORRECTED: Mount routes with proper paths
// Company Authentication (signup, signin)
app.use('/api/companies/auth', companyAuthRoutes);
console.log("✅ Company Auth routes mounted at /api/companies/auth");

// Company Dashboard & Data Approval Management
app.use('/api/companies', companyDashboardRoutes);
console.log("✅ Company Dashboard routes mounted at /api/companies");

// Worker Routes
app.use('/api/worker', workerRoutes);
console.log("✅ Worker routes mounted at /api/workers");

// Government Routes
app.use('/api/gov', govRoutes);
console.log("✅ Government routes mounted at /api/government");

// Government Authentication
app.use('/api/gov/auth', govAuthRoutes);
console.log("✅ Government Auth routes mounted at /api/government/auth");

// ✅ Add root route
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Blue Carbon API is running!",
    endpoints: {
      companies: {
        auth: "/api/companies/auth",
        dashboard: "/api/companies"
      },
      workers: "/api/workers",
      government: {
        auth: "/api/government/auth",
        dashboard: "/api/government"
      }
    },
    version: "1.0.0"
  });
});

// ✅ API Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Catch-all for unmapped routes
app.use((req, res, next) => {
  console.log(`❌ No route matched: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    message: "Route not found",
    requestedRoute: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      "GET /api/health",
      "POST /api/companies/auth/signup",
      "POST /api/companies/auth/signin", 
      "GET /api/companies/dashboard-stats",
      "GET /api/companies/submissions",
      "POST /api/workers/signin",
      "GET /api/workers/health"
    ]
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API Base URL: http://localhost:${PORT}`);
  console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Company Dashboard: http://localhost:${PORT}/api/companies/dashboard-stats`);
});

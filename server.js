const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');

// Routes
const companyRoutes = require('./routes/companyauth');
const govRoutes = require('./routes/govRoutes');
const govAuthRoutes = require('./routes/govAuth');
const workerRoutes = require('./routes/workerRoutes'); // ✅ Import worker routes

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

// ✅ Mount routes with debug logs
app.use('/api/company', companyRoutes);
console.log("✅ Company routes mounted at /api/company");

app.use('/api/worker', workerRoutes);
console.log("✅ Worker routes mounted at /api/worker");

app.use('/api/gov', govRoutes);
console.log("✅ Gov routes mounted at /api/gov");

app.use('/api/gov/auth', govAuthRoutes);
console.log("✅ Gov Auth routes mounted at /api/gov/auth");

// ✅ Add root route
app.get("/", (req, res) => {
  res.json({ message: "🚀 Blue Carbon API is running!" });
});

// Catch-all for unmapped routes
app.use((req, res, next) => {
  console.log(`❌ No route matched: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

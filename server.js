const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const companyRoutes = require('./routes/companyauth');
const govRoutes = require('./routes/govRoutes');
const govAuthRoutes = require('./routes/govAuth');

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

app.use('/api/company', companyRoutes);
app.use('/api/gov', govRoutes);
app.use('/api/gov/auth', govAuthRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

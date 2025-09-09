const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const companyRoutes = require('./routes/companyRoutes');
const govRoutes = require('./routes/govRoutes');

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/company', companyRoutes);
app.use('/api/gov', govRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

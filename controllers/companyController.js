const TempCompany = require('../models/TempCompany');
const PendingCompany = require('../models/PendingCompany');
const sendEmail = require('../utils/sendEmail');

// 📌 1. Send OTP + Save Company Temporarily
exports.sendOtpAndSaveTemp = async (req, res) => {
  try {
    const {
      companyName, email, password, phone, type,
      registrationNumber, PAN, GSTIN, address, state, city,
      pin, industryType, annualCarbonEmission, website
    } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Prevent duplicate email in TempCompany
    const existing = await TempCompany.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    // Registration document upload
    const registrationDoc = req.file ? req.file.path : null;

    const companyData = {
      companyName, email, password, phone, type,
      registrationNumber, PAN, GSTIN, address, state, city,
      pin, industryType, annualCarbonEmission, website, registrationDoc
    };

    // Delete any old pending record
    await PendingCompany.findOneAndDelete({ email });

    // Save in PendingCompany
    const pending = new PendingCompany({
      companyData,
      email,
      otp,
      otpExpires
    });
    await pending.save();

    // Send OTP
    await sendEmail(
    email,
   'Verify Your Email - Blue Carbon',
   `Your OTP is ${otp}. It will expire in 10 minutes.`
);

    res.status(200).json({ message: 'OTP sent to email. Please verify.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending OTP', error });
  }
};

// 📌 2. Verify OTP and Move to TempCompany
exports.verifyOtpAndRegister = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const pending = await PendingCompany.findOne({ email });
    if (!pending) {
      return res.status(404).json({ message: 'No pending registration found for this email' });
    }

    if (pending.otp !== otp || pending.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Move data to TempCompany
    const company = new TempCompany(pending.companyData);
    await company.save();

    // Delete pending record
    await PendingCompany.deleteOne({ email });

    res.status(201).json({ message: 'Email verified. Company registered and pending government approval.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error verifying OTP', error });
  }
};

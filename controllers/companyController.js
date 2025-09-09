const TempCompany = require('../models/TempCompany');

// Register Company (saved in TempCompany)
exports.registerCompany = async (req, res) => {
  try {
    const {
      companyName, email, password, phone, type,
      registrationNumber, PAN, GSTIN, address, state, city,
      pin, industryType, annualCarbonEmission, website
    } = req.body;

    const registrationDoc = req.file ? req.file.path : null;

    const company = new TempCompany({
      companyName, email, password, phone, type,
      registrationNumber, PAN, GSTIN, address, state, city,
      pin, industryType, annualCarbonEmission, website,
      registrationDoc
    });

    await company.save();
    res.status(201).json({ message: 'Company registered. Awaiting approval.' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering company', error });
  }
};

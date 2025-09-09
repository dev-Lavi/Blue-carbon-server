const TempCompany = require('../models/TempCompany');
const Company = require('../models/Company');

// Get all pending approvals
exports.getPendingCompanies = async (req, res) => {
  try {
    const companies = await TempCompany.find();
    res.status(200).json(companies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending companies', error });
  }
};

// Approve a company
exports.approveCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const tempCompany = await TempCompany.findById(id);

    if (!tempCompany) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Move data to Company collection
    const approvedCompany = new Company(tempCompany.toObject());
    await approvedCompany.save();

    // Remove from TempCompany
    await TempCompany.findByIdAndDelete(id);

    res.status(200).json({ message: 'Company approved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error approving company', error });
  }
};

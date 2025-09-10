const TempCompany = require('../models/TempCompany');
const Company = require('../models/Company');
const sendEmail = require('../utils/sendEmail'); 

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

    // Convert mongoose doc to plain object
    const companyData = tempCompany.toObject();
    delete companyData._id;   // remove old _id so MongoDB generates a new one
    delete companyData.__v;   // optional: remove version key

    // Create and save approved company
    const approvedCompany = new Company({ ...companyData });
    await approvedCompany.save();

    // Remove from TempCompany
    await TempCompany.findByIdAndDelete(id);

      // 📧 Send Approval Email
    await sendEmail(
      tempCompany.email,
      'Your Company Has Been Approved - Blue Carbon',
      `Hello ${tempCompany.companyName},\n\nYour company registration has been approved by the Blue Carbon team. You can now log in to your account using your registered email and password to access our services.\n\nWelcome aboard!\n\n- Blue Carbon Team`
    );

    res.status(200).json({
      message: 'Company approved successfully',
      company: approvedCompany,
    });
  } catch (error) {
    console.error("Error approving company:", error);
    res.status(500).json({ message: 'Error approving company', error });
  }
};



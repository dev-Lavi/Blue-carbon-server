const DataApproval = require('../models/DataApproval');
const Worker = require('../models/Worker');
const Company = require('../models/Company');
const axios = require('axios'); // For blockchain integration

// Get all pending approvals for government dashboard
exports.getPendingApprovals = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 10 } = req.query;
    
    const approvals = await DataApproval.find({ status })
      .populate('workerId', 'name email workerId')
      .populate('companyId', 'companyName email')
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DataApproval.countDocuments({ status });

    res.json({
      success: true,
      data: {
        approvals,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error("Error fetching approvals:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending approvals"
    });
  }
};

// Get single approval details
exports.getApprovalDetails = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const approval = await DataApproval.findOne({ submissionId })
      .populate('workerId', 'name email workerId phone designation')
      .populate('companyId', 'companyName email address city state')
      .populate('reviewedBy', 'name email');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    res.json({
      success: true,
      data: { approval }
    });

  } catch (error) {
    console.error("Error fetching approval details:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch approval details"
    });
  }
};

// Approve submission and store on blockchain
exports.approveSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { reviewComments } = req.body;
    const govUserId = req.user.id; // From government auth middleware

    // Find the submission
    const approval = await DataApproval.findOne({ submissionId });
    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    if (approval.status !== 'pending' && approval.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        message: "This submission has already been processed"
      });
    }

    // Step 1: Store on blockchain (replace with your blockchain integration)
    let blockchainTxHash = null;
    let ipfsHash = null;

    try {
      // Example blockchain storage call - replace with your actual implementation
      const blockchainData = {
        submissionId: approval.submissionId,
        carbonCredits: approval.carbonCredits,
        meanDensity: approval.meanDensity,
        location: approval.location,
        plantationType: approval.plantationType,
        timestamp: new Date().toISOString()
      };

      // Replace this with your actual blockchain integration
      // const blockchainResponse = await axios.post('YOUR_BLOCKCHAIN_API', blockchainData);
      // blockchainTxHash = blockchainResponse.data.txHash;
      
      // Replace with your IPFS integration
      // const ipfsResponse = await axios.post('YOUR_IPFS_API', approval.plantationImages);
      // ipfsHash = ipfsResponse.data.hash;

      // For now, generate mock hashes (remove this in production)
      blockchainTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      ipfsHash = `Qm${Math.random().toString(36).substr(2, 44)}`;

    } catch (blockchainError) {
      console.error("Blockchain storage error:", blockchainError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to store data on blockchain"
      });
    }

    // Step 2: Update approval status
    approval.status = 'approved';
    approval.reviewedBy = govUserId;
    approval.reviewDate = new Date();
    approval.reviewComments = reviewComments;
    approval.blockchainTxHash = blockchainTxHash;
    approval.ipfsHash = ipfsHash;
    approval.isStoredOnBlockchain = true;
    approval.blockchainStoredAt = new Date();

    await approval.save();

    res.json({
      success: true,
      message: "Submission approved and stored on blockchain successfully",
      data: {
        submissionId: approval.submissionId,
        carbonCredits: approval.carbonCredits,
        blockchainTxHash,
        ipfsHash,
        approvedAt: approval.reviewDate
      }
    });

  } catch (error) {
    console.error("Error approving submission:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to approve submission"
    });
  }
};

// Reject submission
exports.rejectSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { rejectionReason, reviewComments } = req.body;
    const govUserId = req.user.id;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required"
      });
    }

    const approval = await DataApproval.findOneAndUpdate(
      { submissionId },
      {
        status: 'rejected',
        reviewedBy: govUserId,
        reviewDate: new Date(),
        rejectionReason,
        reviewComments
      },
      { new: true }
    );

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    res.json({
      success: true,
      message: "Submission rejected successfully",
      data: {
        submissionId: approval.submissionId,
        status: 'rejected',
        rejectionReason,
        reviewDate: approval.reviewDate
      }
    });

  } catch (error) {
    console.error("Error rejecting submission:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to reject submission"
    });
  }
};

// Get approval statistics for dashboard
exports.getApprovalStats = async (req, res) => {
  try {
    const stats = await DataApproval.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCarbonCredits: { $sum: '$carbonCredits' }
        }
      }
    ]);

    const totalSubmissions = await DataApproval.countDocuments();
    const approvedSubmissions = await DataApproval.countDocuments({ status: 'approved' });

    res.json({
      success: true,
      data: {
        totalSubmissions,
        approvedSubmissions,
        statusBreakdown: stats,
        approvalRate: totalSubmissions > 0 ? (approvedSubmissions / totalSubmissions * 100).toFixed(2) : 0
      }
    });

  } catch (error) {
    console.error("Error fetching approval stats:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch approval statistics"
    });
  }
};

module.exports = {
  getPendingApprovals,
  getApprovalDetails,
  approveSubmission,
  rejectSubmission,
  getApprovalStats
};

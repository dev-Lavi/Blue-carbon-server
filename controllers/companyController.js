const DataApproval = require('../models/DataApproval');
const Worker = require('../models/Worker');
const Company = require('../models/Company');
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { ethers } = require('ethers');

// ===============================
// 📌 DASHBOARD STATISTICS
// ===============================
exports.getDashboardStats = async (req, res) => {
  try {
    const companyId = req.user.id;
    console.log('📊 Fetching dashboard stats for company:', companyId);

    // ✅ FIXED: Use new mongoose.Types.ObjectId() or just use string comparison
    const stats = await DataApproval.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId) } }, // ✅ FIXED: Added 'new'
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCarbonCredits: { $sum: '$carbonCredits' }
        }
      }
    ]);

    // Get worker count
    const workerCount = await Worker.countDocuments({ companyId });

    // Get recent submissions
    const recentSubmissions = await DataApproval.find({ companyId })
      .populate('workerId', 'name email workerType')
      .sort({ submittedAt: -1 })
      .limit(5);

    // Format statistics
    const formattedStats = {
      totalWorkers: workerCount,
      submissions: {
        total: 0,
        pending: 0,
        company_approved: 0,
        approved: 0,
        rejected: 0,
        under_review: 0
      },
      carbonCredits: {
        total: 0,
        approved: 0,
        pending: 0
      },
      recentSubmissions: recentSubmissions.map(sub => ({
        submissionId: sub.submissionId,
        workerName: sub.workerId?.name || 'Unknown Worker',
        ecosystemType: sub.ecosystemType,
        status: sub.status,
        carbonCredits: sub.carbonCredits || 0,
        submittedAt: sub.submittedAt
      }))
    };

    stats.forEach(stat => {
      formattedStats.submissions.total += stat.count;
      formattedStats.submissions[stat._id] = stat.count || 0;
      formattedStats.carbonCredits.total += stat.totalCarbonCredits || 0;
      
      if (stat._id === 'approved') {
        formattedStats.carbonCredits.approved += stat.totalCarbonCredits || 0;
      } else {
        formattedStats.carbonCredits.pending += stat.totalCarbonCredits || 0;
      }
    });

    console.log('✅ Dashboard stats calculated successfully');

    res.json({
      success: true,
      data: formattedStats
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// 📌 GET ALL SUBMISSIONS
// ===============================
exports.getAllSubmissions = async (req, res) => {
  try {
    const companyId = req.user.id;
    const { status, ecosystemType, page = 1, limit = 10 } = req.query;

    // Build query filters
    const query = { companyId };
    if (status) query.status = status;
    if (ecosystemType) query.ecosystemType = ecosystemType;

    // Pagination
    const skip = (page - 1) * limit;

    const submissions = await DataApproval.find(query)
      .populate('workerId', 'name email workerId workerType')
      .populate('governmentReview.reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalSubmissions = await DataApproval.countDocuments(query);

    // Transform submissions for frontend
    const transformedSubmissions = submissions.map(submission => ({
      submissionId: submission.submissionId,
      worker: {
        name: submission.workerId?.name,
        email: submission.workerId?.email,
        workerId: submission.workerId?.workerId,
        type: submission.workerId?.workerType
      },
      ecosystemType: submission.ecosystemType,
      status: submission.status,
      carbonCredits: submission.carbonCredits,
      location: submission.location,
      areaSize: submission.areaSize,
      submittedAt: submission.submittedAt,
      
      // Seagrass specific data
      seagrassData: submission.seagrassResearchData,
      
      // Documents/Images count
      documentsCount: submission.seagrassDocs?.length || submission.plantationImages?.length || 0,
      
      // Approval status
      companyApproved: submission.companyApproval?.approved || false,
      governmentApproved: submission.governmentReview?.approved || false,
      
      // Blockchain status
      onBlockchain: submission.blockchain?.isStored || false,
      blockchainHash: submission.blockchain?.txHash,
      
      // Area occupation
      occupiedUntil: submission.occupiedUntil,
      isOccupied: submission.occupiedUntil > new Date()
    }));

    res.json({
      success: true,
      data: {
        submissions: transformedSubmissions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalSubmissions / limit),
          totalSubmissions,
          hasNext: page * limit < totalSubmissions,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions'
    });
  }
};

// ===============================
// 📌 GET SUBMISSION BY ID
// ===============================
exports.getSubmissionById = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const companyId = req.user.id;

    const submission = await DataApproval.findOne({ submissionId, companyId })
      .populate('workerId', 'name email workerId workerType assignedAreas')
      .populate('governmentReview.reviewedBy', 'name email')
      .populate('companyId', 'companyName email');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or unauthorized'
      });
    }

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Get submission by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission details'
    });
  }
};

// ===============================
// 📌 APPROVE SUBMISSION (with Pinata Upload)
// ===============================
exports.approveSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    // ✅ Safe version that handles undefined req.body
const approvalComments = req.body && req.body.approvalComments ? req.body.approvalComments : '';
    const companyId = req.user.id;

    const submission = await DataApproval.findOne({ submissionId, companyId });
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or unauthorized'
      });
    }

    if (submission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Submission is not in pending state'
      });
    }

    // ===============================
    // 📌 UPLOAD TO PINATA
    // ===============================
    let pinataHash = null;
    try {
      // Prepare data for Pinata
      const pinataData = {
        submissionId: submission.submissionId,
        companyId: submission.companyId,
        workerId: submission.workerId,
        ecosystemType: submission.ecosystemType,
        carbonCredits: submission.carbonCredits,
        location: submission.location,
        seagrassData: submission.seagrassResearchData,
        approvedAt: new Date().toISOString(),
        approvedBy: companyId
      };

      // Upload to Pinata
      const pinataResponse = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          pinataContent: pinataData,
          pinataMetadata: {
            name: `BlueCarbon-${submissionId}`,
            keyvalues: {
              submissionId: submissionId,
              ecosystemType: submission.ecosystemType,
              company: req.user.companyName || 'BlueCarbon'
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'pinata_api_key': process.env.PINATA_API_KEY,
            'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
          }
        }
      );

      pinataHash = pinataResponse.data.IpfsHash;
      console.log('✅ Data uploaded to Pinata:', pinataHash);

    } catch (pinataError) {
      console.error('❌ Pinata upload failed:', pinataError.message);
      // Continue with approval even if Pinata fails
    }

    // ===============================
    // 📌 UPDATE SUBMISSION STATUS
    // ===============================
    submission.companyApproval = {
      approvedBy: companyId,
      approvedAt: new Date(),
      approvalComments: approvalComments || '',
      approved: true
    };
    submission.status = 'company_approved';
    
    // Store Pinata hash if successful
    if (pinataHash) {
      submission.blockchain = {
        ...submission.blockchain,
        ipfsHash: pinataHash
      };
    }

    // Add audit trail
    await submission.addAuditEntry(
      'company_approved', 
      companyId, 
      'Company', 
      approvalComments || 'Approved by company dashboard'
    );

    await submission.save();

    // ===============================
    // 📌 UPDATE COMPANY STATS
    // ===============================
    await Company.findByIdAndUpdate(companyId, {
      $inc: {
        'businessMetrics.approvedSubmissions': 1
      }
    });

    res.json({
      success: true,
      message: 'Submission approved successfully',
      data: {
        submissionId: submission.submissionId,
        status: submission.status,
        carbonCredits: submission.carbonCredits,
        pinataHash: pinataHash,
        approvedAt: submission.companyApproval.approvedAt,
        nextStep: 'Ready for blockchain upload'
      }
    });

  } catch (error) {
    console.error('Approve submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve submission'
    });
  }
};

// ===============================
// 📌 REJECT SUBMISSION
// ===============================
exports.rejectSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { rejectionReason } = req.body;
    const companyId = req.user.id;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const submission = await DataApproval.findOne({ submissionId, companyId });
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or unauthorized'
      });
    }

    submission.status = 'rejected';
    submission.governmentReview = {
      ...submission.governmentReview,
      rejectionReason: rejectionReason,
      reviewDate: new Date()
    };

    await submission.addAuditEntry(
      'company_rejected',
      companyId,
      'Company',
      rejectionReason
    );

    await submission.save();

    res.json({
      success: true,
      message: 'Submission rejected',
      data: {
        submissionId: submission.submissionId,
        status: submission.status,
        rejectionReason: rejectionReason
      }
    });

  } catch (error) {
    console.error('Reject submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject submission'
    });
  }
};

// ===============================
// 📌 UPLOAD TO BLOCKCHAIN
// ===============================
exports.uploadToBlockchain = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const companyId = req.user.id;

    const submission = await DataApproval.findOne({ submissionId, companyId });
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or unauthorized'
      });
    }

    if (submission.status !== 'company_approved') {
      return res.status(400).json({
        success: false,
        message: 'Submission must be company approved first'
      });
    }

    if (!submission.blockchain?.ipfsHash) {
      return res.status(400).json({
        success: false,
        message: 'No IPFS hash found. Please approve submission first.'
      });
    }

    // ===============================
    // 📌 BLOCKCHAIN UPLOAD (Example with Ethereum)
    // ===============================
    try {
      // Initialize provider and wallet
      const provider = new ethers.providers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

      // Your smart contract ABI and address
      const contractABI = [
        "function storeSubmission(string calldata submissionId, string calldata ipfsHash, uint256 carbonCredits) external returns (bool)"
      ];
      const contractAddress = process.env.CARBON_CONTRACT_ADDRESS;
      const contract = new ethers.Contract(contractAddress, contractABI, wallet);

      // Execute blockchain transaction
      const tx = await contract.storeSubmission(
        submission.submissionId,
        submission.blockchain.ipfsHash,
        ethers.utils.parseUnits(submission.carbonCredits.toString(), 18)
      );

      console.log('🔗 Blockchain transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Blockchain transaction confirmed:', receipt.transactionHash);

      // Update submission with blockchain data
      submission.blockchain = {
        ...submission.blockchain,
        txHash: receipt.transactionHash,
        isStored: true,
        storedAt: new Date(),
        networkUsed: 'ethereum' // or 'polygon', etc.
      };

      submission.status = 'approved'; // Final approval status

      await submission.addAuditEntry(
        'stored_on_blockchain',
        'system',
        'System',
        `Stored on blockchain with hash: ${receipt.transactionHash}`
      );

      await submission.save();

      res.json({
        success: true,
        message: 'Submission stored on blockchain successfully',
        data: {
          submissionId: submission.submissionId,
          blockchainHash: receipt.transactionHash,
          ipfsHash: submission.blockchain.ipfsHash,
          carbonCredits: submission.carbonCredits,
          status: submission.status
        }
      });

    } catch (blockchainError) {
      console.error('❌ Blockchain upload failed:', blockchainError);
      
      res.status(500).json({
        success: false,
        message: 'Blockchain upload failed',
        error: blockchainError.message
      });
    }

  } catch (error) {
    console.error('Upload to blockchain error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload to blockchain'
    });
  }
};

// ===============================
// 📌 GET BLOCKCHAIN STATUS
// ===============================
exports.getBlockchainStatus = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const companyId = req.user.id;

    const submission = await DataApproval.findOne({ submissionId, companyId });
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      data: {
        submissionId: submission.submissionId,
        blockchain: submission.blockchain || {},
        status: submission.status,
        readyForBlockchain: submission.status === 'company_approved' && submission.blockchain?.ipfsHash,
        onBlockchain: submission.blockchain?.isStored || false
      }
    });

  } catch (error) {
    console.error('Get blockchain status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get blockchain status'
    });
  }
};



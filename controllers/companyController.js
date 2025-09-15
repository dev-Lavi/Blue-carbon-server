const DataApproval = require('../models/DataApproval');
const Worker = require('../models/Worker');
const Company = require('../models/Company');
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// ✅ FIXED: Proper ethers import with error handling
let ethers;
try {
  ethers = require('ethers');
  console.log('✅ Ethers.js v' + ethers.version + ' loaded successfully');
} catch (error) {
  console.warn('⚠️ Ethers.js not available:', error.message);
  ethers = null;
} 
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
    const approvalComments = req.body && req.body.approvalComments ? req.body.approvalComments : '';
    const companyId = req.user.id;

    console.log('✅ Approve request received:', { submissionId, companyId });

    const submission = await DataApproval.findOne({ submissionId, companyId })
      .populate('companyId', 'companyName walletAddress email registrationNumber type');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or unauthorized'
      });
    }

    if (submission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Submission is not in pending state. Current status: ${submission.status}`
      });
    }

    // ===============================
    // 📌 UPLOAD ESSENTIAL DATA TO PINATA
    // ===============================
    let pinataHash = null;
    try {
      // Prepare LEAN but essential data for IPFS
      const pinataData = {
        // ✅ Submission essentials
        id: submission.submissionId,
        ecosystem: submission.ecosystemType,
        credits: submission.carbonCredits,
        area: submission.areaSize,
        
        // ✅ Company details (FOCUS)
        company: {
          name: submission.companyId.companyName,
          wallet: submission.companyId.walletAddress,
          email: submission.companyId.email,
          registration: submission.companyId.registrationNumber,
          type: submission.companyId.type
        },

        // ✅ Location (essential for verification)
        location: `${submission.location.areaName} (${submission.location.latitude}, ${submission.location.longitude})`,

        // ✅ Key research data (if seagrass)
        data: submission.seagrassResearchData ? {
          species: submission.seagrassResearchData.species,
          height: submission.seagrassResearchData.height,
          density: submission.seagrassResearchData.density,
          organicCarbon: submission.seagrassResearchData.organicCarbonStock,
          methodology: submission.seagrassResearchData.researchMethodology
        } : {
          densities: submission.individualDensities,
          meanDensity: submission.meanDensity
        },

        // ✅ File summary (NOT full file data)
        files: {
          count: (submission.seagrassDocs?.length || 0) + (submission.plantationImages?.length || 0),
          types: [
            ...(submission.seagrassDocs?.map(doc => doc.docType) || []),
            ...(submission.plantationImages?.length > 0 ? ['plantation_images'] : [])
          ],
          mainDoc: submission.seagrassDocs?.[0]?.originalName || submission.plantationImages?.[0]?.originalName || 'N/A'
        },

        // ✅ Verification
        approved: {
          at: new Date().toISOString(),
          by: "Company Dashboard",
          comments: approvalComments || "Approved for carbon credits"
        },

        // ✅ Carbon breakdown (if available)
        carbon: submission.seagrassResearchData?.carbonBreakdown || null
      };

      console.log('📤 Uploading lean data to Pinata...');
      console.log('📊 Data size:', JSON.stringify(pinataData).length, 'characters');

      // Upload to Pinata
      const pinataResponse = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          pinataContent: pinataData,
          pinataMetadata: {
            name: `Credit-${submissionId}`,
            keyvalues: {
              submission: submissionId,
              company: submission.companyId.companyName.substring(0, 10),
              credits: submission.carbonCredits.toString()
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'pinata_api_key': process.env.PINATA_API_KEY,
            'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
          },
          timeout: 15000 // 15 second timeout
        }
      );

      pinataHash = pinataResponse.data.IpfsHash;
      console.log('✅ Lean data uploaded to Pinata:', pinataHash);

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
      approvalComments: approvalComments,
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
    try {
      if (typeof submission.addAuditEntry === 'function') {
        await submission.addAuditEntry(
          'company_approved',
          companyId,
          'Company',
          approvalComments || 'Approved by company dashboard'
        );
      }
    } catch (auditError) {
      console.warn('⚠️ Audit trail update failed:', auditError.message);
    }

    await submission.save();

    // ===============================
    // 📌 UPDATE COMPANY STATS
    // ===============================
    await Company.findByIdAndUpdate(companyId, {
      $inc: {
        'businessMetrics.approvedSubmissions': 1,
        'businessMetrics.totalCarbonCredits': submission.carbonCredits
      }
    });

    console.log('✅ Submission approved successfully');

    res.json({
      success: true,
      message: 'Submission approved and essential data stored on IPFS',
      data: {
        submissionId: submission.submissionId,
        status: submission.status,
        carbonCredits: submission.carbonCredits,
        ecosystemType: submission.ecosystemType,
        ipfsHash: pinataHash,
        ipfsUrl: pinataHash ? `https://gateway.pinata.cloud/ipfs/${pinataHash}` : null,
        approvedAt: submission.companyApproval.approvedAt,
        filesIncluded: (submission.seagrassDocs?.length || 0) + (submission.plantationImages?.length || 0),
        nextStep: pinataHash ? 'Ready for blockchain upload' : 'Ready for government review'
      }
    });

  } catch (error) {
    console.error('Approve submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve submission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    console.log('🔗 Starting blockchain upload for:', submissionId);

    // Get submission with company details
    const submission = await DataApproval.findOne({ submissionId, companyId })
      .populate('companyId', 'companyName walletAddress');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or unauthorized'
      });
    }

    if (submission.status !== 'company_approved') {
      return res.status(400).json({
        success: false,
        message: `Submission must be company approved first. Current status: ${submission.status}`
      });
    }

    if (!submission.blockchain?.ipfsHash) {
      return res.status(400).json({
        success: false,
        message: 'No IPFS hash found. Please approve submission first to upload data to Pinata.'
      });
    }

    // Check if company has wallet address
    if (!submission.companyId.walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Company wallet not connected. Please connect MetaMask wallet first.',
        action: 'Connect wallet on company dashboard'
      });
    }

    // Check if ethers is available
    if (!ethers) {
      return res.status(503).json({
        success: false,
        message: 'Blockchain functionality not available. Please install ethers.js'
      });
    }

    // ===============================
    // 📌 BLOCKCHAIN UPLOAD (Updated for your contract)
    // ===============================
    try {
      console.log('🔗 Connecting to blockchain...');
      
      // Initialize provider and wallet
      const provider = new ethers.providers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

      // Check wallet balance
      const balance = await wallet.getBalance();
      console.log('💰 Admin wallet balance:', ethers.utils.formatEther(balance), 'ETH');

      if (balance.lt(ethers.utils.parseEther('0.001'))) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance for blockchain transaction. Need at least 0.001 ETH for gas fees.'
        });
      }

      // ✅ Updated ABI for your enhanced contract
      const contractABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "id",
				"type": "string"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "company",
				"type": "address"
			}
		],
		"name": "CreditDeactivated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "id",
				"type": "string"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "company",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "ipfs",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint32",
				"name": "timestamp",
				"type": "uint32"
			}
		],
		"name": "CreditIssued",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "companyCredits",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "companyTotal",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "credits",
		"outputs": [
			{
				"internalType": "string",
				"name": "id",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "company",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "ipfs",
				"type": "string"
			},
			{
				"internalType": "uint32",
				"name": "timestamp",
				"type": "uint32"
			},
			{
				"internalType": "bool",
				"name": "active",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_id",
				"type": "string"
			}
		],
		"name": "deactivateCredit",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "exists",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_company",
				"type": "address"
			}
		],
		"name": "getCompanyCredits",
		"outputs": [
			{
				"internalType": "string[]",
				"name": "",
				"type": "string[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_company",
				"type": "address"
			}
		],
		"name": "getCompanyTotal",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getContractStats",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "_totalCredits",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_totalSubmissions",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_owner",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_id",
				"type": "string"
			}
		],
		"name": "getCredit",
		"outputs": [
			{
				"components": [
					{
						"internalType": "string",
						"name": "id",
						"type": "string"
					},
					{
						"internalType": "address",
						"name": "company",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "ipfs",
						"type": "string"
					},
					{
						"internalType": "uint32",
						"name": "timestamp",
						"type": "uint32"
					},
					{
						"internalType": "bool",
						"name": "active",
						"type": "bool"
					}
				],
				"internalType": "struct CarbonRegistry.Credit",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_id",
				"type": "string"
			}
		],
		"name": "getCreditFormatted",
		"outputs": [
			{
				"internalType": "string",
				"name": "id",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "company",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "formattedAmount",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "ipfs",
				"type": "string"
			},
			{
				"internalType": "uint32",
				"name": "timestamp",
				"type": "uint32"
			},
			{
				"internalType": "bool",
				"name": "active",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_id",
				"type": "string"
			}
		],
		"name": "isCreditActive",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_id",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_amount",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "_ipfs",
				"type": "string"
			}
		],
		"name": "issueCredit",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalCredits",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalSubmissions",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];

      const contract = new ethers.Contract(process.env.CARBON_CONTRACT_ADDRESS, contractABI, wallet);

      // Check if credit already exists on blockchain
      const existsOnChain = await contract.exists(submission.submissionId);
      if (existsOnChain) {
        return res.status(400).json({
          success: false,
          message: 'Carbon credit already exists on blockchain',
          submissionId: submission.submissionId
        });
      }

      // ✅ Prepare transaction data for your contract
      // Convert carbon credits to integer (496.63 → 49663)
      const carbonCreditsFormatted = Math.round(submission.carbonCredits * 100);
      
      console.log('📤 Preparing blockchain transaction...');
      console.log('   - Submission ID:', submission.submissionId);
      console.log('   - Carbon Credits:', carbonCreditsFormatted, '(', submission.carbonCredits, '* 100)');
      console.log('   - IPFS Hash:', submission.blockchain.ipfsHash);
      console.log('   - Company Wallet:', submission.companyId.walletAddress);

      // Estimate gas first
      const gasEstimate = await contract.estimateGas.issueCredit(
        submission.submissionId,
        carbonCreditsFormatted,
        submission.blockchain.ipfsHash
      );

      console.log('⛽ Estimated gas:', gasEstimate.toString());

      // Execute blockchain transaction
      const tx = await contract.issueCredit(
        submission.submissionId,
        carbonCreditsFormatted,
        submission.blockchain.ipfsHash,
        {
          gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
          gasPrice: ethers.utils.parseUnits('20', 'gwei') // 20 gwei
        }
      );

      console.log('🔗 Blockchain transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
      console.log('⛽ Gas used:', receipt.gasUsed.toString());

      // Calculate gas cost
      // ✅ FIXED: Handle EIP-1559 gas pricing properly
let gasCostWei, gasCostEth;
try {
  // Use effectiveGasPrice from receipt (EIP-1559) or fallback to tx.gasPrice
  const gasPrice = receipt.effectiveGasPrice || tx.gasPrice || ethers.utils.parseUnits('20', 'gwei');
  gasCostWei = receipt.gasUsed.mul(gasPrice);
  gasCostEth = ethers.utils.formatEther(gasCostWei);
  console.log('💰 Gas cost:', gasCostEth, 'ETH');
} catch (gasError) {
  console.warn('⚠️ Could not calculate gas cost:', gasError.message);
  gasCostEth = 'Unknown';
}

      console.log('💰 Gas cost:', gasCostEth, 'ETH');

      // Verify the credit was created
      const creditOnChain = await contract.getCredit(submission.submissionId);
      console.log('🔍 Verified on blockchain:', {
        id: creditOnChain.id,
        company: creditOnChain.company,
        amount: creditOnChain.amount.toString(),
        active: creditOnChain.active
      });

      // ✅ Update submission with blockchain data
      submission.blockchain = {
        ...submission.blockchain,
        txHash: receipt.transactionHash,
        isStored: true,
        storedAt: new Date(),
        networkUsed: 'sepolia', // or whatever network you're using
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasCost: gasCostEth
      };

      submission.status = 'approved'; // Final approval status

      // Add audit trail
      if (typeof submission.addAuditEntry === 'function') {
        await submission.addAuditEntry(
          'stored_on_blockchain',
          null,
          'System',
          `Carbon credit issued on blockchain. TX: ${receipt.transactionHash}`
        );
      }

      await submission.save();

      // ✅ Update company blockchain stats
      await Company.findByIdAndUpdate(companyId, {
        $inc: {
          'blockchainStats.totalSubmissions': 1,
          'blockchainStats.totalCarbonCredits': submission.carbonCredits
        },
        'blockchainStats.lastBlockchainActivity': new Date(),
        'activityLog.lastBlockchainUpload': new Date()
      });

      // ✅ Success response
      res.json({
        success: true,
        message: 'Carbon credit successfully issued on blockchain',
        data: {
          submissionId: submission.submissionId,
          carbonCredits: submission.carbonCredits,
          ecosystemType: submission.ecosystemType,
          
          // Blockchain details
          blockchain: {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            network: 'sepolia',
            gasUsed: receipt.gasUsed.toString(),
            gasCost: gasCostEth + ' ETH'
          },
          
          // Company details
          company: {
            name: submission.companyId.companyName,
            wallet: submission.companyId.walletAddress
          },
          
          // IPFS details
          ipfs: {
            hash: submission.blockchain.ipfsHash,
            url: `https://gateway.pinata.cloud/ipfs/${submission.blockchain.ipfsHash}`
          },
          
          // Verification links
          links: {
            explorer: `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`,
            ipfsGateway: `https://gateway.pinata.cloud/ipfs/${submission.blockchain.ipfsHash}`
          },
          
          status: submission.status,
          completedAt: new Date().toISOString()
        }
      });

    } catch (blockchainError) {
      console.error('❌ Blockchain transaction failed:', blockchainError);
      
      // Handle specific errors
      let errorMessage = 'Blockchain transaction failed';
      let errorCode = 'BLOCKCHAIN_ERROR';
      
      if (blockchainError.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'Insufficient funds for gas fees';
        errorCode = 'INSUFFICIENT_FUNDS';
      } else if (blockchainError.code === 'NETWORK_ERROR') {
        errorMessage = 'Blockchain network connection failed';
        errorCode = 'NETWORK_ERROR';
      } else if (blockchainError.reason) {
        errorMessage = `Smart contract error: ${blockchainError.reason}`;
        errorCode = 'CONTRACT_ERROR';
      }
      
      res.status(500).json({
        success: false,
        message: errorMessage,
        errorCode: errorCode,
        error: process.env.NODE_ENV === 'development' ? blockchainError.message : undefined,
        debug: {
          submissionId: submission.submissionId,
          hasIPFS: !!submission.blockchain?.ipfsHash,
          companyWallet: submission.companyId.walletAddress
        }
      });
    }

  } catch (error) {
    console.error('Upload to blockchain error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload to blockchain',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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



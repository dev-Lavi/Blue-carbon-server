const express = require('express');
const router = express.Router();

// Import controller functions
const {
  getDashboardStats,
  getAllSubmissions,
  getSubmissionById,
  approveSubmission,
  rejectSubmission,
  uploadToBlockchain,
  getBlockchainStatus
} = require('../controllers/companyController');

// Import middleware
const { companyAuth } = require('../middleware/auth');

// Import Company model for wallet routes
const Company = require('../models/Company');

// ===============================
// 📌 COMPANY DASHBOARD ROUTES
// ===============================

// Get company dashboard statistics
router.get('/dashboard-stats', companyAuth, getDashboardStats);

// Get all submissions from company workers
router.get('/submissions', companyAuth, getAllSubmissions);

// Get specific submission details
router.get('/submissions/:submissionId', companyAuth, getSubmissionById);

// Approve a submission (triggers Pinata upload)
router.post('/submissions/:submissionId/approve', companyAuth, approveSubmission);

// Reject a submission
router.post('/submissions/:submissionId/reject', companyAuth, rejectSubmission);

// Upload approved submission to blockchain
router.post('/submissions/:submissionId/blockchain', companyAuth, uploadToBlockchain);

// Get blockchain upload status
router.get('/submissions/:submissionId/blockchain-status', companyAuth, getBlockchainStatus);

// ===============================
// 📌 WALLET MANAGEMENT ROUTES
// ===============================

// Connect/Update wallet address
router.post('/connect-wallet', companyAuth, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const companyId = req.user.id;

    console.log('🔗 Wallet connection request:', { companyId, walletAddress });

    // Validate required fields
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format. Must be 42 characters starting with 0x'
      });
    }

    // Get company
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if wallet is already used by another company
    const existingCompany = await Company.findOne({
      walletAddress: walletAddress,
      _id: { $ne: companyId }
    });

    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message: 'This wallet address is already registered to another company',
        conflictCompany: existingCompany.companyName
      });
    }

    // Update wallet using the model method
    try {
      await company.updateWallet(walletAddress);
      
      console.log('✅ Wallet connected successfully');

      res.json({
        success: true,
        message: 'Wallet connected successfully',
        data: {
          walletAddress: company.walletAddress,
          walletShort: company.walletShort,
          walletConnectedAt: company.walletConnectedAt,
          companyName: company.companyName,
          walletVerified: company.walletVerified
        }
      });

    } catch (updateError) {
      return res.status(400).json({
        success: false,
        message: updateError.message
      });
    }

  } catch (error) {
    console.error('Connect wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect wallet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get wallet information
router.get('/wallet-info', companyAuth, async (req, res) => {
  try {
    const companyId = req.user.id;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: {
        hasWallet: company.hasWallet,
        walletAddress: company.walletAddress,
        walletShort: company.walletShort,
        walletConnectedAt: company.walletConnectedAt,
        walletVerified: company.walletVerified,
        blockchainStats: company.blockchainStats,
        readyForBlockchain: company.hasWallet && company.walletVerified
      }
    });

  } catch (error) {
    console.error('Get wallet info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wallet information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Disconnect wallet
router.delete('/disconnect-wallet', companyAuth, async (req, res) => {
  try {
    const companyId = req.user.id;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    if (!company.walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'No wallet connected'
      });
    }

    // Check if company has any blockchain submissions
    if (company.blockchainStats.totalSubmissions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot disconnect wallet. You have blockchain submissions associated with this wallet.',
        blockchainSubmissions: company.blockchainStats.totalSubmissions
      });
    }

    // Disconnect wallet
    company.walletAddress = null;
    company.walletConnectedAt = null;
    company.walletVerified = false;
    
    await company.save();

    console.log('🔌 Wallet disconnected successfully');

    res.json({
      success: true,
      message: 'Wallet disconnected successfully',
      data: {
        hasWallet: false,
        companyName: company.companyName
      }
    });

  } catch (error) {
    console.error('Disconnect wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect wallet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify wallet ownership (optional - for additional security)
router.post('/verify-wallet', companyAuth, async (req, res) => {
  try {
    const { signature, message } = req.body;
    const companyId = req.user.id;

    const company = await Company.findById(companyId);
    if (!company || !company.walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'No wallet connected'
      });
    }

    // TODO: Implement signature verification
    // const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    // if (recoveredAddress.toLowerCase() !== company.walletAddress.toLowerCase()) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Signature verification failed'
    //   });
    // }

    // For now, just mark as verified
    company.walletVerified = true;
    await company.save();

    res.json({
      success: true,
      message: 'Wallet verified successfully',
      data: {
        walletAddress: company.walletAddress,
        walletVerified: true
      }
    });

  } catch (error) {
    console.error('Verify wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify wallet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===============================
// 📌 COMPANY PROFILE ROUTES
// ===============================

// Get company profile
router.get('/profile', companyAuth, async (req, res) => {
  try {
    const companyId = req.user.id;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Remove sensitive data
    const companyProfile = company.toObject();
    delete companyProfile.password;

    res.json({
      success: true,
      data: companyProfile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get company profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===============================
// 📌 DEBUG ROUTES (Development Only)
// ===============================

// Debug: Show all registered routes
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/routes', (req, res) => {
    const routes = [];
    router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
        routes.push(`${methods} /api/companies${middleware.route.path}`);
      }
    });
    
    res.json({
      success: true,
      message: 'All registered company routes',
      routes: routes.sort()
    });
  });
}

// ===============================
// 📌 ROUTE LOGGING
// ===============================
console.log('✅ Company routes registered:');
console.log('   📊 GET  /dashboard-stats');
console.log('   📋 GET  /submissions');
console.log('   📄 GET  /submissions/:submissionId');
console.log('   ✅ POST /submissions/:submissionId/approve');
console.log('   ❌ POST /submissions/:submissionId/reject');
console.log('   🔗 POST /submissions/:submissionId/blockchain');
console.log('   📊 GET  /submissions/:submissionId/blockchain-status');
console.log('   💳 POST /connect-wallet');
console.log('   💳 GET  /wallet-info');
console.log('   💳 DELETE /disconnect-wallet');
console.log('   💳 POST /verify-wallet');
console.log('   👤 GET  /profile');

module.exports = router;

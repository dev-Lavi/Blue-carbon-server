// Add these routes to your existing government routes
const govApprovalController = require('../controllers/govApprovalController');

// Data approval routes
router.get('/approvals', authMiddleware, govApprovalController.getPendingApprovals);
router.get('/approval/:submissionId', authMiddleware, govApprovalController.getApprovalDetails);
router.post('/approve/:submissionId', authMiddleware, govApprovalController.approveSubmission);
router.post('/reject/:submissionId', authMiddleware, govApprovalController.rejectSubmission);
router.get('/approval-stats', authMiddleware, govApprovalController.getApprovalStats);

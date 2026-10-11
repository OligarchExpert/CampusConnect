const express = require('express');
const router = express.Router();
const wc = require('../controllers/welfareController');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const adminOnly = [authenticateToken, authorize('admin')];
const advisorOrAdmin = [authenticateToken, authorize('faculty', 'admin')];

// 1. Complaint submission & retrieval
router.post('/complaints',                     authenticateToken, wc.submitComplaint);
router.get('/complaints',                      authenticateToken, wc.listComplaints);
router.get('/complaints/:id',                  authenticateToken, wc.getComplaint);
router.put('/complaints/:id/status',           adminOnly,         wc.updateComplaintStatus);
router.put('/complaints/:id/notes',            adminOnly,         wc.updateInvestigationNotes);
router.post('/complaints/:id/decide',          adminOnly,         wc.decideComplaint);
router.post('/complaints/:id/reverse-credit',  adminOnly,         wc.reverseCreditAward);
router.post('/complaints/:id/evidence',        authenticateToken, wc.uploadEvidence);
router.get('/search-users',                    authenticateToken, wc.searchUsers);

// 2. Class Advisors & Student Verification
router.get('/advisors',                        authenticateToken, wc.listAdvisors);
router.post('/advisors/verify-student',        advisorOrAdmin,    wc.verifyStudent);
router.post('/advisors/revoke-student',        advisorOrAdmin,    wc.revokeStudentVerification);

// 3. Faculty Misconduct & Red Review Flags (Confidential to Student Welfare)
router.get('/faculty-summary',                 adminOnly,         wc.getFacultySummary);

// 4. Student Welfare Dashboard Overview & Stats
router.get('/dashboard-stats',                 adminOnly,         wc.getDashboardStats);

// 5. Warnings & Appeals
router.get('/warnings',                        authenticateToken, wc.listWarnings);
router.post('/warnings/:id/appeal',            authenticateToken, wc.appealWarning);
router.post('/warnings/:id/reverse',           adminOnly,         wc.reverseWarning);

module.exports = router;

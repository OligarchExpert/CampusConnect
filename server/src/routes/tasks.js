const express = require('express');
const router = express.Router();
const tc = require('../controllers/taskController');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { taskValidators, handleValidation } = require('../validators');

router.get('/', authenticateToken, tc.listTasks);
router.post('/', authenticateToken, authorize('faculty', 'admin'), taskValidators, handleValidation, tc.createTask);
router.get('/my', authenticateToken, authorize('faculty', 'admin'), tc.getMyTasks);
router.get('/my-applications', authenticateToken, authorize('student'), tc.getMyApplications);

router.get('/:id', authenticateToken, tc.getTask);
router.put('/:id', authenticateToken, authorize('faculty', 'admin'), tc.updateTask);

router.post('/:id/apply', authenticateToken, authorize('student'), tc.applyToTask);
router.post('/:id/submit', authenticateToken, authorize('student'), tc.submitApplication);

router.get('/:id/applications', authenticateToken, authorize('faculty', 'admin'), tc.getApplications);
router.put('/:id/applications/:appId', authenticateToken, authorize('faculty', 'admin'), tc.updateApplication);
router.put('/:id/applications/:appId/approve', authenticateToken, authorize('faculty', 'admin'), tc.approveApplication);

module.exports = router;

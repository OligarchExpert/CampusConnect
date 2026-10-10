const express = require('express');
const router = express.Router();
const hc = require('../controllers/helpController');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { helpRequestValidators, handleValidation } = require('../validators');

router.get('/', authenticateToken, hc.listRequests);
router.post('/', authenticateToken, authorize('student'), helpRequestValidators, handleValidation, hc.createRequest);

router.get('/my-requests', authenticateToken, authorize('student'), hc.getMyRequests);
router.get('/my-helping', authenticateToken, authorize('student'), hc.getMyHelping);

router.get('/:id', authenticateToken, hc.getRequest);
router.post('/:id/accept', authenticateToken, authorize('student'), hc.acceptRequest);
router.post('/:id/submit', authenticateToken, authorize('student'), hc.submitCompletion);
router.post('/:id/confirm', authenticateToken, authorize('student'), hc.confirmCompletion);
router.post('/:id/cancel', authenticateToken, hc.cancelRequest);

module.exports = router;

const express = require('express');
const router = express.Router();
const ac = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const adminOnly = [authenticateToken, authorize('admin')];

router.get('/users', adminOnly, ac.listUsers);
router.put('/users/:id', adminOnly, ac.updateUser);
router.get('/reports', adminOnly, ac.listReports);
router.put('/reports/:id', adminOnly, ac.updateReport);
router.get('/credits', adminOnly, ac.listAllCredits);
router.post('/credits/:txId/reverse', adminOnly, ac.reverseCredit);

module.exports = router;

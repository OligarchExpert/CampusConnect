const express = require('express');
const router = express.Router();
const { getBalance, getHistory, getAllowance } = require('../controllers/creditController');
const { authenticateToken } = require('../middleware/auth');

router.get('/balance', authenticateToken, getBalance);
router.get('/history', authenticateToken, getHistory);
router.get('/allowance', authenticateToken, getAllowance);

module.exports = router;

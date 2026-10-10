const express = require('express');
const router = express.Router();
const { getBalance, getHistory } = require('../controllers/creditController');
const { authenticateToken } = require('../middleware/auth');

router.get('/balance', authenticateToken, getBalance);
router.get('/history', authenticateToken, getHistory);

module.exports = router;

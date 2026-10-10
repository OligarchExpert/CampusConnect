const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { registerValidators, loginValidators, handleValidation } = require('../validators');

router.post('/register', registerValidators, handleValidation, register);
router.post('/login', loginValidators, handleValidation, login);
router.get('/me', authenticateToken, me);

module.exports = router;

const express = require('express');
const router = express.Router();
const pc = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');

router.get('/skills/all', authenticateToken, pc.getAllSkills);
router.get('/:userId', authenticateToken, pc.getProfile);
router.put('/:userId', authenticateToken, pc.updateProfile);
router.get('/:userId/skills', authenticateToken, pc.getSkills);
router.put('/:userId/skills', authenticateToken, pc.updateSkills);

module.exports = router;

const pool = require('../config/db');

const getProfile = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, email, role, bio, avatar_url, department, created_at
       FROM users WHERE id = ? AND is_active = 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [skills] = await pool.execute(
      `SELECT s.id, s.name, s.category, us.proficiency
       FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = ?
       ORDER BY s.category, s.name`,
      [userId]
    );

    const [creditRows] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      profile: {
        ...rows[0],
        skills,
        creditBalance: parseInt(creditRows[0].balance, 10)
      }
    });
  } catch (err) {
    console.error('[Profile getProfile error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
};

const updateProfile = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  // Prevent users from editing other users' profiles
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to edit another user\'s profile'
    });
  }

  const { name, bio, department, avatar_url } = req.body;

  try {
    await pool.execute(
      `UPDATE users
       SET name = COALESCE(?, name),
           bio = COALESCE(?, bio),
           department = COALESCE(?, department),
           avatar_url = COALESCE(?, avatar_url)
       WHERE id = ?`,
      [name || null, bio || null, department || null, avatar_url || null, userId]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('[Profile updateProfile error]', err);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

const getSkills = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const [skills] = await pool.execute(
      `SELECT s.id, s.name, s.category, us.proficiency
       FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = ?
       ORDER BY s.category, s.name`,
      [userId]
    );
    res.json({ success: true, skills });
  } catch (err) {
    console.error('[Profile getSkills error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve skills' });
  }
};

const updateSkills = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to edit another user\'s skills'
    });
  }

  const { skills } = req.body; // Array of { skill_id, proficiency }
  if (!Array.isArray(skills)) {
    return res.status(422).json({ success: false, message: 'Skills must be an array' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Clear existing skills for this user
    await conn.execute('DELETE FROM user_skills WHERE user_id = ?', [userId]);

    // Insert updated skills
    for (const item of skills) {
      const skillId = parseInt(item.skill_id, 10);
      const proficiency = ['beginner', 'intermediate', 'advanced', 'expert'].includes(item.proficiency)
        ? item.proficiency
        : 'beginner';

      if (!isNaN(skillId)) {
        await conn.execute(
          `INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
           VALUES (?, ?, ?)`,
          [userId, skillId, proficiency]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Skills updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('[Profile updateSkills error]', err);
    res.status(500).json({ success: false, message: 'Failed to update skills' });
  } finally {
    conn.release();
  }
};

const getAllSkills = async (req, res) => {
  try {
    const [skills] = await pool.execute(
      'SELECT id, name, category FROM skills ORDER BY category, name'
    );
    res.json({ success: true, skills });
  } catch (err) {
    console.error('[Profile getAllSkills error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve skills catalogue' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getSkills,
  updateSkills,
  getAllSkills
};

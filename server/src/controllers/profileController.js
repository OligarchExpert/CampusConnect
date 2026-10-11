const pool = require('../config/db');

const getProfile = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.bio, u.avatar_url, u.department,
              u.student_id_num, u.programme, u.academic_year, u.section,
              u.advisor_id, u.is_advisor_approved, u.advisor_approved_at,
              u.faculty_verified_skills, u.created_at,
              COALESCE(adv_u.name, v_u.name) AS advisor_name,
              adv_u.department AS advisor_department,
              v_u.name AS verifier_name,
              COALESCE(u.advisor_approved_at, av.verified_at) AS verification_date,
              av.reason AS verification_reason
       FROM users u
       LEFT JOIN class_advisors ca ON ca.id = u.advisor_id
       LEFT JOIN users adv_u ON adv_u.id = ca.faculty_id
       LEFT JOIN advisor_verifications av ON av.id = (
         SELECT MAX(id) FROM advisor_verifications WHERE student_id = u.id AND status = 'approved'
       )
       LEFT JOIN users v_u ON v_u.id = av.verified_by_user_id
       WHERE u.id = ? AND u.is_active = 1`,
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

    const [helpStats] = await pool.execute(
      'SELECT COUNT(*) AS total_helped FROM help_completions WHERE helper_id = ?',
      [userId]
    );

    res.json({
      success: true,
      profile: {
        ...rows[0],
        skills,
        creditBalance: parseInt(creditRows[0].balance, 10),
        totalCompletedHelps: parseInt(helpStats[0]?.total_helped || 0, 10)
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

  // Security check: Students cannot grant themselves advisor approved badges or change advisor links
  if (req.user.role === 'student' && (req.body.is_advisor_approved !== undefined || req.body.advisor_id !== undefined)) {
    return res.status(403).json({
      success: false,
      message: 'Students cannot grant themselves the Class Advisor Approved badge or change advisor assignments'
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

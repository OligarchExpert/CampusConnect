const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'campusconnect_default_dev_secret_key_change_in_prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const register = async (req, res) => {
  const { name, email, password, role, bio, department } = req.body;

  // Enforce security rule: public registration must NEVER permit Admin creation
  if (role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin accounts cannot be created via public registration'
    });
  }

  const userRole = role === 'faculty' ? 'faculty' : 'student';

  try {
    // Check if email already registered
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists'
      });
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, role, bio, department, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, email, hashedPassword, userRole, bio || null, department || null]
    );

    const userId = result.insertId;

    const token = jwt.sign(
      { id: userId, email, role: userRole },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: userId,
        name,
        email,
        role: userRole,
        department: department || null,
        bio: bio || null
      }
    });
  } catch (err) {
    console.error('[Auth register error]', err);
    res.status(500).json({ success: false, message: 'Registration failed due to server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, password, role, bio, department, is_active FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This account has been disabled by an administrator'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Return sanitized user (exclude password hash)
    const { password: _, ...sanitizedUser } = user;

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: sanitizedUser
    });
  } catch (err) {
    console.error('[Auth login error]', err);
    res.status(500).json({ success: false, message: 'Login failed due to server error' });
  }
};

const me = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, email, role, bio, avatar_url, department, is_active, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];

    // Also get credit balance
    const [creditRows] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?',
      [user.id]
    );

    user.creditBalance = parseInt(creditRows[0].balance, 10);

    res.json({ success: true, user });
  } catch (err) {
    console.error('[Auth me error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve user profile' });
  }
};

module.exports = { register, login, me };

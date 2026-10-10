const pool = require('../config/db');

const listUsers = async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, name, email, role, department, is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ success: true, users });
  } catch (err) {
    console.error('[Admin listUsers error]', err);
    res.status(500).json({ success: false, message: 'Failed to list users' });
  }
};

const updateUser = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { is_active, role } = req.body;

  // Security: Never allow promoting an account to admin through this endpoint
  if (role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin privileges cannot be granted through this endpoint'
    });
  }

  try {
    const updates = [];
    const params = [];

    if (typeof is_active === 'number' || typeof is_active === 'boolean') {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (role && ['student', 'faculty'].includes(role)) {
      updates.push('role = ?');
      params.push(role);
    }

    if (updates.length === 0) {
      return res.status(422).json({ success: false, message: 'No valid fields provided to update' });
    }

    params.push(userId);
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Audit trail: record admin action in reports table
    await pool.execute(
      `INSERT INTO reports (reporter_id, subject_id, reason, context_type, status)
       VALUES (?, ?, ?, 'user', 'reviewed')`,
      [
        req.user.id,
        userId,
        `Admin action: Updated User ${userId} (${updates.join(', ')}) by Admin ${req.user.id}`
      ]
    );

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    console.error('[Admin updateUser error]', err);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

const listReports = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT r.*,
             u.name AS subject_name,
             u.email AS subject_email,
             a.name AS reporter_name
      FROM reports r
      JOIN users u ON u.id = r.subject_id
      LEFT JOIN users a ON a.id = r.reporter_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const [reports] = await pool.execute(query, params);
    res.json({ success: true, reports });
  } catch (err) {
    console.error('[Admin listReports error]', err);
    res.status(500).json({ success: false, message: 'Failed to list reports' });
  }
};

const updateReport = async (req, res) => {
  const reportId = parseInt(req.params.id, 10);
  const { status, admin_note } = req.body;

  if (!['open', 'reviewed', 'dismissed'].includes(status)) {
    return res.status(422).json({ success: false, message: 'Status must be open, reviewed, or dismissed' });
  }

  try {
    await pool.execute(
      `UPDATE reports
       SET status = ?,
           admin_note = COALESCE(?, admin_note)
       WHERE id = ?`,
      [status, admin_note || null, reportId]
    );

    res.json({ success: true, message: 'Report updated successfully' });
  } catch (err) {
    console.error('[Admin updateReport error]', err);
    res.status(500).json({ success: false, message: 'Failed to update report' });
  }
};

const listAllCredits = async (req, res) => {
  try {
    const [transactions] = await pool.execute(
      `SELECT ct.*, u.name, u.email, u.role
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.user_id
       ORDER BY ct.created_at DESC
       LIMIT 500`
    );
    res.json({ success: true, transactions });
  } catch (err) {
    console.error('[Admin listAllCredits error]', err);
    res.status(500).json({ success: false, message: 'Failed to list credit transactions' });
  }
};

const reverseCredit = async (req, res) => {
  const txId = parseInt(req.params.txId, 10);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM credit_transactions WHERE id = ? FOR UPDATE',
      [txId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const tx = rows[0];

    if (tx.type === 'reversal') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cannot reverse an existing reversal transaction' });
    }

    // Check if this transaction was already reversed
    const [existingReversals] = await conn.execute(
      `SELECT id FROM credit_transactions
       WHERE source_id = ? AND source_type = 'admin' AND type = 'reversal'`,
      [txId]
    );

    if (existingReversals.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'This transaction has already been reversed' });
    }

    // Rule 10: Record reversal in credit_transactions as a new transaction with negative amount; DO NOT erase the original
    const reversalAmount = -tx.amount;
    await conn.execute(
      `INSERT INTO credit_transactions
         (user_id, amount, type, source_id, source_type, description)
       VALUES (?, ?, 'reversal', ?, 'admin', ?)`,
      [
        tx.user_id,
        reversalAmount,
        txId,
        `Admin reversal of Transaction #${txId} (${tx.description}) by Admin ${req.user.id}`
      ]
    );

    // Audit trail in reports
    await conn.execute(
      `INSERT INTO reports
         (reporter_id, subject_id, reason, context_type, context_id, status)
       VALUES (?, ?, ?, 'credit', ?, 'reviewed')`,
      [
        req.user.id,
        tx.user_id,
        `Admin ${req.user.id} reversed credit transaction #${txId} of ${tx.amount} credits`,
        txId
      ]
    );

    await conn.commit();

    res.json({
      success: true,
      message: `Transaction #${txId} successfully reversed`,
      reversedAmount: reversalAmount
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin reverseCredit error]', err);
    res.status(500).json({ success: false, message: 'Failed to reverse transaction' });
  } finally {
    conn.release();
  }
};

module.exports = {
  listUsers,
  updateUser,
  listReports,
  updateReport,
  listAllCredits,
  reverseCredit
};

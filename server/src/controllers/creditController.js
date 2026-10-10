const pool = require('../config/db');

const getBalance = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      balance: parseInt(rows[0].balance, 10)
    });
  } catch (err) {
    console.error('[Credit getBalance error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve credit balance' });
  }
};

const getHistory = async (req, res) => {
  try {
    const [transactions] = await pool.execute(
      `SELECT ct.*,
              CASE ct.source_type
                WHEN 'help_request' THEN (SELECT title FROM help_requests WHERE id = ct.source_id)
                WHEN 'task_application' THEN (
                  SELECT t.title
                  FROM applications a
                  JOIN tasks t ON t.id = a.task_id
                  WHERE a.id = ct.source_id
                )
                ELSE NULL
              END AS source_title
       FROM credit_transactions ct
       WHERE ct.user_id = ?
       ORDER BY ct.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    const [balanceRows] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      balance: parseInt(balanceRows[0].balance, 10),
      transactions
    });
  } catch (err) {
    console.error('[Credit getHistory error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve transaction history' });
  }
};

module.exports = { getBalance, getHistory };

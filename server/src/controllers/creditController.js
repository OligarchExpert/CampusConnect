const pool = require('../config/db');
const creditService = require('../services/creditService');

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
                WHEN 'help_request' THEN hr.title
                WHEN 'task_application' THEN t.title
                ELSE NULL
              END AS source_title,
              CASE ct.source_type
                WHEN 'help_request' THEN requester.name
                WHEN 'task_application' THEN faculty.name
                ELSE NULL
              END AS partner_name,
              CASE ct.source_type
                WHEN 'help_request' THEN 'Help Requester'
                WHEN 'task_application' THEN 'Faculty Supervisor'
                ELSE 'Administration'
              END AS partner_role,
              hc.first_time,
              hc.cap_applied
       FROM credit_transactions ct
       LEFT JOIN help_requests hr ON ct.source_type = 'help_request' AND hr.id = ct.source_id
       LEFT JOIN users requester ON requester.id = hr.requester_id
       LEFT JOIN help_completions hc ON ct.source_type = 'help_request' AND hc.request_id = ct.source_id
       LEFT JOIN applications a ON ct.source_type = 'task_application' AND a.id = ct.source_id
       LEFT JOIN tasks t ON t.id = a.task_id
       LEFT JOIN users faculty ON faculty.id = t.faculty_id
       WHERE ct.user_id = ?
       ORDER BY ct.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    const [balanceRows] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?',
      [req.user.id]
    );

    const allowance = await creditService.getPeerHelpAllowance(req.user.id, pool);

    res.json({
      success: true,
      balance: parseInt(balanceRows[0].balance, 10),
      allowance,
      transactions
    });
  } catch (err) {
    console.error('[Credit getHistory error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve transaction history' });
  }
};

const getAllowance = async (req, res) => {
  try {
    const allowance = await creditService.getPeerHelpAllowance(req.user.id, pool);
    res.json({
      success: true,
      ...allowance
    });
  } catch (err) {
    console.error('[Credit getAllowance error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve credit allowance' });
  }
};

module.exports = { getBalance, getHistory, getAllowance };

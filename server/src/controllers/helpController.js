const pool = require('../config/db');
const { awardPeerHelpCredit } = require('../services/creditService');

const listRequests = async (req, res) => {
  try {
    const { status, category } = req.query;
    let query = `
      SELECT hr.*,
             u.name AS requester_name,
             u.department AS requester_department,
             h.name AS helper_name
      FROM help_requests hr
      JOIN users u ON u.id = hr.requester_id
      LEFT JOIN users h ON h.id = hr.helper_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND hr.status = ?';
      params.push(status);
    } else {
      query += ' AND hr.status = "open"';
    }

    if (category) {
      query += ' AND hr.category = ?';
      params.push(category);
    }

    query += ' ORDER BY hr.created_at DESC';

    const [requests] = await pool.execute(query, params);
    res.json({ success: true, requests });
  } catch (err) {
    console.error('[Help listRequests error]', err);
    res.status(500).json({ success: false, message: 'Failed to list help requests' });
  }
};

const createRequest = async (req, res) => {
  const { title, description, category, skills_needed, deadline } = req.body;

  try {
    const [result] = await pool.execute(
      `INSERT INTO help_requests
         (requester_id, title, description, category, skills_needed, deadline, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [
        req.user.id,
        title,
        description,
        category || null,
        skills_needed || null,
        deadline || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Help request created successfully',
      requestId: result.insertId
    });
  } catch (err) {
    console.error('[Help createRequest error]', err);
    res.status(500).json({ success: false, message: 'Failed to create help request' });
  }
};

const getRequest = async (req, res) => {
  const reqId = parseInt(req.params.id, 10);

  try {
    const [rows] = await pool.execute(
      `SELECT hr.*,
              u.name AS requester_name,
              u.email AS requester_email,
              u.department AS requester_department,
              h.name AS helper_name,
              h.email AS helper_email
       FROM help_requests hr
       JOIN users u ON u.id = hr.requester_id
       LEFT JOIN users h ON h.id = hr.helper_id
       WHERE hr.id = ?`,
      [reqId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    res.json({ success: true, request: rows[0] });
  } catch (err) {
    console.error('[Help getRequest error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve help request' });
  }
};

const acceptRequest = async (req, res) => {
  const reqId = parseInt(req.params.id, 10);
  const helperId = req.user.id;

  try {
    const [rows] = await pool.execute(
      'SELECT requester_id, status FROM help_requests WHERE id = ?',
      [reqId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    const request = rows[0];

    if (request.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'This help request is no longer open'
      });
    }

    // Rule 9: Prevent self-help
    if (request.requester_id === helperId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot accept your own help request'
      });
    }

    await pool.execute(
      'UPDATE help_requests SET status = "accepted", helper_id = ? WHERE id = ? AND status = "open"',
      [helperId, reqId]
    );

    res.json({ success: true, message: 'Help request accepted' });
  } catch (err) {
    console.error('[Help acceptRequest error]', err);
    res.status(500).json({ success: false, message: 'Failed to accept help request' });
  }
};

const submitCompletion = async (req, res) => {
  const reqId = parseInt(req.params.id, 10);
  const helperId = req.user.id;

  try {
    const [rows] = await pool.execute(
      'SELECT id, status, helper_id FROM help_requests WHERE id = ?',
      [reqId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    const request = rows[0];

    if (request.helper_id !== helperId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned helper can submit completion'
      });
    }

    if (request.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Request must be in accepted status to submit'
      });
    }

    await pool.execute(
      'UPDATE help_requests SET status = "submitted" WHERE id = ?',
      [reqId]
    );

    res.json({
      success: true,
      message: 'Completion submitted. Awaiting confirmation from requester.'
    });
  } catch (err) {
    console.error('[Help submitCompletion error]', err);
    res.status(500).json({ success: false, message: 'Failed to submit completion' });
  }
};

const confirmCompletion = async (req, res) => {
  const reqId = parseInt(req.params.id, 10);
  const requesterId = req.user.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM help_requests WHERE id = ? AND status = "submitted" FOR UPDATE',
      [reqId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Submitted help request not found or not in submitted status'
      });
    }

    const request = rows[0];

    // Only requester can confirm
    if (request.requester_id !== requesterId && req.user.role !== 'admin') {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only the requester can confirm that help was received'
      });
    }

    // Award peer help credits using credit engine
    const result = await awardPeerHelpCredit(conn, request.helper_id, requesterId, reqId);

    // Update status to confirmed
    await conn.execute(
      'UPDATE help_requests SET status = "confirmed" WHERE id = ?',
      [reqId]
    );

    await conn.commit();

    res.json({
      success: true,
      message: 'Help completion confirmed successfully',
      creditsAwarded: result.creditsAwarded,
      isFirstTime: result.isFirstTime,
      capApplied: result.capApplied
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Help confirmCompletion error]', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to confirm completion'
    });
  } finally {
    conn.release();
  }
};

const cancelRequest = async (req, res) => {
  const reqId = parseInt(req.params.id, 10);
  const requesterId = req.user.id;

  try {
    const [rows] = await pool.execute(
      'SELECT requester_id, status FROM help_requests WHERE id = ?',
      [reqId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    if (rows[0].requester_id !== requesterId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this request' });
    }

    if (['confirmed', 'cancelled'].includes(rows[0].status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a request that is already ${rows[0].status}`
      });
    }

    await pool.execute(
      'UPDATE help_requests SET status = "cancelled" WHERE id = ?',
      [reqId]
    );

    res.json({ success: true, message: 'Help request cancelled successfully' });
  } catch (err) {
    console.error('[Help cancelRequest error]', err);
    res.status(500).json({ success: false, message: 'Failed to cancel request' });
  }
};

const getMyRequests = async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT hr.*, h.name AS helper_name
       FROM help_requests hr
       LEFT JOIN users h ON h.id = hr.helper_id
       WHERE hr.requester_id = ?
       ORDER BY hr.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, requests });
  } catch (err) {
    console.error('[Help getMyRequests error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve requests' });
  }
};

const getMyHelping = async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT hr.*, u.name AS requester_name
       FROM help_requests hr
       JOIN users u ON u.id = hr.requester_id
       WHERE hr.helper_id = ?
       ORDER BY hr.updated_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, requests });
  } catch (err) {
    console.error('[Help getMyHelping error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve helping requests' });
  }
};

module.exports = {
  listRequests,
  createRequest,
  getRequest,
  acceptRequest,
  submitCompletion,
  confirmCompletion,
  cancelRequest,
  getMyRequests,
  getMyHelping
};

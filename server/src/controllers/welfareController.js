const pool = require('../config/db');

// Allowed evidence mime types and file extensions (never allow executables)
const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.ps1', '.msi', '.com'];
const VALID_STATUSES = [
  'submitted',
  'under_review',
  'awaiting_evidence',
  'awaiting_response',
  'substantiated',
  'partially_substantiated',
  'unsubstantiated',
  'closed'
];
const VALID_CATEGORIES = [
  'peer_help_misrepresentation',
  'credit_fraud',
  'academic_integrity_faculty',
  'academic_integrity_student',
  'harassment_conduct',
  'task_dispute',
  'other'
];

/**
 * Audit log helper
 */
async function recordAuditLog(adminId, actionType, targetType, targetId, details) {
  try {
    await pool.execute(
      `INSERT INTO welfare_audit_logs (admin_id, action_type, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [adminId, actionType, targetType, targetId, JSON.stringify(details || {})]
    );
  } catch (err) {
    console.error('[Audit Log Error]', err);
  }
}

/**
 * 1. Submit a new complaint
 */
const submitComplaint = async (req, res) => {
  const complainantId = req.user.id;
  const {
    reported_user_id,
    category,
    context_type,
    context_id,
    description,
    original_work_details,
    original_work_date
  } = req.body;

  if (!reported_user_id) {
    return res.status(422).json({ success: false, message: 'Reported person is required' });
  }
  if (parseInt(reported_user_id, 10) === complainantId) {
    return res.status(422).json({ success: false, message: 'You cannot submit a complaint against yourself' });
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(422).json({ success: false, message: 'A valid complaint category is required' });
  }
  if (!description || description.trim().length < 10) {
    return res.status(422).json({ success: false, message: 'Description must be at least 10 characters' });
  }

  // Generate unique complaint reference
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const complaintRef = `CMP-2026-${randomSuffix}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO complaints (
         complaint_ref, complainant_id, reported_user_id, category, context_type,
         context_id, description, original_work_details, original_work_date, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        complaintRef,
        complainantId,
        reported_user_id,
        category,
        context_type || null,
        context_id || null,
        description.trim(),
        original_work_details || null,
        original_work_date || null
      ]
    );

    const complaintId = result.insertId;

    await conn.execute(
      `INSERT INTO complaint_status_history (complaint_id, from_status, to_status, changed_by, notes)
       VALUES (?, 'none', 'submitted', ?, 'Complaint submitted by user')`,
      [complaintId, complainantId]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully and forwarded to Student Welfare',
      complaint: {
        id: complaintId,
        complaint_ref: complaintRef,
        status: 'submitted'
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Submit Complaint Error]', err);
    res.status(500).json({ success: false, message: 'Failed to submit complaint' });
  } finally {
    conn.release();
  }
};

/**
 * 2. List complaints (Role-guarded & scoped)
 */
const listComplaints = async (req, res) => {
  const user = req.user;
  const { status, category, role, search } = req.query;

  try {
    let query = `
      SELECT c.id, c.complaint_ref, c.category, c.context_type, c.context_id,
             c.status, c.decision, c.created_at, c.updated_at,
             u_comp.id AS complainant_id, u_comp.name AS complainant_name, u_comp.role AS complainant_role,
             u_rep.id AS reported_user_id, u_rep.name AS reported_user_name, u_rep.role AS reported_user_role,
             u_rep.department AS reported_department
      FROM complaints c
      JOIN users u_comp ON u_comp.id = c.complainant_id
      JOIN users u_rep ON u_rep.id = c.reported_user_id
      WHERE 1=1
    `;
    const params = [];

    // Role scoping: non-admins can only see complaints where they are complainant or reported user
    if (user.role !== 'admin') {
      query += ` AND (c.complainant_id = ? OR c.reported_user_id = ?)`;
      params.push(user.id, user.id);
    } else {
      // Admin filters
      if (status) {
        query += ` AND c.status = ?`;
        params.push(status);
      }
      if (category) {
        query += ` AND c.category = ?`;
        params.push(category);
      }
      if (role) {
        query += ` AND u_rep.role = ?`;
        params.push(role);
      }
      if (search) {
        query += ` AND (c.complaint_ref LIKE ? OR u_rep.name LIKE ? OR u_comp.name LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term, term);
      }
    }

    query += ` ORDER BY c.created_at DESC`;

    const [complaints] = await pool.execute(query, params);
    res.json({ success: true, complaints });
  } catch (err) {
    console.error('[List Complaints Error]', err);
    res.status(500).json({ success: false, message: 'Failed to list complaints' });
  }
};

/**
 * 3. Get single complaint details (Confidentiality enforced)
 */
const getComplaint = async (req, res) => {
  const complaintId = parseInt(req.params.id, 10);
  const user = req.user;

  try {
    const [rows] = await pool.execute(
      `SELECT c.*,
              u_comp.name AS complainant_name, u_comp.email AS complainant_email, u_comp.role AS complainant_role,
              u_rep.name AS reported_name, u_rep.email AS reported_email, u_rep.role AS reported_role, u_rep.department AS reported_department,
              u_rev.name AS reviewer_name,
              u_dec.name AS decision_by_name
       FROM complaints c
       JOIN users u_comp ON u_comp.id = c.complainant_id
       JOIN users u_rep ON u_rep.id = c.reported_user_id
       LEFT JOIN users u_rev ON u_rev.id = c.assigned_reviewer_id
       LEFT JOIN users u_dec ON u_dec.id = c.decision_by
       WHERE c.id = ?`,
      [complaintId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const complaint = rows[0];

    // Authorization check: only admin, complainant, or reported person can view
    const isAuthorized =
      user.role === 'admin' ||
      user.id === complaint.complainant_id ||
      user.id === complaint.reported_user_id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You do not have authorization to view this complaint case'
      });
    }

    // Evidence attachments
    const [evidence] = await pool.execute(
      `SELECT id, file_name, file_size, mime_type, description, created_at, uploaded_by
       FROM complaint_evidence WHERE complaint_id = ? ORDER BY created_at ASC`,
      [complaintId]
    );

    // Status transition history
    const [history] = await pool.execute(
      `SELECT csh.*, u.name AS changed_by_name
       FROM complaint_status_history csh
       JOIN users u ON u.id = csh.changed_by
       WHERE csh.complaint_id = ? ORDER BY csh.created_at ASC`,
      [complaintId]
    );

    // Confidentiality Protection: strip investigation notes and internal fields if not Student Welfare
    if (user.role !== 'admin') {
      delete complaint.investigation_notes;
    }

    res.json({
      success: true,
      complaint: {
        ...complaint,
        evidence,
        history
      }
    });
  } catch (err) {
    console.error('[Get Complaint Error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaint' });
  }
};

/**
 * 4. Update complaint status (Student Welfare only)
 */
const updateComplaintStatus = async (req, res) => {
  const complaintId = parseInt(req.params.id, 10);
  const { status, notes } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(422).json({ success: false, message: 'Invalid status' });
  }

  try {
    const [existing] = await pool.execute('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    const current = existing[0];

    // Prevent conflict of interest: faculty reviewer cannot update complaint about themselves
    if (req.user.id === current.reported_user_id) {
      return res.status(403).json({ success: false, message: 'Conflict of interest: you cannot review a complaint filed against yourself' });
    }

    await pool.execute(
      'UPDATE complaints SET status = ?, assigned_reviewer_id = COALESCE(assigned_reviewer_id, ?) WHERE id = ?',
      [status, req.user.id, complaintId]
    );

    await pool.execute(
      `INSERT INTO complaint_status_history (complaint_id, from_status, to_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [complaintId, current.status, status, req.user.id, notes || `Status updated to ${status}`]
    );

    await recordAuditLog(req.user.id, 'complaint_status_update', 'complaint', complaintId, {
      from: current.status,
      to: status,
      notes
    });

    res.json({ success: true, message: `Complaint status updated to ${status}` });
  } catch (err) {
    console.error('[Update Status Error]', err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

/**
 * 5. Update confidential investigation notes (Student Welfare only)
 */
const updateInvestigationNotes = async (req, res) => {
  const complaintId = parseInt(req.params.id, 10);
  const { investigation_notes } = req.body;

  try {
    await pool.execute(
      'UPDATE complaints SET investigation_notes = ? WHERE id = ?',
      [investigation_notes || null, complaintId]
    );
    res.json({ success: true, message: 'Investigation notes updated' });
  } catch (err) {
    console.error('[Update Notes Error]', err);
    res.status(500).json({ success: false, message: 'Failed to update notes' });
  }
};

/**
 * 6. Record formal decision on a complaint (Student Welfare only)
 * Includes progressive false-complaint policy handling
 */
const decideComplaint = async (req, res) => {
  const complaintId = parseInt(req.params.id, 10);
  const { decision, decision_reason, apply_deduction } = req.body;

  const validDecisions = ['substantiated', 'partially_substantiated', 'unsubstantiated', 'malicious_complaint', 'dismissed'];
  if (!validDecisions.includes(decision)) {
    return res.status(422).json({ success: false, message: 'Invalid decision choice' });
  }
  if (!decision_reason || decision_reason.trim().length < 10) {
    return res.status(422).json({ success: false, message: 'A documented decision reason (min 10 chars) is required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute('SELECT * FROM complaints WHERE id = ? FOR UPDATE', [complaintId]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    const complaint = rows[0];

    // Conflict of interest prevention
    if (req.user.id === complaint.reported_user_id) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Conflict of interest: you cannot decide a case against yourself' });
    }

    // Prevent duplicate decision
    if (complaint.decision !== 'none') {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'This complaint already has a recorded decision' });
    }

    const newStatus = decision === 'unsubstantiated' || decision === 'dismissed' ? 'closed' : 'substantiated';

    await conn.execute(
      `UPDATE complaints SET
         decision = ?,
         decision_reason = ?,
         decision_by = ?,
         decision_at = NOW(),
         status = ?
       WHERE id = ?`,
      [decision, decision_reason.trim(), req.user.id, newStatus, complaintId]
    );

    await conn.execute(
      `INSERT INTO complaint_status_history (complaint_id, from_status, to_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [complaintId, complaint.status, newStatus, req.user.id, `Case decided: ${decision}. Reason: ${decision_reason}`]
    );

    let warningInfo = null;

    // Progressive False Complaint Policy
    // Only malicious_complaint finding triggers warnings. Ordinary 'unsubstantiated' NEVER triggers a warning.
    if (decision === 'malicious_complaint') {
      const complainantId = complaint.complainant_id;

      // Count active warnings
      const [existingWarnings] = await conn.execute(
        'SELECT id, warning_level FROM user_warnings WHERE user_id = ? AND status = "active"',
        [complainantId]
      );
      const currentWarningCount = existingWarnings.length;
      const nextLevel = currentWarningCount + 1;

      let deductionAmount = 0;

      // Level 3 warning: review for 10-credit deduction with Student Welfare approval
      if (nextLevel >= 3 && apply_deduction === true) {
        // Check current credit balance
        const [balRow] = await conn.execute(
          'SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?',
          [complainantId]
        );
        const currentBal = parseInt(balRow[0].balance, 10);
        // Do not silently allow a negative balance without policy handling
        deductionAmount = Math.min(10, Math.max(0, currentBal));

        if (deductionAmount > 0) {
          await conn.execute(
            `INSERT INTO credit_transactions (user_id, amount, type, source_id, source_type, description)
             VALUES (?, ?, 'admin_adjustment', ?, 'admin', ?)`,
            [
              complainantId,
              -deductionAmount,
              complaintId,
              `Policy deduction: 3rd substantiated malicious complaint (${complaint.complaint_ref})`
            ]
          );
        }
      }

      const [warnResult] = await conn.execute(
        `INSERT INTO user_warnings (user_id, complaint_id, warning_level, deduction_applied, reason, issued_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [complainantId, complaintId, nextLevel, deductionAmount, decision_reason.trim(), req.user.id]
      );

      warningInfo = {
        warningId: warnResult.insertId,
        level: nextLevel,
        deductionApplied: deductionAmount
      };
    }

    await conn.commit();

    await recordAuditLog(req.user.id, 'complaint_decision', 'complaint', complaintId, {
      decision,
      reason: decision_reason,
      warningInfo
    });

    res.json({
      success: true,
      message: 'Complaint decision recorded successfully',
      decision,
      status: newStatus,
      warningInfo
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Decide Complaint Error]', err);
    res.status(500).json({ success: false, message: 'Failed to record decision' });
  } finally {
    conn.release();
  }
};

/**
 * 7. Reverse Credit Award via Compensating Ledger Entry (Student Welfare only)
 */
const reverseCreditAward = async (req, res) => {
  const complaintId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [compRows] = await conn.execute('SELECT * FROM complaints WHERE id = ? FOR UPDATE', [complaintId]);
    if (compRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    const complaint = compRows[0];

    // Find original credit transaction
    let targetTx = null;
    if (complaint.context_type === 'help_request' && complaint.context_id) {
      const [txRows] = await conn.execute(
        `SELECT * FROM credit_transactions
         WHERE source_type = 'help_request' AND source_id = ? AND type = 'peer_help'
         ORDER BY id DESC LIMIT 1`,
        [complaint.context_id]
      );
      if (txRows.length > 0) targetTx = txRows[0];
    } else if (complaint.context_type === 'credit' && complaint.context_id) {
      const [txRows] = await conn.execute(
        'SELECT * FROM credit_transactions WHERE id = ?',
        [complaint.context_id]
      );
      if (txRows.length > 0) targetTx = txRows[0];
    }

    if (!targetTx) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'No associated credit transaction found for this complaint' });
    }

    // Check not already reversed
    const [alreadyReversed] = await conn.execute(
      'SELECT id FROM credit_transactions WHERE source_id = ? AND source_type = "admin" AND type = "reversal"',
      [targetTx.id]
    );
    if (alreadyReversed.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'This credit transaction has already been reversed' });
    }

    // Check current balance to prevent negative balance
    const [balRow] = await conn.execute(
      'SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?',
      [targetTx.user_id]
    );
    const currentBalance = parseInt(balRow[0].balance, 10);
    const reversalAmount = -targetTx.amount;

    if (currentBalance + reversalAmount < 0) {
      await conn.rollback();
      return res.status(422).json({
        success: false,
        message: `Cannot reverse: user balance (${currentBalance}) is insufficient for reversal of ${targetTx.amount} credits. Requires manual welfare escalation.`
      });
    }

    // Insert compensating ledger entry (original transaction is NEVER deleted)
    await conn.execute(
      `INSERT INTO credit_transactions (user_id, amount, type, source_id, source_type, description)
       VALUES (?, ?, 'reversal', ?, 'admin', ?)`,
      [
        targetTx.user_id,
        reversalAmount,
        targetTx.id,
        `Student Welfare reversal for ${complaint.complaint_ref}: ${reason || 'Substantiated credit fraud'}`
      ]
    );

    await conn.commit();

    await recordAuditLog(req.user.id, 'credit_reversal', 'complaint', complaintId, {
      originalTxId: targetTx.id,
      amount: reversalAmount,
      reason
    });

    res.json({
      success: true,
      message: 'Credit reversal completed via compensating ledger transaction',
      reversedAmount: reversalAmount,
      originalTxId: targetTx.id
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Credit Reversal Error]', err);
    res.status(500).json({ success: false, message: 'Failed to reverse credit' });
  } finally {
    conn.release();
  }
};

/**
 * 8. Attach Evidence to Complaint
 */
const uploadEvidence = async (req, res) => {
  const complaintId = parseInt(req.params.id, 10);
  const user = req.user;
  const { file_name, file_path, file_size, mime_type, description } = req.body;

  if (!file_name || !file_path) {
    return res.status(422).json({ success: false, message: 'File name and path are required' });
  }

  // Security check: validate extension
  const ext = file_name.substring(file_name.lastIndexOf('.')).toLowerCase();
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    return res.status(422).json({ success: false, message: 'Executable file types are strictly prohibited' });
  }

  try {
    const [rows] = await pool.execute('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Complaint not found' });
    const comp = rows[0];

    // Authorization check
    const isAuthorized =
      user.role === 'admin' ||
      user.id === comp.complainant_id ||
      user.id === comp.reported_user_id;

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Not authorized to attach evidence to this case' });
    }

    const [result] = await pool.execute(
      `INSERT INTO complaint_evidence (complaint_id, uploaded_by, file_name, file_path, file_size, mime_type, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [complaintId, user.id, file_name, file_path, file_size || 0, mime_type || 'application/octet-stream', description || null]
    );

    res.status(201).json({
      success: true,
      message: 'Evidence attached successfully',
      evidenceId: result.insertId
    });
  } catch (err) {
    console.error('[Upload Evidence Error]', err);
    res.status(500).json({ success: false, message: 'Failed to attach evidence' });
  }
};

/**
 * 9. Advisor Verification: Verify a student
 */
const verifyStudent = async (req, res) => {
  const { student_id, reason } = req.body;
  const user = req.user;

  if (!student_id) {
    return res.status(422).json({ success: false, message: 'Student ID is required' });
  }

  const sId = parseInt(student_id, 10);

  // A student cannot approve their own badge
  if (user.role === 'student' || user.id === sId) {
    return res.status(403).json({
      success: false,
      message: 'Students cannot approve their own Class Advisor Approved badge or award badges to peers'
    });
  }

  try {
    const [sRows] = await pool.execute(
      'SELECT id, name, advisor_id, is_advisor_approved FROM users WHERE id = ? AND role = "student"',
      [sId]
    );
    if (sRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const student = sRows[0];

    // Check scope: must be admin OR the assigned class advisor for this student
    if (user.role === 'faculty') {
      if (!student.advisor_id) {
        return res.status(403).json({ success: false, message: 'Student is not assigned to a class advisor' });
      }
      const [advRows] = await pool.execute(
        'SELECT faculty_id FROM class_advisors WHERE id = ?',
        [student.advisor_id]
      );
      if (advRows.length === 0 || advRows[0].faculty_id !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'An advisor can verify an eligible student only within their authorized scope'
        });
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        'UPDATE users SET is_advisor_approved = 1, advisor_approved_at = NOW() WHERE id = ?',
        [sId]
      );

      await conn.execute(
        `INSERT INTO advisor_verifications (student_id, advisor_id, verified_by_user_id, status, reason, verified_at)
         VALUES (?, COALESCE(?, 1), ?, 'approved', ?, NOW())`,
        [sId, student.advisor_id, user.id, reason || 'Class identity and affiliation confirmed']
      );

      await conn.commit();

      await recordAuditLog(user.id, 'advisor_badge_awarded', 'user', sId, { reason });

      res.json({
        success: true,
        message: 'Class Advisor Approved badge successfully awarded to student'
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[Verify Student Error]', err);
    res.status(500).json({ success: false, message: 'Failed to verify student' });
  }
};

/**
 * 10. Advisor Verification: Revoke a badge
 */
const revokeStudentVerification = async (req, res) => {
  const { student_id, reason } = req.body;
  const user = req.user;

  if (!reason || reason.trim().length < 5) {
    return res.status(422).json({ success: false, message: 'A recorded reason is mandatory to revoke an advisor badge' });
  }

  const sId = parseInt(student_id, 10);

  try {
    const [sRows] = await pool.execute('SELECT advisor_id FROM users WHERE id = ?', [sId]);
    if (sRows.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
    const student = sRows[0];

    // Must be admin or the assigned advisor
    if (user.role === 'faculty') {
      const [advRows] = await pool.execute('SELECT faculty_id FROM class_advisors WHERE id = ?', [student.advisor_id]);
      if (advRows.length === 0 || advRows[0].faculty_id !== user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to revoke this student badge' });
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        'UPDATE users SET is_advisor_approved = 0, advisor_approved_at = NULL WHERE id = ?',
        [sId]
      );

      await conn.execute(
        `UPDATE advisor_verifications SET status = 'revoked', revoked_at = NOW(), reason = ?
         WHERE student_id = ? AND status = 'approved'`,
        [reason.trim(), sId]
      );

      await conn.commit();

      await recordAuditLog(user.id, 'advisor_badge_revoked', 'user', sId, { reason });

      res.json({ success: true, message: 'Class Advisor Approved badge revoked' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[Revoke Badge Error]', err);
    res.status(500).json({ success: false, message: 'Failed to revoke badge' });
  }
};

/**
 * 11. Faculty Misconduct Summary & Confidential Red Review Flags
 */
const getFacultySummary = async (req, res) => {
  const THRESHOLD = parseInt(process.env.FACULTY_REVIEW_THRESHOLD || '3', 10);

  try {
    const [faculty] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.department,
              COUNT(c.id) AS total_complaints,
              SUM(CASE WHEN c.status IN ('under_review', 'awaiting_evidence', 'awaiting_response') THEN 1 ELSE 0 END) AS under_review,
              SUM(CASE WHEN c.status = 'substantiated' OR c.decision = 'substantiated' THEN 1 ELSE 0 END) AS substantiated,
              SUM(CASE WHEN c.decision = 'unsubstantiated' THEN 1 ELSE 0 END) AS unsubstantiated,
              SUM(CASE WHEN c.decision = 'partially_substantiated' THEN 1 ELSE 0 END) AS partially_substantiated
       FROM users u
       LEFT JOIN complaints c ON c.reported_user_id = u.id
       WHERE u.role = 'faculty'
       GROUP BY u.id
       ORDER BY substantiated DESC, total_complaints DESC`
    );

    const facultySummaries = faculty.map(f => {
      const subCount = parseInt(f.substantiated || 0, 10);
      const isRedFlagged = subCount >= THRESHOLD;
      return {
        id: f.id,
        name: f.name,
        email: f.email,
        department: f.department,
        total_complaints: parseInt(f.total_complaints || 0, 10),
        under_review: parseInt(f.under_review || 0, 10),
        substantiated: subCount,
        unsubstantiated: parseInt(f.unsubstantiated || 0, 10),
        partially_substantiated: parseInt(f.partially_substantiated || 0, 10),
        has_red_review_flag: isRedFlagged,
        flag_label: isRedFlagged ? 'Requires Student Welfare Review' : null
      };
    });

    res.json({
      success: true,
      threshold: THRESHOLD,
      faculty: facultySummaries
    });
  } catch (err) {
    console.error('[Faculty Summary Error]', err);
    res.status(500).json({ success: false, message: 'Failed to generate faculty summary' });
  }
};

/**
 * 12. Student Welfare Dashboard Stats
 */
const getDashboardStats = async (req, res) => {
  const THRESHOLD = parseInt(process.env.FACULTY_REVIEW_THRESHOLD || '3', 10);

  try {
    const [totalOpenRow] = await pool.execute(
      "SELECT COUNT(*) AS c FROM complaints WHERE status NOT IN ('closed')"
    );
    const [awaitingReviewRow] = await pool.execute(
      "SELECT COUNT(*) AS c FROM complaints WHERE status IN ('submitted', 'under_review')"
    );
    const [awaitingEvidenceRow] = await pool.execute(
      "SELECT COUNT(*) AS c FROM complaints WHERE status = 'awaiting_evidence'"
    );
    const [academicIntegrityRow] = await pool.execute(
      "SELECT COUNT(*) AS c FROM complaints WHERE category IN ('academic_integrity_faculty', 'academic_integrity_student')"
    );
    const [studentRelatedRow] = await pool.execute(
      `SELECT COUNT(*) AS c FROM complaints c
       JOIN users u ON u.id = c.reported_user_id WHERE u.role = 'student'`
    );
    const [facultyRelatedRow] = await pool.execute(
      `SELECT COUNT(*) AS c FROM complaints c
       JOIN users u ON u.id = c.reported_user_id WHERE u.role = 'faculty'`
    );
    const [activeWarningsRow] = await pool.execute(
      "SELECT COUNT(*) AS c FROM user_warnings WHERE status = 'active'"
    );

    // Faculty red review flags count
    const [flaggedFacultyRow] = await pool.execute(
      `SELECT COUNT(*) AS c FROM (
         SELECT reported_user_id FROM complaints
         WHERE (status = 'substantiated' OR decision = 'substantiated')
         GROUP BY reported_user_id
         HAVING COUNT(id) >= ?
       ) AS flagged`,
      [THRESHOLD]
    );

    res.json({
      success: true,
      stats: {
        totalOpen: totalOpenRow[0].c,
        awaitingReview: awaitingReviewRow[0].c,
        awaitingEvidence: awaitingEvidenceRow[0].c,
        academicIntegrity: academicIntegrityRow[0].c,
        studentRelated: studentRelatedRow[0].c,
        facultyRelated: facultyRelatedRow[0].c,
        activeWarnings: activeWarningsRow[0].c,
        facultyRedFlags: flaggedFacultyRow[0].c
      }
    });
  } catch (err) {
    console.error('[Dashboard Stats Error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard stats' });
  }
};

/**
 * 13. Warnings & Appeals List
 */
const listWarnings = async (req, res) => {
  const user = req.user;

  try {
    let query = `
      SELECT uw.*, u.name AS user_name, u.email AS user_email,
             c.complaint_ref, issuer.name AS issued_by_name
      FROM user_warnings uw
      JOIN users u ON u.id = uw.user_id
      LEFT JOIN complaints c ON c.id = uw.complaint_id
      JOIN users issuer ON issuer.id = uw.issued_by
      WHERE 1=1
    `;
    const params = [];

    if (user.role !== 'admin') {
      query += ' AND uw.user_id = ?';
      params.push(user.id);
    }

    query += ' ORDER BY uw.created_at DESC';

    const [warnings] = await pool.execute(query, params);
    res.json({ success: true, warnings });
  } catch (err) {
    console.error('[List Warnings Error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve warnings' });
  }
};

/**
 * 14. Appeal a warning
 */
const appealWarning = async (req, res) => {
  const warningId = parseInt(req.params.id, 10);
  const { appeal_notes } = req.body;

  try {
    const [rows] = await pool.execute('SELECT * FROM user_warnings WHERE id = ?', [warningId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Warning not found' });
    const warn = rows[0];

    if (warn.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot appeal someone else\'s warning' });
    }

    await pool.execute(
      'UPDATE user_warnings SET status = "appealed", reversal_reason = ? WHERE id = ?',
      [appeal_notes || 'Student submitted appeal', warningId]
    );

    res.json({ success: true, message: 'Appeal recorded for Student Welfare review' });
  } catch (err) {
    console.error('[Appeal Error]', err);
    res.status(500).json({ success: false, message: 'Failed to record appeal' });
  }
};

/**
 * 15. Reverse a warning (Student Welfare only)
 */
const reverseWarning = async (req, res) => {
  const warningId = parseInt(req.params.id, 10);
  const { reversal_reason } = req.body;

  if (!reversal_reason) {
    return res.status(422).json({ success: false, message: 'Reversal reason is required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute('SELECT * FROM user_warnings WHERE id = ? FOR UPDATE', [warningId]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Warning not found' });
    }
    const warn = rows[0];

    // If deduction was applied, restore credits
    if (warn.deduction_applied > 0) {
      await conn.execute(
        `INSERT INTO credit_transactions (user_id, amount, type, source_id, source_type, description)
         VALUES (?, ?, 'admin_adjustment', ?, 'admin', ?)`,
        [warn.user_id, warn.deduction_applied, warningId, `Reversal of warning deduction: ${reversal_reason}`]
      );
    }

    await conn.execute(
      'UPDATE user_warnings SET status = "reversed", reversal_reason = ?, reversed_by = ?, reversed_at = NOW() WHERE id = ?',
      [reversal_reason, req.user.id, warningId]
    );

    await conn.commit();

    await recordAuditLog(req.user.id, 'warning_reversed', 'warning', warningId, { reversal_reason });

    res.json({ success: true, message: 'Warning successfully reversed' });
  } catch (err) {
    await conn.rollback();
    console.error('[Reverse Warning Error]', err);
    res.status(500).json({ success: false, message: 'Failed to reverse warning' });
  } finally {
    conn.release();
  }
};

/**
 * 16. Get Class Advisors list
 */
const listAdvisors = async (req, res) => {
  try {
    const [advisors] = await pool.execute(
      `SELECT ca.*, u.name AS faculty_name, u.email AS faculty_email
       FROM class_advisors ca
       JOIN users u ON u.id = ca.faculty_id
       ORDER BY ca.department, ca.programme, ca.academic_year, ca.section`
    );
    res.json({ success: true, advisors });
  } catch (err) {
    console.error('[List Advisors Error]', err);
    res.status(500).json({ success: false, message: 'Failed to list advisors' });
  }
};

module.exports = {
  submitComplaint,
  listComplaints,
  getComplaint,
  updateComplaintStatus,
  updateInvestigationNotes,
  decideComplaint,
  reverseCreditAward,
  uploadEvidence,
  verifyStudent,
  revokeStudentVerification,
  getFacultySummary,
  getDashboardStats,
  listWarnings,
  appealWarning,
  reverseWarning,
  listAdvisors
};

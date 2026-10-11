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

  const targetId = parseInt(reported_user_id, 10);
  if (isNaN(targetId) || targetId <= 0) {
    return res.status(422).json({ success: false, message: 'Invalid reported account ID' });
  }

  if (targetId === complainantId) {
    return res.status(422).json({ success: false, message: 'You cannot submit a complaint against yourself' });
  }

  // Validate that reported user exists and is active
  const [targetRows] = await pool.execute(
    'SELECT id, name, role, is_active FROM users WHERE id = ?',
    [targetId]
  );
  if (targetRows.length === 0) {
    return res.status(422).json({ success: false, message: 'The specified reported account was not found' });
  }
  if (!targetRows[0].is_active) {
    return res.status(422).json({ success: false, message: 'The specified account is deactivated' });
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

    const safeContextType = ['help_request', 'task', 'submission', 'user', 'credit'].includes(context_type) ? context_type : null;

    const [result] = await conn.execute(
      `INSERT INTO complaints (
         complaint_ref, complainant_id, reported_user_id, category, context_type,
         context_id, description, original_work_details, original_work_date, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        complaintRef,
        complainantId,
        targetId,
        category,
        safeContextType,
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

  // A student cannot approve their own badge or award badges to peers
  if (user.role === 'student' || user.id === sId) {
    return res.status(403).json({
      success: false,
      message: 'Students cannot approve their own Class Advisor Approved badge or award badges to peers'
    });
  }

  try {
    const [sRows] = await pool.execute(
      'SELECT id, name, advisor_id, programme, academic_year, section, is_advisor_approved FROM users WHERE id = ? AND role = "student"',
      [sId]
    );
    if (sRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const student = sRows[0];

    // Check scope: must be admin OR the assigned class advisor for this student
    let effectiveAdvisorId = student.advisor_id;
    if (user.role === 'faculty') {
      const [advRows] = await pool.execute(
        'SELECT id, programme, academic_year, section FROM class_advisors WHERE faculty_id = ?',
        [user.id]
      );
      if (advRows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'An advisor can verify an eligible student only within their authorized scope'
        });
      }
      const myAdv = advRows[0];
      const matchesScope = (student.advisor_id === myAdv.id) ||
                           (student.programme === myAdv.programme &&
                            student.academic_year === myAdv.academic_year &&
                            student.section === myAdv.section);
      if (!matchesScope) {
        return res.status(403).json({
          success: false,
          message: 'An advisor can verify an eligible student only within their authorized scope'
        });
      }
      effectiveAdvisorId = myAdv.id;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        'UPDATE users SET is_advisor_approved = 1, advisor_approved_at = NOW(), advisor_id = COALESCE(advisor_id, ?) WHERE id = ?',
        [effectiveAdvisorId, sId]
      );

      await conn.execute(
        `INSERT INTO advisor_verifications (student_id, advisor_id, verified_by_user_id, status, reason, verified_at)
         VALUES (?, COALESCE(?, 1), ?, 'approved', ?, NOW())`,
        [sId, effectiveAdvisorId, user.id, reason || 'Class identity and affiliation confirmed']
      );

      await conn.commit();

      await recordAuditLog(user.id, 'advisor_badge_awarded', 'user', sId, {
        advisor_id: effectiveAdvisorId,
        reason: reason || 'Class identity and affiliation confirmed'
      });

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

  // A student cannot revoke badges
  if (user.role === 'student' || user.id === sId) {
    return res.status(403).json({ success: false, message: 'Students cannot modify verification records' });
  }

  try {
    const [sRows] = await pool.execute(
      'SELECT id, name, advisor_id, programme, academic_year, section FROM users WHERE id = ? AND role = "student"',
      [sId]
    );
    if (sRows.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
    const student = sRows[0];

    // Must be admin or the assigned advisor
    let effectiveAdvisorId = student.advisor_id;
    if (user.role === 'faculty') {
      const [advRows] = await pool.execute(
        'SELECT id, programme, academic_year, section FROM class_advisors WHERE faculty_id = ?',
        [user.id]
      );
      if (advRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized to revoke this student badge' });
      }
      const myAdv = advRows[0];
      const matchesScope = (student.advisor_id === myAdv.id) ||
                           (student.programme === myAdv.programme &&
                            student.academic_year === myAdv.academic_year &&
                            student.section === myAdv.section);
      if (!matchesScope) {
        return res.status(403).json({ success: false, message: 'Not authorized to revoke this student badge' });
      }
      effectiveAdvisorId = myAdv.id;
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

      await recordAuditLog(user.id, 'advisor_badge_revoked', 'user', sId, {
        reason: reason.trim(),
        advisor_id: effectiveAdvisorId
      });

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

/**
 * 17. Search accounts for reporting (safe: no passwords/hashes, excludes caller)
 */
const searchUsers = async (req, res) => {
  const currentUserId = req.user.id;
  const rawQuery = (req.query.q || '').toString().trim();

  // If query is empty or too short, return empty array
  if (!rawQuery || rawQuery.length < 1) {
    return res.json({ success: true, users: [] });
  }

  try {
    const searchTerm = `%${rawQuery}%`;
    const prefixTerm = `${rawQuery}%`;

    const [rows] = await pool.execute(
      `SELECT id, name, email, role, department, programme, academic_year, section, student_id_num
       FROM users
       WHERE is_active = 1
         AND id != ?
         AND role IN ('student', 'faculty')
         AND (
           name LIKE ?
           OR email LIKE ?
           OR student_id_num LIKE ?
           OR department LIKE ?
         )
       ORDER BY 
         CASE 
           WHEN name LIKE ? THEN 1 
           WHEN email LIKE ? THEN 2 
           ELSE 3 
         END,
         name ASC
       LIMIT 15`,
      [currentUserId, searchTerm, searchTerm, searchTerm, searchTerm, prefixTerm, prefixTerm]
    );

    res.json({ success: true, users: rows });
  } catch (err) {
    console.error('[Search Users Error]', err);
    res.status(500).json({ success: false, message: 'Failed to search accounts' });
  }
};

/**
 * 18. Get Class Advisor's assigned class information and students
 * Accessible to faculty and admin
 */
const getMyClassStudents = async (req, res) => {
  const user = req.user;
  const search = (req.query.q || '').trim();

  try {
    let advisorId = null;
    let classInfo = null;

    if (user.role === 'faculty') {
      const [advRows] = await pool.execute(
        `SELECT ca.*, u.name AS faculty_name, u.email AS faculty_email, u.department AS faculty_dept
         FROM class_advisors ca
         JOIN users u ON u.id = ca.faculty_id
         WHERE ca.faculty_id = ?`,
        [user.id]
      );

      if (advRows.length === 0) {
        return res.json({
          success: true,
          isAdvisor: false,
          classInfo: null,
          students: []
        });
      }

      classInfo = advRows[0];
      advisorId = classInfo.id;
    } else if (user.role === 'admin') {
      const reqAdvisorId = req.query.advisorId ? parseInt(req.query.advisorId, 10) : null;
      let advQuery = `SELECT ca.*, u.name AS faculty_name, u.email AS faculty_email, u.department AS faculty_dept
                      FROM class_advisors ca
                      JOIN users u ON u.id = ca.faculty_id`;
      const advParams = [];
      if (reqAdvisorId) {
        advQuery += ' WHERE ca.id = ?';
        advParams.push(reqAdvisorId);
      }
      advQuery += ' LIMIT 1';
      const [advRows] = await pool.execute(advQuery, advParams);
      if (advRows.length > 0) {
        classInfo = advRows[0];
        advisorId = classInfo.id;
      } else {
        return res.json({ success: true, isAdvisor: false, classInfo: null, students: [] });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Query students in this class
    let query = `
      SELECT u.id, u.name, u.email, u.student_id_num, u.department, u.programme,
             u.academic_year, u.section, u.is_advisor_approved, u.advisor_approved_at,
             u.advisor_id, u.created_at,
             av.verified_at, av.reason AS verification_reason,
             verifier.name AS verified_by_name
      FROM users u
      LEFT JOIN advisor_verifications av ON av.id = (
        SELECT MAX(id) FROM advisor_verifications WHERE student_id = u.id AND status = 'approved'
      )
      LEFT JOIN users verifier ON verifier.id = av.verified_by_user_id
      WHERE u.role = 'student'
        AND u.is_active = 1
        AND (
          u.advisor_id = ?
          OR (u.programme = ? AND u.academic_year = ? AND u.section = ?)
        )
    `;
    const params = [advisorId, classInfo.programme, classInfo.academic_year, classInfo.section];

    if (search) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.student_id_num LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY u.name ASC`;

    const [students] = await pool.execute(query, params);

    res.json({
      success: true,
      isAdvisor: true,
      classInfo: {
        id: classInfo.id,
        department: classInfo.department,
        programme: classInfo.programme,
        academic_year: classInfo.academic_year,
        section: classInfo.section,
        advisor_name: classInfo.faculty_name,
        advisor_email: classInfo.faculty_email
      },
      students
    });
  } catch (err) {
    console.error('[Get My Class Students Error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve class students' });
  }
};

/**
 * 19. Get verification audit history (Student Welfare & Class Advisors)
 */
const getVerificationHistory = async (req, res) => {
  const user = req.user;

  try {
    let query = `
      SELECT av.*, s.name AS student_name, s.email AS student_email, s.student_id_num,
             s.programme, s.academic_year, s.section,
             v.name AS verified_by_name, v.role AS verified_by_role,
             ca.programme AS class_programme, ca.section AS class_section, ca.department AS class_department
      FROM advisor_verifications av
      JOIN users s ON s.id = av.student_id
      JOIN users v ON v.id = av.verified_by_user_id
      LEFT JOIN class_advisors ca ON ca.id = av.advisor_id
      WHERE 1=1
    `;
    const params = [];

    // If faculty, only show verifications within their assigned class
    if (user.role === 'faculty') {
      const [advRows] = await pool.execute('SELECT id FROM class_advisors WHERE faculty_id = ?', [user.id]);
      if (advRows.length === 0) {
        return res.json({ success: true, history: [] });
      }
      query += ' AND av.advisor_id = ?';
      params.push(advRows[0].id);
    }

    query += ' ORDER BY COALESCE(av.revoked_at, av.verified_at) DESC LIMIT 100';

    const [history] = await pool.execute(query, params);
    res.json({ success: true, history });
  } catch (err) {
    console.error('[Get Verification History Error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve verification history' });
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
  listAdvisors,
  searchUsers,
  getMyClassStudents,
  getVerificationHistory
};

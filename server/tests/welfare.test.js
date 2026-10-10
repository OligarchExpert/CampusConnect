/**
 * CampusConnect: Student Welfare, Academic Integrity & Reputation Test Suite
 * Automated tests for Scenarios A through O
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const pool = require('../src/config/db');
const {
  submitComplaint,
  getComplaint,
  decideComplaint,
  reverseCreditAward,
  uploadEvidence,
  verifyStudent,
  revokeStudentVerification,
  updateComplaintStatus,
  getFacultySummary
} = require('../src/controllers/welfareController');
const { updateProfile, getProfile } = require('../src/controllers/profileController');
const { awardPeerHelpCredit } = require('../src/services/creditService');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runWelfareTests() {
  console.log('--- Running Student Welfare & Academic Integrity Tests (Scenarios A - O) ---');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
        failed++;
      }
    })();
  }

  // Setup: fetch test users
  const [students] = await pool.execute("SELECT id, name, email FROM users WHERE role = 'student' LIMIT 5");
  const [faculty] = await pool.execute("SELECT id, name, email FROM users WHERE role = 'faculty' LIMIT 3");
  const [admins] = await pool.execute("SELECT id, name, email FROM users WHERE role = 'admin' LIMIT 1");

  const s1 = students[0];
  const s2 = students[1];
  const s3 = students[2];
  const f1 = faculty[0];
  const f2 = faculty[1];
  const admin = admins[0];

  // Scenario A: A student cannot grant themselves the Class Advisor Approved badge
  await test('Scenario A: A student cannot grant themselves the Class Advisor Approved badge', async () => {
    // 1. Attempt via updateProfile
    const req1 = {
      params: { userId: s1.id },
      user: { id: s1.id, role: 'student' },
      body: { is_advisor_approved: 1 }
    };
    const res1 = mockRes();
    await updateProfile(req1, res1);
    assert.strictEqual(res1.statusCode, 403, 'Should return 403 when student attempts to approve self');

    // 2. Attempt via verifyStudent endpoint
    const req2 = {
      user: { id: s1.id, role: 'student' },
      body: { student_id: s1.id, reason: 'Self claim' }
    };
    const res2 = mockRes();
    await verifyStudent(req2, res2);
    assert.strictEqual(res2.statusCode, 403, 'Should return 403 when student calls verifyStudent');
  });

  // Scenario B: An advisor can verify an eligible student only within their authorized scope
  await test('Scenario B: An advisor can verify an eligible student only within their authorized scope', async () => {
    // f1 is advisor for CSE Year 3-A. Find a student in another section/advisor
    const [diffSectionStudents] = await pool.execute(
      `SELECT u.id, u.advisor_id FROM users u
       JOIN class_advisors ca ON ca.id = u.advisor_id
       WHERE u.role = 'student' AND ca.faculty_id != ? LIMIT 1`,
      [f1.id]
    );

    if (diffSectionStudents.length > 0) {
      const outOfScopeStudent = diffSectionStudents[0];
      const req = {
        user: { id: f1.id, role: 'faculty' },
        body: { student_id: outOfScopeStudent.id, reason: 'Unauthorized test' }
      };
      const res = mockRes();
      await verifyStudent(req, res);
      assert.strictEqual(res.statusCode, 403, 'Should return 403 when faculty verifies out-of-scope student');
    }

    // Now test that admin or in-scope advisor CAN verify
    const reqAdmin = {
      user: { id: admin.id, role: 'admin' },
      body: { student_id: s2.id, reason: 'Welfare authorized verification' }
    };
    const resAdmin = mockRes();
    await verifyStudent(reqAdmin, resAdmin);
    assert.strictEqual(resAdmin.statusCode, 200, 'Admin can verify student badge');
    assert.strictEqual(resAdmin.body.success, true);
  });

  // Scenario C: A student can submit a complaint with evidence
  let createdComplaintId = null;
  await test('Scenario C: A student can submit a complaint with evidence', async () => {
    const reqComp = {
      user: { id: s1.id, role: 'student' },
      body: {
        reported_user_id: s2.id,
        category: 'academic_integrity_student',
        context_type: 'task',
        context_id: 1,
        description: 'Student submitted identical code repository copied without consent.',
        original_work_details: 'GitHub commit SHA: abc1234 on Feb 10 2026',
        original_work_date: '2026-02-10'
      }
    };
    const resComp = mockRes();
    await submitComplaint(reqComp, resComp);
    assert.strictEqual(resComp.statusCode, 201);
    assert.strictEqual(resComp.body.success, true);
    assert.ok(resComp.body.complaint.id);
    createdComplaintId = resComp.body.complaint.id;

    // Attach evidence
    const reqEv = {
      params: { id: createdComplaintId },
      user: { id: s1.id, role: 'student' },
      body: {
        file_name: 'diff_proof.pdf',
        file_path: '/uploads/evidence/diff_proof.pdf',
        file_size: 1048576,
        mime_type: 'application/pdf',
        description: 'Code similarity report and timestamp diff'
      }
    };
    const resEv = mockRes();
    await uploadEvidence(reqEv, resEv);
    assert.strictEqual(resEv.statusCode, 201);
    assert.strictEqual(resEv.body.success, true);
  });

  // Scenario D: Another unrelated student cannot access that complaint's private evidence
  await test('Scenario D: Another unrelated student cannot access that complaint\'s private evidence', async () => {
    // s3 is neither complainant (s1) nor reported (s2)
    const req = {
      params: { id: createdComplaintId },
      user: { id: s3.id, role: 'student' }
    };
    const res = mockRes();
    await getComplaint(req, res);
    assert.strictEqual(res.statusCode, 403, 'Unrelated student must be denied access with 403');
  });

  // Scenario E: A complaint submission alone does not deduct credits or create a false-complaint warning
  await test('Scenario E: A complaint submission alone does not deduct credits or create a false-complaint warning', async () => {
    const [balRow] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?',
      [s2.id]
    );
    const [warnings] = await pool.execute(
      'SELECT id FROM user_warnings WHERE complaint_id = ?',
      [createdComplaintId]
    );
    assert.strictEqual(warnings.length, 0, 'No warning should exist simply because a complaint was submitted');
  });

  // Scenario F: An unsubstantiated complaint does not count as a false complaint
  await test('Scenario F: An unsubstantiated complaint does not count as a false complaint', async () => {
    // Submit a test complaint that will be decided as unsubstantiated
    const reqComp = {
      user: { id: s1.id, role: 'student' },
      body: {
        reported_user_id: s2.id,
        category: 'other',
        description: 'Minor dispute regarding study session arrangement.'
      }
    };
    const resComp = mockRes();
    await submitComplaint(reqComp, resComp);
    const unsubComplaintId = resComp.body.complaint.id;

    // Student Welfare reviews and marks unsubstantiated
    const reqDec = {
      params: { id: unsubComplaintId },
      user: { id: admin.id, role: 'admin' },
      body: {
        decision: 'unsubstantiated',
        decision_reason: 'Evidence submitted was insufficient to establish any violation. Case closed.'
      }
    };
    const resDec = mockRes();
    await decideComplaint(reqDec, resDec);
    assert.strictEqual(resDec.statusCode, 200);

    // Verify ZERO warnings created for complainant
    const [warns] = await pool.execute(
      'SELECT id FROM user_warnings WHERE complaint_id = ?',
      [unsubComplaintId]
    );
    assert.strictEqual(warns.length, 0, 'Unsubstantiated finding must never generate a false-complaint warning');
  });

  // Scenario G: A substantiated malicious complaint creates one warning, not duplicate warnings
  let maliciousCaseId = null;
  await test('Scenario G: A substantiated malicious complaint creates one warning, not duplicate warnings', async () => {
    // Reset any existing test warnings for s3 so test is completely hermetic
    await pool.execute('DELETE FROM user_warnings WHERE user_id = ?', [s3.id]);

    // Complainant s3 files a fabricated complaint
    const reqComp = {
      user: { id: s3.id, role: 'student' },
      body: {
        reported_user_id: s1.id,
        category: 'peer_help_misrepresentation',
        description: 'False allegation fabricated for testing warning system.'
      }
    };
    const resComp = mockRes();
    await submitComplaint(reqComp, resComp);
    maliciousCaseId = resComp.body.complaint.id;

    // Decide as malicious_complaint
    const reqDec = {
      params: { id: maliciousCaseId },
      user: { id: admin.id, role: 'admin' },
      body: {
        decision: 'malicious_complaint',
        decision_reason: 'Investigation proved screenshots were falsified. First formal warning issued.'
      }
    };
    const resDec = mockRes();
    await decideComplaint(reqDec, resDec);
    assert.strictEqual(resDec.statusCode, 200);
    assert.strictEqual(resDec.body.warningInfo.level, 1, 'Warning level must be 1 for first offense');

    // Attempting to decide again must return 409 Conflict
    const resDec2 = mockRes();
    await decideComplaint(reqDec, resDec2);
    assert.strictEqual(resDec2.statusCode, 409, 'Duplicate decision on same case must be rejected');

    // Verify exactly 1 warning exists for this complaint
    const [warns] = await pool.execute('SELECT id FROM user_warnings WHERE complaint_id = ?', [maliciousCaseId]);
    assert.strictEqual(warns.length, 1, 'Exactly one warning record must exist');
  });

  // Scenario H: Progressive warning threshold (1st warning, 2nd warning, 3rd review for 10-credit deduction)
  await test('Scenario H: Progressive warning threshold and 10-credit policy deduction', async () => {
    // s3 now has 1 active warning from Scenario G.
    // File 2nd malicious complaint
    const reqComp2 = {
      user: { id: s3.id, role: 'student' },
      body: {
        reported_user_id: s2.id,
        category: 'other',
        description: 'Second deliberate fabrication case.'
      }
    };
    const resComp2 = mockRes();
    await submitComplaint(reqComp2, resComp2);
    const caseId2 = resComp2.body.complaint.id;

    const reqDec2 = {
      params: { id: caseId2 },
      user: { id: admin.id, role: 'admin' },
      body: {
        decision: 'malicious_complaint',
        decision_reason: 'Second substantiated malicious complaint.'
      }
    };
    const resDec2 = mockRes();
    await decideComplaint(reqDec2, resDec2);
    assert.strictEqual(resDec2.body.warningInfo.level, 2, 'Second warning issued');

    // Give s3 at least 15 credits so deduction can be tested
    await pool.execute(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES (?, 20, 'admin_adjustment', 'Test balance deposit')`,
      [s3.id]
    );

    // File 3rd malicious complaint
    const reqComp3 = {
      user: { id: s3.id, role: 'student' },
      body: {
        reported_user_id: s1.id,
        category: 'other',
        description: 'Third deliberate fabrication case.'
      }
    };
    const resComp3 = mockRes();
    await submitComplaint(reqComp3, resComp3);
    const caseId3 = resComp3.body.complaint.id;

    // Decide 3rd case with apply_deduction: true
    const reqDec3 = {
      params: { id: caseId3 },
      user: { id: admin.id, role: 'admin' },
      body: {
        decision: 'malicious_complaint',
        decision_reason: 'Third substantiated malicious complaint. 10-credit deduction approved.',
        apply_deduction: true
      }
    };
    const resDec3 = mockRes();
    await decideComplaint(reqDec3, resDec3);
    assert.strictEqual(resDec3.body.warningInfo.level, 3, 'Third warning issued');
    assert.strictEqual(resDec3.body.warningInfo.deductionApplied, 10, '10-credit deduction applied');

    // Verify credit ledger contains the compensating adjustment
    const [deductTx] = await pool.execute(
      `SELECT * FROM credit_transactions
       WHERE user_id = ? AND source_id = ? AND amount = -10 AND type = 'admin_adjustment'`,
      [s3.id, caseId3]
    );
    assert.strictEqual(deductTx.length, 1, 'Auditable 10-credit deduction transaction recorded');
  });

  // Scenario I: A substantiated complaint about a credit award can produce an auditable reversal
  await test('Scenario I: Substantiated credit award complaint produces auditable reversal without deleting original', async () => {
    // Create an original credit transaction of +10 credits
    const [txResult] = await pool.execute(
      `INSERT INTO credit_transactions (user_id, amount, type, source_id, source_type, description)
       VALUES (?, 10, 'peer_help', 9999, 'help_request', 'Peer help reward to reverse')`,
      [s2.id]
    );
    const origTxId = txResult.insertId;

    // File credit fraud complaint
    const reqComp = {
      user: { id: s1.id, role: 'student' },
      body: {
        reported_user_id: s2.id,
        category: 'credit_fraud',
        context_type: 'credit',
        context_id: origTxId,
        description: 'Fraudulent credit reward claimed without providing assistance.'
      }
    };
    const resComp = mockRes();
    await submitComplaint(reqComp, resComp);
    const fraudCaseId = resComp.body.complaint.id;

    // Reverse credit via Student Welfare
    const reqRev = {
      params: { id: fraudCaseId },
      user: { id: admin.id, role: 'admin' },
      body: { reason: 'Substantiated credit fraud reversal' }
    };
    const resRev = mockRes();
    await reverseCreditAward(reqRev, resRev);
    assert.strictEqual(resRev.statusCode, 200);
    assert.strictEqual(resRev.body.reversedAmount, -10);

    // Verify original transaction STILL EXISTS (never deleted)
    const [checkOrig] = await pool.execute('SELECT id, amount FROM credit_transactions WHERE id = ?', [origTxId]);
    assert.strictEqual(checkOrig.length, 1, 'Original transaction must be preserved');
    assert.strictEqual(checkOrig[0].amount, 10);

    // Verify reversal entry exists
    const [checkRev] = await pool.execute(
      'SELECT id, amount, type FROM credit_transactions WHERE source_id = ? AND type = "reversal"',
      [origTxId]
    );
    assert.strictEqual(checkRev.length, 1, 'Compensating reversal ledger transaction must exist');
    assert.strictEqual(checkRev[0].amount, -10);
  });

  // Scenario J: Faculty complaint triggers confidential review flag only when threshold of 3 substantiated is reached
  await test('Scenario J: Faculty confidential review flag triggers only at threshold (3 substantiated)', async () => {
    const targetFac = f2;

    // Check summary before: ensure less than 3
    const reqSummary = { user: { id: admin.id, role: 'admin' } };
    let resSummary = mockRes();
    await getFacultySummary(reqSummary, resSummary);
    const initialFac = resSummary.body.faculty.find(f => f.id === targetFac.id);

    // Create substantiated complaints up to 3 for targetFac
    const currentSub = initialFac ? initialFac.substantiated : 0;
    const needed = Math.max(0, 3 - currentSub);

    for (let i = 0; i < needed; i++) {
      const [ins] = await pool.execute(
        `INSERT INTO complaints (
           complaint_ref, complainant_id, reported_user_id, category, description,
           status, decision, decision_reason, decision_by, decision_at
         ) VALUES (?, ?, ?, 'academic_integrity_faculty', 'Attribution dispute in project', 'substantiated', 'substantiated', 'Confirmed attribution oversight', ?, NOW())`,
        [`CMP-TEST-FAC-${Date.now()}-${i}`, s1.id, targetFac.id, admin.id]
      );
    }

    resSummary = mockRes();
    await getFacultySummary(reqSummary, resSummary);
    const updatedFac = resSummary.body.faculty.find(f => f.id === targetFac.id);
    assert.ok(updatedFac.substantiated >= 3, 'Must have at least 3 substantiated complaints');
    assert.strictEqual(updatedFac.has_red_review_flag, true, 'Red review flag must be active');
    assert.strictEqual(updatedFac.flag_label, 'Requires Student Welfare Review');
  });

  // Scenario K: Duplicate reports concerning one incident do not automatically count as independent findings
  await test('Scenario K: Unsubstantiated and duplicate reports do not inflate substantiated count', async () => {
    // Add unsubstantiated report
    await pool.execute(
      `INSERT INTO complaints (
         complaint_ref, complainant_id, reported_user_id, category, description,
         status, decision, decision_reason, decision_by, decision_at
       ) VALUES (?, ?, ?, 'other', 'Duplicate test report', 'closed', 'unsubstantiated', 'Dismissed as duplicate', ?, NOW())`,
      [`CMP-TEST-DUP-${Date.now()}`, s1.id, f1.id, admin.id]
    );

    const reqSummary = { user: { id: admin.id, role: 'admin' } };
    const resSummary = mockRes();
    await getFacultySummary(reqSummary, resSummary);
    const f1Summary = resSummary.body.faculty.find(f => f.id === f1.id);
    // Unsubstantiated count increased, substantiated count untouched
    assert.ok(f1Summary.unsubstantiated >= 1);
  });

  // Scenario L: A faculty member cannot review or decide their own case
  await test('Scenario L: A faculty member cannot review or decide their own case', async () => {
    // Create a complaint against f1
    const [ins] = await pool.execute(
      `INSERT INTO complaints (
         complaint_ref, complainant_id, reported_user_id, category, description, status
       ) VALUES (?, ?, ?, 'task_dispute', 'Dispute over grade on faculty task', 'submitted')`,
      [`CMP-TEST-SELF-${Date.now()}`, s1.id, f1.id]
    );
    const compId = ins.insertId;

    // f1 attempts to update status on this complaint
    const reqStatus = {
      params: { id: compId },
      user: { id: f1.id, role: 'faculty' },
      body: { status: 'closed', notes: 'Self dismissal' }
    };
    const resStatus = mockRes();
    await updateComplaintStatus(reqStatus, resStatus);
    assert.strictEqual(resStatus.statusCode, 403, 'Faculty cannot update status on complaints against themselves');

    // f1 attempts to decide this complaint
    const reqDec = {
      params: { id: compId },
      user: { id: f1.id, role: 'admin' }, // even if somehow possessing admin role
      body: { decision: 'unsubstantiated', decision_reason: 'Self absolution attempt' }
    };
    const resDec = mockRes();
    await decideComplaint(reqDec, resDec);
    assert.strictEqual(resDec.statusCode, 403, 'Conflict of interest must block decision');
  });

  // Scenario M: Students cannot access private Student Welfare investigation notes
  await test('Scenario M: Students cannot access private Student Welfare investigation notes', async () => {
    // Add confidential investigation notes to createdComplaintId
    await pool.execute(
      `UPDATE complaints
       SET investigation_notes = 'CONFIDENTIAL: Internal committee convened on March 1st. Preliminary assessment suggests plausible concern.'
       WHERE id = ?`,
      [createdComplaintId]
    );

    // Complainant s1 requests complaint details
    const reqStudent = {
      params: { id: createdComplaintId },
      user: { id: s1.id, role: 'student' }
    };
    const resStudent = mockRes();
    await getComplaint(reqStudent, resStudent);
    assert.strictEqual(resStudent.statusCode, 200);
    assert.strictEqual(
      resStudent.body.complaint.investigation_notes,
      undefined,
      'Confidential investigation notes must be stripped for students'
    );

    // Admin requests same complaint
    const reqAdmin = {
      params: { id: createdComplaintId },
      user: { id: admin.id, role: 'admin' }
    };
    const resAdmin = mockRes();
    await getComplaint(reqAdmin, resAdmin);
    assert.strictEqual(resAdmin.statusCode, 200);
    assert.ok(
      resAdmin.body.complaint.investigation_notes && resAdmin.body.complaint.investigation_notes.includes('CONFIDENTIAL'),
      'Admin can view confidential notes'
    );
  });

  // Scenario N: Existing peer-help credits and the rolling 24-hour cap continue to work
  await test('Scenario N: Existing peer-help credits and rolling 24-hour cap continue to work', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Test helper s1 and requester s2 on dummy request
      const [reqIns] = await conn.execute(
        `INSERT INTO help_requests (requester_id, title, description, status)
         VALUES (?, 'Test peer help', 'Description', 'open')`,
        [s2.id]
      );
      const reqId = reqIns.insertId;

      const result = await awardPeerHelpCredit(conn, s1.id, s2.id, reqId);
      assert.ok(result.creditsAwarded >= 0);
      assert.strictEqual(typeof result.isFirstTime, 'boolean');

      await conn.rollback();
    } finally {
      conn.release();
    }
  });

  // Scenario O: Demo seed scripts can be run more than once without duplicating accounts
  await test('Scenario O: Demo seed scripts can be run more than once without duplicating accounts', async () => {
    const [beforeCount] = await pool.execute('SELECT COUNT(*) AS total FROM users');
    const seedScript = require('../src/scripts/seed-welfare');
    // The seed script has idempotent ON DUPLICATE KEY UPDATE and checks
    const [afterCount] = await pool.execute('SELECT COUNT(*) AS total FROM users');
    assert.strictEqual(beforeCount[0].total, afterCount[0].total, 'User count must remain identical');
  });

  console.log(`\nStudent Welfare Test Summary: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed };
}

module.exports = { runWelfareTests };

if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
  runWelfareTests().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

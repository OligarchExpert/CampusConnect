require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function seedWelfare() {
  console.log('[Seed Welfare] Starting comprehensive seed for 20 students, 8 faculty, advisors, and cases...');
  const conn = await pool.getConnection();

  try {
    // 1. Run seed-welfare-demo.sql
    const sqlPath = path.resolve(__dirname, '../../../database/seed-welfare-demo.sql');
    const rawSql = fs.readFileSync(sqlPath, 'utf8');
    const cleanSql = rawSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log('[Seed Welfare] User accounts inserted/updated.');

    // 2. Fetch faculty IDs
    const [facultyRows] = await conn.query("SELECT id, email, name FROM users WHERE role = 'faculty' ORDER BY id ASC");
    const facMap = {};
    facultyRows.forEach(f => { facMap[f.email] = f.id; });

    // 3. Setup Class Advisors
    // Faculty 1: CSE Year 3-A
    // Faculty 2: CSE Year 4-B
    // Faculty 3: AI&DS Year 2-A
    // Faculty 4: AI&DS Year 3-B
    // Faculty 5: ECE Year 3-A
    // Faculty 6: ECE Year 4-A
    // Faculty 7: ME Year 2-A
    // Faculty 8: CYS Year 3-A
    const advisorDefs = [
      { email: facMap['meera.nair@cb.amrita.edu'] ? 'meera.nair@cb.amrita.edu' : 'faculty01@cb.amrita.edu', dept: 'Computer Science and Engineering', prog: 'B.Tech CSE', yr: 3, sec: 'CSE-A' },
      { email: 'faculty02@cb.amrita.edu', dept: 'Computer Science and Engineering', prog: 'B.Tech CSE', yr: 4, sec: 'CSE-B' },
      { email: 'faculty03@cb.amrita.edu', dept: 'Artificial Intelligence & Data Science', prog: 'B.Tech AI & DS', yr: 2, sec: 'AIE-A' },
      { email: facMap['arun.kumar@cb.amrita.edu'] ? 'arun.kumar@cb.amrita.edu' : 'faculty04@cb.amrita.edu', dept: 'Artificial Intelligence & Data Science', prog: 'B.Tech AI & DS', yr: 3, sec: 'AIE-B' },
      { email: facMap['lakshmi.menon@cb.amrita.edu'] ? 'lakshmi.menon@cb.amrita.edu' : 'faculty05@cb.amrita.edu', dept: 'Electronics and Communication Engineering', prog: 'B.Tech ECE', yr: 3, sec: 'ECE-A' },
      { email: 'faculty06@cb.amrita.edu', dept: 'Electronics and Communication Engineering', prog: 'B.Tech ECE', yr: 4, sec: 'ECE-A' },
      { email: 'faculty07@cb.amrita.edu', dept: 'Mechanical Engineering', prog: 'B.Tech ME', yr: 2, sec: 'ME-A' },
      { email: 'faculty08@cb.amrita.edu', dept: 'Cyber Security', prog: 'B.Tech CYS', yr: 3, sec: 'CYS-A' }
    ];

    for (const a of advisorDefs) {
      const facId = facMap[a.email];
      if (facId) {
        await conn.query(
          `INSERT INTO class_advisors (faculty_id, department, programme, academic_year, section)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id)`,
          [facId, a.dept, a.prog, a.yr, a.sec]
        );
      }
    }
    console.log('[Seed Welfare] Class advisor assignments established.');

    // 4. Link students to their class advisors based on programme + year + section
    const [advisors] = await conn.query('SELECT id, programme, academic_year, section FROM class_advisors');
    for (const adv of advisors) {
      await conn.query(
        `UPDATE users SET advisor_id = ?
         WHERE role = 'student' AND programme = ? AND academic_year = ? AND section = ?`,
        [adv.id, adv.programme, adv.academic_year, adv.section]
      );
    }
    console.log('[Seed Welfare] Students linked to class advisors.');

    // 5. Establish Advisor Verifications for a subset of students
    // Fetch students with an advisor
    const [studentsWithAdv] = await conn.query(
      "SELECT id, name, advisor_id FROM users WHERE role = 'student' AND advisor_id IS NOT NULL"
    );

    // Verify select students (e.g. half of them), keeping Arjun and Rahul unapproved for advisor testing
    const approvedIndices = [0, 1, 3, 5, 7, 9, 11, 15, 17];
    for (const idx of approvedIndices) {
      if (studentsWithAdv[idx]) {
        const s = studentsWithAdv[idx];
        if (s.name === 'Arjun' || s.name === 'Rahul') continue;
        const [advRows] = await conn.query('SELECT faculty_id FROM class_advisors WHERE id = ?', [s.advisor_id]);
        const facId = advRows[0]?.faculty_id;

        if (facId) {
          // Check if already verified
          const [existingVer] = await conn.query(
            'SELECT id FROM advisor_verifications WHERE student_id = ? AND status = "approved"',
            [s.id]
          );
          if (existingVer.length === 0) {
            await conn.query(
              `INSERT INTO advisor_verifications (student_id, advisor_id, verified_by_user_id, status, reason, verified_at)
               VALUES (?, ?, ?, 'approved', 'Class identity and student registration confirmed during semester verification cycle.', NOW())`,
              [s.id, s.advisor_id, facId]
            );
          }
          await conn.query(
            'UPDATE users SET is_advisor_approved = 1, advisor_approved_at = NOW() WHERE id = ?',
            [s.id]
          );
        }
      }
    }
    console.log('[Seed Welfare] Class Advisor Approved badges assigned.');

    // 6. Give students skills
    const [allSkills] = await conn.query('SELECT id, name FROM skills');
    const skillMap = {};
    allSkills.forEach(sk => { skillMap[sk.name.toLowerCase()] = sk.id; });

    const studentSkillAssignments = [
      { email: 'student01@cb.students.amrita.edu', skills: [{ name: 'React', prof: 'advanced' }, { name: 'Node.js', prof: 'intermediate' }, { name: 'JavaScript', prof: 'advanced' }] },
      { email: 'student02@cb.students.amrita.edu', skills: [{ name: 'SQL', prof: 'advanced' }, { name: 'Python', prof: 'intermediate' }, { name: 'Data Analysis', prof: 'intermediate' }] },
      { email: 'student03@cb.students.amrita.edu', skills: [{ name: 'C++', prof: 'expert' }, { name: 'Java', prof: 'advanced' }, { name: 'Python', prof: 'intermediate' }] },
      { email: 'student04@cb.students.amrita.edu', skills: [{ name: 'Docker', prof: 'advanced' }, { name: 'Kubernetes', prof: 'intermediate' }, { name: 'Linux', prof: 'advanced' }, { name: 'AWS', prof: 'intermediate' }] },
      { email: 'student05@cb.students.amrita.edu', skills: [{ name: 'Figma', prof: 'expert' }, { name: 'UI/UX Design', prof: 'expert' }, { name: 'HTML/CSS', prof: 'advanced' }, { name: 'React', prof: 'intermediate' }] },
      { email: 'student06@cb.students.amrita.edu', skills: [{ name: 'Python', prof: 'advanced' }, { name: 'Machine Learning', prof: 'intermediate' }, { name: 'Deep Learning', prof: 'intermediate' }] },
      { email: 'student07@cb.students.amrita.edu', skills: [{ name: 'Statistics', prof: 'advanced' }, { name: 'Data Analysis', prof: 'advanced' }, { name: 'Python', prof: 'intermediate' }] },
      { email: 'student08@cb.students.amrita.edu', skills: [{ name: 'Python', prof: 'advanced' }, { name: 'Machine Learning', prof: 'advanced' }, { name: 'Technical Writing', prof: 'intermediate' }] },
      { email: 'student16@cb.students.amrita.edu', skills: [{ name: 'Linux', prof: 'advanced' }, { name: 'Python', prof: 'advanced' }, { name: 'Git', prof: 'intermediate' }] },
      { email: 'student18@cb.students.amrita.edu', skills: [{ name: 'React', prof: 'intermediate' }, { name: 'JavaScript', prof: 'intermediate' }, { name: 'HTML/CSS', prof: 'advanced' }] }
    ];

    for (const sa of studentSkillAssignments) {
      const [uRows] = await conn.query('SELECT id FROM users WHERE email = ?', [sa.email]);
      if (uRows.length > 0) {
        const uId = uRows[0].id;
        for (const s of sa.skills) {
          const sId = skillMap[s.name.toLowerCase()];
          if (sId) {
            await conn.query(
              'INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency) VALUES (?, ?, ?)',
              [uId, sId, s.prof]
            );
          }
        }
      }
    }
    console.log('[Seed Welfare] Student skill profiles populated.');

    // 7. Seed Sample Complaints with diverse statuses & categories
    const [adminRows] = await conn.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminRows[0]?.id || 1;

    const [s1] = await conn.query("SELECT id FROM users WHERE email = 'student01@cb.students.amrita.edu'");
    const [s2] = await conn.query("SELECT id FROM users WHERE email = 'student02@cb.students.amrita.edu'");
    const [s3] = await conn.query("SELECT id FROM users WHERE email = 'student03@cb.students.amrita.edu'");
    const [s4] = await conn.query("SELECT id FROM users WHERE email = 'student04@cb.students.amrita.edu'");
    const [fac3] = await conn.query("SELECT id FROM users WHERE email = 'faculty03@cb.amrita.edu'");

    if (s1.length && s2.length && s3.length && s4.length && fac3.length) {
      const sampleCases = [
        {
          ref: 'CMP-2026-0001',
          complainant: s1[0].id,
          reported: s2[0].id,
          cat: 'peer_help_misrepresentation',
          ctxType: 'help_request',
          desc: 'Helper claimed advanced MySQL database knowledge but provided incorrect queries that crashed my local environment and refused to help resolve it.',
          status: 'submitted',
          decision: 'none'
        },
        {
          ref: 'CMP-2026-0002',
          complainant: s3[0].id,
          reported: s4[0].id,
          cat: 'credit_fraud',
          ctxType: 'credit',
          desc: 'Observed peer repeatedly creating artificial 1-minute help sessions to accumulate credits without actual learning exchange.',
          status: 'under_review',
          decision: 'none'
        },
        {
          ref: 'CMP-2026-0003',
          complainant: s1[0].id,
          reported: fac3[0].id,
          cat: 'academic_integrity_faculty',
          ctxType: 'task',
          desc: 'Submitted original machine learning benchmark implementation as part of course assistance task. The faculty member subsequently published similar code without acknowledging student research contribution.',
          originalWork: 'Deep learning benchmark script repository, created on Feb 12 2026 in branch feature/benchmark-v1 with SHA commit hash history.',
          origDate: '2026-02-12',
          status: 'awaiting_evidence',
          decision: 'none'
        },
        {
          ref: 'CMP-2026-0004',
          complainant: s2[0].id,
          reported: fac3[0].id,
          cat: 'academic_integrity_faculty',
          ctxType: 'task',
          desc: 'Research paper assistant task: My data preprocessing pipeline was incorporated into a published workshop paper without student co-authorship or acknowledgment.',
          originalWork: 'Pandas data cleaning pipeline repository with git history from Jan 2026.',
          origDate: '2026-01-15',
          status: 'substantiated',
          decision: 'substantiated',
          decisionReason: 'Investigation confirmed that the student pipeline was utilized with verbatim variable naming without attribution.',
          decisionBy: adminId
        },
        {
          ref: 'CMP-2026-0005',
          complainant: s4[0].id,
          reported: fac3[0].id,
          cat: 'task_dispute',
          ctxType: 'task',
          desc: 'Arbitrary rejection of completed dataset annotation task without feedback despite following all documented requirements.',
          status: 'substantiated',
          decision: 'substantiated',
          decisionReason: 'Review of task submissions confirmed complete compliance with original specifications; credits awarded to student.',
          decisionBy: adminId
        },
        {
          ref: 'CMP-2026-0006',
          complainant: s3[0].id,
          reported: s1[0].id,
          cat: 'peer_help_misrepresentation',
          ctxType: 'help_request',
          desc: 'Student falsely claimed that Radhakrishna provided plagiarized solutions.',
          status: 'closed',
          decision: 'malicious_complaint',
          decisionReason: 'Clear evidence showed the complainant fabricated screenshots in an attempt to damage peer standing. First formal warning issued.',
          decisionBy: adminId
        }
      ];

      for (const sc of sampleCases) {
        const [existingCase] = await conn.query('SELECT id FROM complaints WHERE complaint_ref = ?', [sc.ref]);
        if (existingCase.length === 0) {
          const [ins] = await conn.query(
            `INSERT INTO complaints (
               complaint_ref, complainant_id, reported_user_id, category, context_type,
               description, original_work_details, original_work_date, status,
               decision, decision_reason, decision_by, decision_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sc.ref, sc.complainant, sc.reported, sc.cat, sc.ctxType,
              sc.desc, sc.originalWork || null, sc.origDate || null, sc.status,
              sc.decision, sc.decisionReason || null, sc.decisionBy || null, sc.decisionBy ? new Date() : null
            ]
          );

          // Add history
          await conn.query(
            `INSERT INTO complaint_status_history (complaint_id, from_status, to_status, changed_by, notes)
             VALUES (?, 'submitted', ?, ?, ?)`,
            [ins.insertId, sc.status, adminId, 'Initial seed status establishment']
          );

          // If malicious complaint, add warning
          if (sc.decision === 'malicious_complaint') {
            await conn.query(
              `INSERT INTO user_warnings (user_id, complaint_id, warning_level, reason, issued_by)
               VALUES (?, ?, 1, 'Fabricated complaint submitted in CMP-2026-0006 with intent to mislead reviewers.', ?)`,
              [sc.complainant, ins.insertId, adminId]
            );
          }
        }
      }
      console.log('[Seed Welfare] Sample complaints and demonstration cases established.');
    }

    console.log('[Seed Welfare] Comprehensive Student Welfare seed completed successfully! 🎉');
  } catch (err) {
    console.error('[Seed Welfare Error]', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  seedWelfare()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedWelfare };

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function migrate() {
  console.log('[Migration] Starting Student Welfare schema migration...');
  const conn = await pool.getConnection();

  try {
    // 1. Safe column additions to `users`
    const columnsToAdd = [
      { name: 'student_id_num', spec: 'VARCHAR(50) DEFAULT NULL' },
      { name: 'programme', spec: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'academic_year', spec: 'INT UNSIGNED DEFAULT NULL' },
      { name: 'section', spec: 'VARCHAR(20) DEFAULT NULL' },
      { name: 'advisor_id', spec: 'INT UNSIGNED DEFAULT NULL' },
      { name: 'is_advisor_approved', spec: 'TINYINT(1) NOT NULL DEFAULT 0' },
      { name: 'advisor_approved_at', spec: 'DATETIME DEFAULT NULL' },
      { name: 'faculty_verified_skills', spec: 'TEXT DEFAULT NULL' }
    ];

    const [existingCols] = await conn.query('DESCRIBE users');
    const existingColNames = existingCols.map(c => c.Field);

    for (const col of columnsToAdd) {
      if (!existingColNames.includes(col.name)) {
        console.log(`[Migration] Adding column users.${col.name}...`);
        await conn.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.spec}`);
      } else {
        console.log(`[Migration] Column users.${col.name} already exists.`);
      }
    }

    // 2. Execute table creations from SQL file
    const sqlPath = path.resolve(__dirname, '../../../database/migration_welfare.sql');
    const rawSql = fs.readFileSync(sqlPath, 'utf8');
    // Strip comment lines
    const cleanSql = rawSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      console.log(`[Migration] Executing: ${stmt.substring(0, 40).replace(/\n/g, ' ')}...`);
      await conn.query(stmt);
    }

    console.log('[Migration] All Student Welfare tables created successfully!');
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();

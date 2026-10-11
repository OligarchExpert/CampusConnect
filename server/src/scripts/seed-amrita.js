/**
 * CampusConnect: Amrita Demo Data Seeder (Development Only)
 *
 * Populates realistic demonstration student and faculty personas:
 * - Radhakrishna (radhakrishna@cb.students.amrita.edu)
 * - Anu (anu.demo@cb.students.amrita.edu)
 * - Rahul (rahul.demo@cb.students.amrita.edu)
 * - Priya (priya.demo@cb.students.amrita.edu)
 * - Demo Faculty (faculty.demo@cb.amrita.edu)
 * - Demo Administrator (admin.demo@cb.amrita.edu)
 *
 * Password for all demo accounts: "Demo1234!"
 *
 * Idempotent: Can be run multiple times safely without duplicate rows or overwriting.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function seedAmritaDemo() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'campusconnect_db';

  console.log(`Connecting to MySQL database [${database}] on ${host}:${port}...`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  });

  try {
    const seedPath = path.resolve(__dirname, '../../../database/seed-amrita-demo.sql');
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed file not found at: ${seedPath}`);
    }

    console.log(`Applying demo seed from: ${seedPath}`);
    const sql = fs.readFileSync(seedPath, 'utf8');
    await connection.query(sql);

    // Verify seeded users
    const [users] = await connection.query(
      `SELECT id, name, email, role, department FROM users
       WHERE email LIKE '%amrita.edu%'
       ORDER BY role, name`
    );

    console.log('\n--- Successfully Seeded Amrita Demonstration Accounts ---');
    users.forEach(u => {
      console.log(`  • [${u.role.toUpperCase()}] ${u.name.padEnd(20)} | ${u.email}`);
    });

    const [tasks] = await connection.query(
      `SELECT t.id, t.title, t.task_type, t.credit_reward, u.name AS faculty_name
       FROM tasks t
       JOIN users u ON u.id = t.faculty_id
       WHERE u.email = 'faculty.demo@cb.amrita.edu'`
    );

    console.log(`\n--- Seeded ${tasks.length} Realistic Faculty Tasks ---`);
    tasks.forEach(t => {
      console.log(`  • #${t.id}: ${t.title} (${t.task_type}, +${t.credit_reward} credits)`);
    });

    console.log('\nDemo credentials for local testing:');
    console.log('Password for all demo accounts: Demo1234!\n');

    return users;
  } catch (err) {
    console.error('Failed to seed demo accounts:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  seedAmritaDemo()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedAmritaDemo };

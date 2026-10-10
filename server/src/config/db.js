const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campusconnect_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z'
});

// Test connection on launch (non-fatal warning so tests/scripts can handle or mock)
pool.getConnection()
  .then(conn => {
    console.log('[MySQL] Database pool connected successfully.');
    conn.release();
  })
  .catch(err => {
    console.warn('[MySQL Warning] Connection check failed:', err.message);
    console.warn('[MySQL Warning] Ensure MySQL is running and database schema/seed is loaded.');
  });

module.exports = pool;

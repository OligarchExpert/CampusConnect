/**
 * CampusConnect Database Initializer
 *
 * Reads database/schema.sql and database/seed.sql and executes them
 * sequentially using mysql2/promise.
 *
 * Usage: node src/scripts/init-db.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'campusconnect_db';

  console.log(`Connecting to MySQL at ${host}:${port} as ${user}...`);

  // Connect without database first to allow CREATE DATABASE
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });

  try {
    const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
    const seedPath = path.resolve(__dirname, '../../../database/seed.sql');

    if (fs.existsSync(schemaPath)) {
      console.log(`Executing schema from: ${schemaPath}`);
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(schemaSql);
      console.log('✓ Schema applied successfully.');
    } else {
      console.warn(`Schema file not found at: ${schemaPath}`);
    }

    if (fs.existsSync(seedPath)) {
      console.log(`Executing seed data from: ${seedPath}`);
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await connection.query(seedSql);
      console.log('✓ Seed data populated successfully.');
    } else {
      console.warn(`Seed file not found at: ${seedPath}`);
    }

    console.log(`Database [${database}] initialization complete! 🎉`);
  } catch (err) {
    console.error('Database initialization error:', err.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };

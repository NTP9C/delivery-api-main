require('dotenv').config();

const mysql = require('mysql2/promise');

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(
    `ขาดการตั้งค่าฐานข้อมูล: ${missing.join(', ')} กรุณาคัดลอก .env.example เป็น .env แล้วกรอกข้อมูล MySQL`
  );
}

const port = Number(process.env.DB_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT ต้องเป็นหมายเลขพอร์ตระหว่าง 1 ถึง 65535');
}

const sslEnabled = process.env.DB_SSL !== 'false';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4',
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});

async function verifyConnection() {
  await pool.query('SELECT 1');
}

function query(...args) {
  return pool.query(...args);
}

module.exports = { pool, query, verifyConnection };

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

async function createAdmin() {
  const hash = await bcrypt.hash('Admin2026!', 10);
  await pool.query(
    'INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING',
    ['Souad Meryem Jaber', 'info@mj-lernfoerderung.de', hash, 'admin']
  );
  console.log('✅ Admin erstellt: info@mj-lernfoerderung.de / Admin2026!');
  console.log('⚠️  Bitte Passwort nach erstem Login ändern!');
  process.exit(0);
}

createAdmin().catch(console.error);

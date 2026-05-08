require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profil_komplett BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS adresse TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plz VARCHAR(10);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS ort VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS iban VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS steuernummer VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS geburtsdatum DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS telefon VARCHAR(50);
  `);
  console.log('Spalten hinzugefuegt');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });

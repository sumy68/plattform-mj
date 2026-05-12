const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'lehrkraft', 'honorarkraft')),
        stundensatz DECIMAL(10,2) DEFAULT 0,
        aktiv BOOLEAN DEFAULT true,
        profil_komplett BOOLEAN DEFAULT false,
        vorname VARCHAR(255),
        nachname VARCHAR(255),
        geschlecht VARCHAR(50),
        adresse TEXT,
        plz VARCHAR(10),
        ort VARCHAR(255),
        iban VARCHAR(50),
        steuernummer VARCHAR(50),
        geburtsdatum DATE,
        telefon VARCHAR(50),
        sprachen TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS schueler (
        id SERIAL PRIMARY KEY,
        vorname VARCHAR(255) NOT NULL,
        nachname VARCHAR(255) NOT NULL,
        geburtsdatum DATE,
        schule VARCHAR(255),
        klasse VARCHAR(50),
        faecher TEXT[],
        sprachen TEXT[],
        eltern_name VARCHAR(255),
        eltern_tel VARCHAR(50),
        eltern_email VARCHAR(255),
        adresse TEXT,
        but_status BOOLEAN DEFAULT false,
        but_zeitraum_von DATE,
        but_zeitraum_bis DATE,
        diagnose TEXT[],
        notizen TEXT,
        aktiv BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lehrkraft_schueler (
        id SERIAL PRIMARY KEY,
        lehrkraft_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        schueler_id INTEGER REFERENCES schueler(id) ON DELETE CASCADE,
        UNIQUE(lehrkraft_id, schueler_id)
      );

      CREATE TABLE IF NOT EXISTS stunden (
        id SERIAL PRIMARY KEY,
        lehrkraft_id INTEGER REFERENCES users(id),
        schueler_id INTEGER REFERENCES schueler(id),
        datum DATE NOT NULL,
        startzeit TIME NOT NULL,
        endzeit TIME NOT NULL,
        dauer_minuten INTEGER,
        fach VARCHAR(255),
        ort VARCHAR(50) DEFAULT 'vor_ort' CHECK (ort IN ('vor_ort', 'online')),
        inhalt TEXT,
        kurzfristige_absage BOOLEAN DEFAULT false,
        unterschrift_data TEXT,
        unterschrift_name VARCHAR(255),
        unterschrift_datum TIMESTAMP,
        abgerechnet BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS abrechnungen (
        id SERIAL PRIMARY KEY,
        lehrkraft_id INTEGER REFERENCES users(id),
        monat VARCHAR(7) NOT NULL,
        stunden_ids INTEGER[],
        gesamtstunden DECIMAL(10,2),
        betrag DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'offen' CHECK (status IN ('offen', 'bezahlt')),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Migrations — fehlende Spalten nachrüsten
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS faecher TEXT[]`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS sprachen TEXT[]`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS diagnose TEXT[]`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS notizen TEXT`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS but_zeitraum_von DATE`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS but_zeitraum_bis DATE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profil_komplett BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS vorname VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nachname VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS geschlecht VARCHAR(50)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS adresse TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plz VARCHAR(10)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ort VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS iban VARCHAR(50)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS steuernummer VARCHAR(50)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS geburtsdatum DATE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telefon VARCHAR(50)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sprachen TEXT[]`);
    console.log('✅ Datenbank initialisiert');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };

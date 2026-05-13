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
        role VARCHAR(50) NOT NULL,
        stundensatz DECIMAL(10,2) DEFAULT 0,
        aktiv BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS schueler (
        id SERIAL PRIMARY KEY,
        vorname VARCHAR(255) NOT NULL,
        nachname VARCHAR(255) NOT NULL,
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
        ort VARCHAR(50) DEFAULT 'vor_ort',
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
        status VARCHAR(50) DEFAULT 'offen',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Migrations users
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

    // Migrations schueler
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS geburtsdatum DATE`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS schule VARCHAR(255)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS klasse VARCHAR(50)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS faecher TEXT[]`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS sprachen TEXT[]`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS eltern_name VARCHAR(255)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS eltern_tel VARCHAR(50)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS eltern_email VARCHAR(255)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS adresse TEXT`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS but_status BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS but_zeitraum_von DATE`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS but_zeitraum_bis DATE`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS diagnose TEXT[]`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS notizen TEXT`);

    // but_antraege Tabelle
    await client.query(`
      CREATE TABLE IF NOT EXISTS but_antraege (
        id SERIAL PRIMARY KEY,
        schueler_id INTEGER REFERENCES schueler(id) ON DELETE CASCADE,
        gueltig_von DATE NOT NULL,
        gueltig_bis DATE NOT NULL,
        gutscheine_gesamt INTEGER NOT NULL,
        gutscheine_verbraucht INTEGER DEFAULT 0,
        notizen TEXT,
        pdf_name VARCHAR(255),
        pdf_data TEXT,
        aktiv BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // notifications Tabelle
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        titel VARCHAR(255),
        nachricht TEXT,
        typ VARCHAR(50) DEFAULT 'info',
        gelesen BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // abwesenheiten Tabelle
    await client.query(`
      CREATE TABLE IF NOT EXISTS abwesenheiten (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        typ VARCHAR(50) NOT NULL,
        datum_von DATE NOT NULL,
        datum_bis DATE NOT NULL,
        notizen TEXT,
        au_pdf_name VARCHAR(255),
        au_pdf_data TEXT,
        au_email_gesendet BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'genehmigt',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // dokumente Tabelle
    await client.query(`
      CREATE TABLE IF NOT EXISTS dokumente (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        typ VARCHAR(50),
        name VARCHAR(255),
        data TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // rechnungen Tabelle
    await client.query(`
      CREATE TABLE IF NOT EXISTS rechnungen (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rechnungsnummer VARCHAR(50),
        stunden_ids INTEGER[],
        betrag DECIMAL(10,2),
        pdf_data TEXT,
        erstellt_am TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS aktiv BOOLEAN DEFAULT true`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS abgerechnet BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS kurzfristige_absage BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS lernfortschritt TEXT`);
    // but_antraege neu aufbauen mit korrekten Spalten
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='but_antraege' AND column_name='gutschein_stunden'
        ) THEN
          DROP TABLE but_antraege CASCADE;
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS but_antraege (
        id SERIAL PRIMARY KEY,
        schueler_id INTEGER REFERENCES schueler(id) ON DELETE CASCADE,
        gutscheine_gesamt INTEGER NOT NULL,
        gutscheine_verbraucht INTEGER DEFAULT 0,
        gueltig_von DATE NOT NULL,
        gueltig_bis DATE NOT NULL,
        antrag_pdf_name VARCHAR(255),
        antrag_pdf_data TEXT,
        notizen TEXT,
        aktiv BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // abwesenheiten neu aufbauen
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='abwesenheiten' AND column_name='notiz'
        ) THEN
          DROP TABLE abwesenheiten CASCADE;
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS abwesenheiten (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        typ VARCHAR(50) NOT NULL,
        datum_von DATE NOT NULL,
        datum_bis DATE NOT NULL,
        notizen TEXT,
        au_pdf_name VARCHAR(255),
        au_pdf_data TEXT,
        au_email_gesendet BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'genehmigt',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // dokumente neu aufbauen
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='dokumente' AND column_name='datei_data'
        ) THEN
          DROP TABLE dokumente CASCADE;
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS dokumente (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        typ VARCHAR(50),
        name VARCHAR(255),
        data TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Datenbank initialisiert');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };

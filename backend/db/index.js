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
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS manuell_deaktiviert BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE abwesenheiten ADD COLUMN IF NOT EXISTS admin_notiz TEXT`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS deutschniveau VARCHAR(100)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS lieblingsfach VARCHAR(100)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS schwachstes_fach VARCHAR(100)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS konzentration VARCHAR(100)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS eigenmotivation VARCHAR(100)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS selbststaendigkeit VARCHAR(100)`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS tipps_tricks TEXT`);
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS klassenstufe_jahr INT`);
    await client.query(`UPDATE schueler SET klassenstufe_jahr = 2025 WHERE klassenstufe_jahr IS NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fuehrerschein BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS qualifikation TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS faecher TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS absage_stundensatz DECIMAL(10,2) DEFAULT 0`);
    await client.query(`CREATE TABLE IF NOT EXISTS signatur_tokens (
      id SERIAL PRIMARY KEY,
      stunde_id INTEGER REFERENCES stunden(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255),
      verwendet BOOLEAN DEFAULT false,
      erstellt_am TIMESTAMP DEFAULT NOW(),
      ablaeuft_am TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
    )`);
    await client.query(`ALTER TABLE signatur_tokens ADD COLUMN IF NOT EXISTS schueler_slot INTEGER DEFAULT 1`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS fahrt_von TEXT`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS fahrt_nach TEXT`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS fahrt_km DECIMAL(10,2)`);
    await client.query(`CREATE TABLE IF NOT EXISTS auszahlungswuensche (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      betrag DECIMAL(10,2) NOT NULL,
      monat VARCHAR(7) NOT NULL,
      notizen TEXT,
      status VARCHAR(50) DEFAULT 'offen',
      created_at TIMESTAMP DEFAULT NOW()
    )`);

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
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS stundentyp VARCHAR(50) DEFAULT 'lehrstunde'`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS zusatz_typ VARCHAR(100)`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS zusatz_beschreibung TEXT`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS klasse VARCHAR(20)`);
    // Verwaltungs-/Sonstige-Stunden (Organisation, Fortbildung, Ausflug) mit Admin-Genehmigung
    await client.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS ist_verwaltung BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS genehmigung_status VARCHAR(20)`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS genehmigung_grund TEXT`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS genehmigt_am TIMESTAMP`);
    await client.query(`ALTER TABLE stunden ADD COLUMN IF NOT EXISTS genehmigt_von INTEGER`);
    // Pseudo-Schüler "Verwaltung" (idempotent anlegen)
    await client.query(`INSERT INTO schueler (vorname, nachname, ist_verwaltung, aktiv, but_status)
      SELECT 'Verwaltung', '', true, true, false
      WHERE NOT EXISTS (SELECT 1 FROM schueler WHERE ist_verwaltung=true)`);
    await client.query(`ALTER TABLE but_antraege ADD COLUMN IF NOT EXISTS behoerde TEXT`);
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
    await client.query(`ALTER TABLE but_antraege ADD COLUMN IF NOT EXISTS behoerde TEXT`);
    console.log('✅ Datenbank initialisiert');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };

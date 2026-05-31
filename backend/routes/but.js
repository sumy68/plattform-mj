const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// DB Tabelle anlegen (wird beim ersten Aufruf erstellt)
const initBUT = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS but_antraege (
      id SERIAL PRIMARY KEY,
      schueler_id INTEGER REFERENCES schueler(id) ON DELETE CASCADE,
      gutscheine_gesamt NUMERIC(10,2) NOT NULL,
      gutscheine_verbraucht NUMERIC(10,2) DEFAULT 0,
      gueltig_von DATE NOT NULL,
      gueltig_bis DATE NOT NULL,
      antrag_pdf_name VARCHAR(255),
      antrag_pdf_data TEXT,
      notizen TEXT,
      behoerde TEXT,
      aktiv BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Migration: bestehende INTEGER-Spalten auf NUMERIC umstellen
  await pool.query(`ALTER TABLE but_antraege ALTER COLUMN gutscheine_gesamt TYPE NUMERIC(10,2)`).catch(()=>{});
  await pool.query(`ALTER TABLE but_antraege ALTER COLUMN gutscheine_verbraucht TYPE NUMERIC(10,2)`).catch(()=>{});
};
initBUT().catch(console.error);

// Alle BuT Anträge (Admin: alle, Lehrkraft: nur ihre Schüler)
router.get('/', auth, async (req, res) => {
  try {
    let query;
    let params = [];
    if (req.user.role === 'admin') {
      query = `
        SELECT b.id, b.schueler_id, b.gutscheine_gesamt, b.gutscheine_verbraucht, b.gueltig_von, b.gueltig_bis, b.notizen, b.behoerde, b.aktiv, b.created_at, b.antrag_pdf_name, s.vorname||' '||s.nachname as schueler_name, s.schule, s.klasse
        FROM but_antraege b
        JOIN schueler s ON b.schueler_id=s.id
        ORDER BY b.aktiv DESC, b.gueltig_bis DESC
      `;
    } else {
      query = `
        SELECT b.id, b.schueler_id, b.gutscheine_gesamt, b.gutscheine_verbraucht, b.gueltig_von, b.gueltig_bis, b.notizen, b.behoerde, b.aktiv, b.created_at, b.antrag_pdf_name, s.vorname||' '||s.nachname as schueler_name, s.schule, s.klasse
        FROM but_antraege b
        JOIN schueler s ON b.schueler_id=s.id
        JOIN lehrkraft_schueler ls ON s.id=ls.schueler_id
        WHERE ls.lehrkraft_id=$1
        ORDER BY b.aktiv DESC, b.gueltig_bis DESC
      `;
      params = [req.user.id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BuT Antrag für einen Schüler
router.get('/schueler/:schueler_id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, schueler_id, gutscheine_gesamt, gutscheine_verbraucht, gueltig_von, gueltig_bis, notizen, behoerde, aktiv, created_at, antrag_pdf_name FROM but_antraege WHERE schueler_id=$1 ORDER BY aktiv DESC, gueltig_bis DESC`,
      [req.params.schueler_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Neuen BuT Antrag anlegen (nur Admin)
router.post('/', auth, adminOnly, async (req, res) => {
  const { schueler_id, gutscheine_gesamt, gueltig_von, gueltig_bis, notizen, behoerde, antrag_pdf_name, antrag_pdf_data } = req.body;
  try {
    // Bereits eingetragene Stunden im Zeitraum exakt aus dauer_minuten berechnen (Dezimal)
    const bereitsRes = await pool.query(
      `SELECT COALESCE(SUM(dauer_minuten),0)::numeric / 60 AS verbraucht FROM stunden WHERE schueler_id=$1 AND datum BETWEEN $2 AND $3`,
      [schueler_id, gueltig_von, gueltig_bis]
    );
    const bereits_verbraucht = parseFloat(bereitsRes.rows[0].verbraucht) || 0;
    const result = await pool.query(
      `INSERT INTO but_antraege (schueler_id, gutscheine_gesamt, gutscheine_verbraucht, gueltig_von, gueltig_bis, notizen, behoerde, antrag_pdf_name, antrag_pdf_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [schueler_id, gutscheine_gesamt, bereits_verbraucht, gueltig_von, gueltig_bis, notizen, behoerde || null, antrag_pdf_name || null, antrag_pdf_data || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BuT Antrag bearbeiten (nur Admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { gutscheine_gesamt, gutscheine_verbraucht, gueltig_von, gueltig_bis, notizen, behoerde, aktiv, antrag_pdf_name, antrag_pdf_data } = req.body;
  try {
    // Wenn gutscheine_verbraucht nicht angegeben, rückwirkend aus Stunden berechnen (Dezimal)
    let verbraucht = gutscheine_verbraucht;
    if (verbraucht === undefined || verbraucht === null) {
      const res2 = await pool.query(
        `SELECT COALESCE(SUM(dauer_minuten),0)::numeric / 60 AS verbraucht FROM stunden WHERE schueler_id=(SELECT schueler_id FROM but_antraege WHERE id=$1) AND datum BETWEEN $2 AND $3`,
        [req.params.id, gueltig_von, gueltig_bis]
      );
      verbraucht = parseFloat(res2.rows[0].verbraucht) || 0;
    }
    const result = await pool.query(
      `UPDATE but_antraege SET gutscheine_gesamt=$1, gutscheine_verbraucht=$2, gueltig_von=$3, gueltig_bis=$4, notizen=$5, behoerde=$6, aktiv=$7, antrag_pdf_name=COALESCE($9, antrag_pdf_name), antrag_pdf_data=COALESCE($10, antrag_pdf_data)
       WHERE id=$8 RETURNING *`,
      [gutscheine_gesamt, verbraucht, gueltig_von, gueltig_bis, notizen, behoerde || null, aktiv, req.params.id, antrag_pdf_name || null, antrag_pdf_data || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF hochladen/aktualisieren
router.patch('/:id/pdf', auth, adminOnly, async (req, res) => {
  const { antrag_pdf_name, antrag_pdf_data } = req.body;
  try {
    await pool.query(
      `UPDATE but_antraege SET antrag_pdf_name=$1, antrag_pdf_data=$2 WHERE id=$3`,
      [antrag_pdf_name, antrag_pdf_data, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF herunterladen
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT antrag_pdf_name, antrag_pdf_data FROM but_antraege WHERE id=$1', [req.params.id]);
    const antrag = result.rows[0];
    if (!antrag?.antrag_pdf_data) return res.status(404).json({ error: 'Kein PDF vorhanden' });
    const base64 = antrag.antrag_pdf_data.split(',')[1] || antrag.antrag_pdf_data;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${antrag.antrag_pdf_name}"`);
    res.send(Buffer.from(base64, 'base64'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gutschein verbrauchen (wird von stunden.js aufgerufen) - jetzt mit Dezimalstunden
router.post('/verbrauchen/:schueler_id', auth, async (req, res) => {
  try {
    const stunden = parseFloat(req.body?.stunden) || 1;
    const result = await pool.query(
      `SELECT * FROM but_antraege 
       WHERE schueler_id=$1 AND aktiv=true AND CURRENT_DATE BETWEEN gueltig_von AND gueltig_bis
       AND gutscheine_verbraucht < gutscheine_gesamt
       ORDER BY gueltig_bis ASC LIMIT 1`,
      [req.params.schueler_id]
    );
    if (!result.rows[0]) return res.json({ success: false, message: 'Kein aktiver BuT-Antrag' });
    
    const antrag = result.rows[0];
    const neu = parseFloat(antrag.gutscheine_verbraucht) + stunden;
    await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, antrag.id]);
    
    const verbleibend = parseFloat(antrag.gutscheine_gesamt) - neu;
    res.json({ 
      success: true, 
      verbleibend,
      warnung: verbleibend <= 12
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gutschein zurückbuchen (wenn Stunde gelöscht) - jetzt mit Dezimalstunden
router.post('/zurueckbuchen/:schueler_id', auth, async (req, res) => {
  try {
    const stunden = parseFloat(req.body?.stunden) || 1;
    const result = await pool.query(
      `SELECT * FROM but_antraege 
       WHERE schueler_id=$1 AND aktiv=true
       AND gutscheine_verbraucht > 0
       ORDER BY gueltig_bis DESC LIMIT 1`,
      [req.params.schueler_id]
    );
    if (!result.rows[0]) return res.json({ success: false });
    const antrag = result.rows[0];
    const neu = Math.max(0, parseFloat(antrag.gutscheine_verbraucht) - stunden);
    await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, antrag.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REPAIR: alle Anträge aus echten Stunden neu berechnen (Dezimal)
router.post('/repair', auth, adminOnly, async (req, res) => {
  try {
    const antraege = await pool.query('SELECT id, schueler_id, gueltig_von, gueltig_bis FROM but_antraege');
    const updated = [];
    for (const a of antraege.rows) {
      const r = await pool.query(
        `SELECT COALESCE(SUM(dauer_minuten),0)::numeric / 60 AS verbraucht
         FROM stunden
         WHERE datum BETWEEN $1 AND $2 AND schueler_id=$3`,
        [a.gueltig_von, a.gueltig_bis, a.schueler_id]
      );
      const neu = parseFloat(r.rows[0].verbraucht) || 0;
      await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, a.id]);
      updated.push({ id: a.id, schueler_id: a.schueler_id, verbraucht: neu });
    }
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM but_antraege WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================
// MEHRERE DOKUMENTE PRO ANTRAG (neu)
// ============================================

// Tabelle für mehrere Dokumente pro Antrag
const initButDokumente = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS but_dokumente (
      id SERIAL PRIMARY KEY,
      antrag_id INTEGER NOT NULL REFERENCES but_antraege(id) ON DELETE CASCADE,
      datei_name VARCHAR(255) NOT NULL,
      datei_data TEXT NOT NULL,
      hochgeladen_am TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_but_dok_antrag ON but_dokumente(antrag_id);
  `);
};
initButDokumente().catch(console.error);

// Alle Dokumente eines Antrags auflisten (ohne data = schnell)
router.get('/:id/dokumente', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, antrag_id, datei_name, hochgeladen_am
       FROM but_dokumente WHERE antrag_id=$1 ORDER BY hochgeladen_am DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Neues Dokument hinzufügen (INSERT, ueberschreibt nichts)
router.post('/:id/dokumente', auth, adminOnly, async (req, res) => {
  const { datei_name, datei_data } = req.body;
  if (!datei_name || !datei_data) {
    return res.status(400).json({ error: 'datei_name und datei_data erforderlich' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO but_dokumente (antrag_id, datei_name, datei_data)
       VALUES ($1,$2,$3) RETURNING id, antrag_id, datei_name, hochgeladen_am`,
      [req.params.id, datei_name, datei_data]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Einzelnes Dokument herunterladen
router.get('/dokumente/:dokId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT datei_name, datei_data FROM but_dokumente WHERE id=$1',
      [req.params.dokId]
    );
    const dok = result.rows[0];
    if (!dok?.datei_data) return res.status(404).json({ error: 'Kein Dokument vorhanden' });
    const base64 = dok.datei_data.split(',')[1] || dok.datei_data;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${dok.datei_name}"`);
    res.send(Buffer.from(base64, 'base64'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Einzelnes Dokument loeschen (nicht den ganzen Antrag!)
router.delete('/dokumente/:dokId', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM but_dokumente WHERE id=$1', [req.params.dokId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// EINMALIGE MIGRATION: alte Einzel-PDFs in but_dokumente kopieren
router.post('/migrate-pdfs', auth, adminOnly, async (req, res) => {
  try {
    const alte = await pool.query(
      `SELECT id, antrag_pdf_name, antrag_pdf_data FROM but_antraege
       WHERE antrag_pdf_data IS NOT NULL AND antrag_pdf_data <> ''`
    );
    let kopiert = 0, uebersprungen = 0;
    for (const a of alte.rows) {
      const exists = await pool.query(
        `SELECT 1 FROM but_dokumente WHERE antrag_id=$1 AND datei_name=$2 LIMIT 1`,
        [a.id, a.antrag_pdf_name || 'BuT-Bescheid.pdf']
      );
      if (exists.rows.length) { uebersprungen++; continue; }
      await pool.query(
        `INSERT INTO but_dokumente (antrag_id, datei_name, datei_data) VALUES ($1,$2,$3)`,
        [a.id, a.antrag_pdf_name || 'BuT-Bescheid.pdf', a.antrag_pdf_data]
      );
      kopiert++;
    }
    res.json({ success: true, kopiert, uebersprungen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

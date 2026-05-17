const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// DB Tabelle anlegen (wird beim ersten Aufruf erstellt)
const initBUT = async () => {
  await pool.query(`
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
      behoerde TEXT,
      aktiv BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
};
initBUT().catch(console.error);

// Alle BuT Anträge (Admin: alle, Lehrkraft: nur ihre Schüler)
router.get('/', auth, async (req, res) => {
  try {
    let query;
    let params = [];
    if (req.user.role === 'admin') {
      query = `
        SELECT b.*, s.vorname||' '||s.nachname as schueler_name, s.schule, s.klasse
        FROM but_antraege b
        JOIN schueler s ON b.schueler_id=s.id
        ORDER BY b.aktiv DESC, b.gueltig_bis DESC
      `;
    } else {
      query = `
        SELECT b.*, s.vorname||' '||s.nachname as schueler_name, s.schule, s.klasse
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
      `SELECT * FROM but_antraege WHERE schueler_id=$1 ORDER BY aktiv DESC, gueltig_bis DESC`,
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
    // Bereits eingetragene Stunden im Zeitraum rückwirkend zählen
    const bereitsRes = await pool.query(
      `SELECT COUNT(*) FROM stunden WHERE schueler_id=$1 AND datum BETWEEN $2 AND $3`,
      [schueler_id, gueltig_von, gueltig_bis]
    );
    const bereits_verbraucht = parseInt(bereitsRes.rows[0].count) || 0;
    const result = await pool.query(
      `INSERT INTO but_antraege (schueler_id, gutscheine_gesamt, gutscheine_verbraucht, gueltig_von, gueltig_bis, notizen, behoerde, antrag_pdf_name, antrag_pdf_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [schueler_id, gutscheine_gesamt, bereits_verbraucht, gueltig_von, gueltig_bis, notizen, behoerde || null, antrag_pdf_name || null, antrag_pdf_data || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BuT Antrag bearbeiten (nur Admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { gutscheine_gesamt, gutscheine_verbraucht, gueltig_von, gueltig_bis, notizen, behoerde, aktiv } = req.body;
  try {
    // Wenn gutscheine_verbraucht nicht angegeben, rückwirkend aus Stunden berechnen
    let verbraucht = gutscheine_verbraucht;
    if (verbraucht === undefined || verbraucht === null) {
      const res2 = await pool.query(
        `SELECT COUNT(*) FROM stunden WHERE schueler_id=(SELECT schueler_id FROM but_antraege WHERE id=$1) AND datum BETWEEN $2 AND $3`,
        [req.params.id, gueltig_von, gueltig_bis]
      );
      verbraucht = parseInt(res2.rows[0].count) || 0;
    }
    const result = await pool.query(
      `UPDATE but_antraege SET gutscheine_gesamt=$1, gutscheine_verbraucht=$2, gueltig_von=$3, gueltig_bis=$4, notizen=$5, behoerde=$6, aktiv=$7
       WHERE id=$7 RETURNING *`,
      [gutscheine_gesamt, verbraucht, gueltig_von, gueltig_bis, notizen, behoerde || null, aktiv, req.params.id]
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

// Gutschein verbrauchen (wird von stunden.js aufgerufen)
router.post('/verbrauchen/:schueler_id', auth, async (req, res) => {
  try {
    // Aktiven Antrag finden
    const result = await pool.query(
      `SELECT * FROM but_antraege 
       WHERE schueler_id=$1 AND aktiv=true AND CURRENT_DATE BETWEEN gueltig_von AND gueltig_bis
       AND gutscheine_verbraucht < gutscheine_gesamt
       ORDER BY gueltig_bis ASC LIMIT 1`,
      [req.params.schueler_id]
    );
    if (!result.rows[0]) return res.json({ success: false, message: 'Kein aktiver BuT-Antrag' });
    
    const antrag = result.rows[0];
    const neu = antrag.gutscheine_verbraucht + 1;
    await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, antrag.id]);
    
    const verbleibend = antrag.gutscheine_gesamt - neu;
    res.json({ 
      success: true, 
      verbleibend,
      warnung: verbleibend <= 12
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gutschein zurückbuchen (wenn Stunde gelöscht)
router.post('/zurueckbuchen/:schueler_id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM but_antraege 
       WHERE schueler_id=$1 AND aktiv=true
       AND gutscheine_verbraucht > 0
       ORDER BY gueltig_bis DESC LIMIT 1`,
      [req.params.schueler_id]
    );
    if (!result.rows[0]) return res.json({ success: false });
    const antrag = result.rows[0];
    await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', 
      [antrag.gutscheine_verbraucht - 1, antrag.id]);
    res.json({ success: true });
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

module.exports = router;

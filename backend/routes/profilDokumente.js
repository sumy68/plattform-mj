const router = require('express').Router();
const { Pool } = require('pg');
const { auth } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Tabelle einmalig anlegen (wird beim Start aufgerufen)
const createTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profil_dokumente (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dateiname TEXT NOT NULL,
      dateityp TEXT NOT NULL,
      daten TEXT NOT NULL,
      dateigroesse INTEGER,
      erstellt_am TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};
createTable().catch(console.error);

// GET /api/profil/dokumente — eigene Dokumente laden
router.get('/', auth, async (req, res) => {
  try {
    const id = req.query.user_id && req.user.role === 'admin' ? req.query.user_id : req.user.id;
    const result = await pool.query(
      'SELECT id, dateiname, dateityp, dateigroesse, erstellt_am FROM profil_dokumente WHERE user_id = $1 ORDER BY erstellt_am DESC',
      [id]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// GET /api/profil/dokumente/:id — einzelnes Dokument (Admin: alle, Lehrkraft: nur eigene)
router.get('/:id', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? 'SELECT * FROM profil_dokumente WHERE id = $1'
      : 'SELECT * FROM profil_dokumente WHERE id = $1 AND user_id = $2';
    const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    const dok = result.rows[0];
    // Als Datei senden
    const base64 = (dok.daten || '').split(',')[1] || dok.daten || '';
    const buffer = Buffer.from(base64, 'base64');
    const ext = (dok.dateiname || '').split('.').pop().toLowerCase();
    const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${dok.dateiname || 'dokument'}"`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: 'Fehler' });
  }
});

// POST /api/profil/dokumente — Dokument hochladen
router.post('/', auth, async (req, res) => {
  try {
    const { dateiname, dateityp, daten } = req.body;
    if (!dateiname || !dateityp || !daten) return res.status(400).json({ error: 'Fehlende Felder' });

    const erlaubteTypen = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!erlaubteTypen.includes(dateityp)) return res.status(400).json({ error: 'Dateityp nicht erlaubt' });

    // Max 5MB prüfen
    const bytes = Buffer.byteLength(daten, 'base64');
    if (bytes > 5 * 1024 * 1024) return res.status(400).json({ error: 'Datei zu groß (max 5 MB)' });

    const result = await pool.query(
      'INSERT INTO profil_dokumente (user_id, dateiname, dateityp, daten, dateigroesse) VALUES ($1, $2, $3, $4, $5) RETURNING id, dateiname, dateityp, dateigroesse, erstellt_am',
      [req.user.id, dateiname, dateityp, daten, bytes]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload fehlgeschlagen' });
  }
});

// DELETE /api/profil/dokumente/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM profil_dokumente WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Löschen fehlgeschlagen' });
  }
});

module.exports = router;

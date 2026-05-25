const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.de',
  port: 587,
  secure: false,
  auth: {
    user: 'meryem.jaber@mj-lernfoerderung.de',
    pass: 'BENQFunk68!'
  }
});

// Dokumente abrufen
router.get('/', auth, async (req, res) => {
  try {
    const id = req.query.user_id && req.user.role === 'admin' ? req.query.user_id : req.user.id;
    const result = await pool.query(
      'SELECT id, user_id, typ, name as datei_name, created_at as erstellt_am FROM dokumente WHERE user_id=$1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dokument hochladen
router.post('/', auth, async (req, res) => {
  const { typ, datei_name, datei_data } = req.body;
  try {
    // Altes Dokument gleichen Typs löschen
    await pool.query('DELETE FROM dokumente WHERE user_id=$1 AND typ=$2', [req.user.id, typ]);

    // Neues speichern
    const result = await pool.query(
      'INSERT INTO dokumente (user_id, typ, name, data) VALUES ($1,$2,$3,$4) RETURNING id, typ, name as datei_name, created_at as erstellt_am',
      [req.user.id, typ, datei_name, datei_data]
    );

    // User-Info holen
    const user = await pool.query('SELECT name, email FROM users WHERE id=$1', [req.user.id]);
    const userName = user.rows[0]?.name || 'Unbekannt';

    // E-Mail an Admin
    const typLabel = { lebenslauf: 'Lebenslauf', fuehrungszeugnis: 'Führungszeugnis', vertrag: 'Vertrag' }[typ] || typ;
    const base64Data = datei_data.split(',')[1] || datei_data;

    try {
      await transporter.sendMail({
        from: '"MJ Lernförderung" <meryem.jaber@mj-lernfoerderung.de>',
        to: 'info@mj-lernfoerderung.de',
        subject: `Neues Dokument: ${typLabel} von ${userName}`,
        html: `
          <p>Hallo,</p>
          <p><strong>${userName}</strong> hat ein neues Dokument hochgeladen:</p>
          <p><strong>Typ:</strong> ${typLabel}<br/>
          <strong>Dateiname:</strong> ${datei_name}<br/>
          <strong>Datum:</strong> ${new Date().toLocaleString('de-DE')}</p>
          <p>Das Dokument ist im Anhang.</p>
        `,
        attachments: [{
          filename: datei_name,
          content: base64Data,
          encoding: 'base64'
        }]
      });
    } catch (mailErr) {
      console.error('E-Mail Fehler:', mailErr.message);
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dokument herunterladen
router.get('/:id/download', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dokumente WHERE id=$1', [req.params.id]);
    const dok = result.rows[0];
    if (!dok) return res.status(404).json({ error: 'Nicht gefunden' });
    const base64Data = (dok.data || '').split(',')[1] || dok.data || '';
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = (dok.name || '').split('.').pop().toLowerCase();
    const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${dok.name || 'dokument'}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dokument löschen
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM dokumente WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

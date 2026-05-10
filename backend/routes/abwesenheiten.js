const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const nodemailer = require('nodemailer');

// Tabelle anlegen
const init = async () => {
  await pool.query(`
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
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
};
init().catch(console.error);

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.de',
  port: 587,
  secure: false,
  auth: { user: 'meryem.jaber@mj-lernfoerderung.de', pass: 'BENQFunk68!' }
});

// Alle Abwesenheiten abrufen
router.get('/', auth, async (req, res) => {
  try {
    let query, params = [];
    if (req.user.role === 'admin') {
      query = `SELECT a.*, u.name as user_name, u.role as user_role 
               FROM abwesenheiten a JOIN users u ON a.user_id=u.id 
               ORDER BY a.datum_von DESC`;
    } else {
      query = `SELECT a.*, u.name as user_name, u.role as user_role 
               FROM abwesenheiten a JOIN users u ON a.user_id=u.id 
               WHERE a.user_id=$1 ORDER BY a.datum_von DESC`;
      params = [req.user.id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Abwesenheit eintragen
router.post('/', auth, async (req, res) => {
  const { typ, datum_von, datum_bis, notizen, au_pdf_name, au_pdf_data } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO abwesenheiten (user_id, typ, datum_von, datum_bis, notizen, au_pdf_name, au_pdf_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, typ, datum_von, datum_bis, notizen, au_pdf_name || null, au_pdf_data || null]
    );

    // Bei Krank: E-Mail mit AU-Bescheinigung an Admin
    if (typ === 'krank' && au_pdf_data) {
      const userRes = await pool.query('SELECT name, role FROM users WHERE id=$1', [req.user.id]);
      const user = userRes.rows[0];
      const base64 = au_pdf_data.split(',')[1] || au_pdf_data;
      
      try {
        await transporter.sendMail({
          from: 'meryem.jaber@mj-lernfoerderung.de',
          to: 'info@mj-lernfoerderung.de',
          subject: `AU-Bescheinigung: ${user.name} (${new Date(datum_von).toLocaleDateString('de-DE')} – ${new Date(datum_bis).toLocaleDateString('de-DE')})`,
          html: `
            <p>Guten Tag,</p>
            <p><strong>${user.name}</strong> (${user.role}) hat eine Krankmeldung eingereicht:</p>
            <ul>
              <li>Zeitraum: ${new Date(datum_von).toLocaleDateString('de-DE')} – ${new Date(datum_bis).toLocaleDateString('de-DE')}</li>
              ${notizen ? `<li>Notizen: ${notizen}</li>` : ''}
            </ul>
            <p>Die AU-Bescheinigung ist im Anhang.</p>
            <p>Mit freundlichen Grüßen<br>MJ Lernförderung Plattform</p>
          `,
          attachments: [{
            filename: au_pdf_name,
            content: Buffer.from(base64, 'base64'),
            contentType: 'application/pdf'
          }]
        });
        await pool.query('UPDATE abwesenheiten SET au_email_gesendet=true WHERE id=$1', [result.rows[0].id]);
      } catch (mailErr) {
        console.error('E-Mail Fehler:', mailErr.message);
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Abwesenheit löschen
router.delete('/:id', auth, async (req, res) => {
  try {
    const check = await pool.query('SELECT user_id FROM abwesenheiten WHERE id=$1', [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'Keine Berechtigung' });
    await pool.query('DELETE FROM abwesenheiten WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AU PDF herunterladen
router.get('/:id/au-pdf', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT au_pdf_name, au_pdf_data FROM abwesenheiten WHERE id=$1', [req.params.id]);
    const a = result.rows[0];
    if (!a?.au_pdf_data) return res.status(404).json({ error: 'Kein PDF' });
    const base64 = a.au_pdf_data.split(',')[1] || a.au_pdf_data;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${a.au_pdf_name}"`);
    res.send(Buffer.from(base64, 'base64'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

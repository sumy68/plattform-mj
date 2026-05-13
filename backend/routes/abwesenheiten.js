const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const nodemailer = require('nodemailer');

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
      status VARCHAR(20) DEFAULT 'genehmigt',
      admin_notiz TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Status-Spalte hinzufügen falls noch nicht vorhanden
  await pool.query(`ALTER TABLE abwesenheiten ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'genehmigt'`);
  await pool.query(`ALTER TABLE abwesenheiten ADD COLUMN IF NOT EXISTS admin_notiz TEXT`);
  // Urlaub bekommt status 'ausstehend'
};
init().catch(console.error);

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.de', port: 587, secure: false,
  auth: { user: 'meryem.jaber@mj-lernfoerderung.de', pass: 'BENQFunk68!' }
});

// Alle Abwesenheiten
router.get('/', auth, async (req, res) => {
  try {
    // Alle sehen alle Abwesenheiten (für Kalender) - AU-PDF nur eigene
    let query = `SELECT a.id, a.user_id, a.typ, a.datum_von, a.datum_bis, a.notizen,
               a.au_email_gesendet, a.status, a.created_at, a.admin_notiz, a.au_pdf_name,
               ${req.user.role === 'admin' ? 'a.au_pdf_data,' : ''}
               u.name as user_name, u.email as user_email, u.role as user_role
               FROM abwesenheiten a JOIN users u ON a.user_id=u.id 
               ORDER BY a.created_at DESC`;
    let params = [];
    if (false) {
      query = `SELECT a.*, u.name as user_name, u.email as user_email, u.role as user_role 
               FROM abwesenheiten a JOIN users u ON a.user_id=u.id 
               WHERE a.user_id=$1 ORDER BY a.created_at DESC`;
      params = [req.user.id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ausstehende Urlaubsanträge (für Admin Freischaltung)
router.get('/pending-urlaub', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as user_name, u.email as user_email, u.role as user_role 
       FROM abwesenheiten a JOIN users u ON a.user_id=u.id 
       WHERE a.typ='urlaub' AND a.status='ausstehend'
       ORDER BY a.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Neue Abwesenheit
router.post('/', auth, async (req, res) => {
  const { typ, datum_von, datum_bis, notizen, au_pdf_name, au_pdf_data } = req.body;
  try {
    // Urlaub startet als ausstehend, Krank/Sonstiges direkt genehmigt
    const status = typ === 'urlaub' ? 'ausstehend' : 'genehmigt';
    
    const result = await pool.query(
      `INSERT INTO abwesenheiten (user_id, typ, datum_von, datum_bis, notizen, au_pdf_name, au_pdf_data, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, typ, datum_von, datum_bis, notizen, au_pdf_name || null, au_pdf_data || null, status]
    );

    // Bei Krank: E-Mail an Admin (auch ohne AU)
    if (typ === 'krank') {
      const userRes = await pool.query('SELECT name, role FROM users WHERE id=$1', [req.user.id]);
      const user = userRes.rows[0];
      const base64 = au_pdf_data.split(',')[1] || au_pdf_data;
      try {
        await transporter.sendMail({
          from: 'meryem.jaber@mj-lernfoerderung.de',
          to: 'info@mj-lernfoerderung.de',
          subject: `AU-Bescheinigung: ${user.name} (${new Date(datum_von).toLocaleDateString('de-DE')} – ${new Date(datum_bis).toLocaleDateString('de-DE')})`,
          html: `<p>Guten Tag,</p><p><strong>${user.name}</strong> (${user.role}) hat eine Krankmeldung eingereicht:</p><ul><li>Zeitraum: ${new Date(datum_von).toLocaleDateString('de-DE')} – ${new Date(datum_bis).toLocaleDateString('de-DE')}</li>${notizen ? `<li>Notizen: ${notizen}</li>` : ''}</ul><p>Die AU-Bescheinigung ist im Anhang.</p>`,
          attachments: [{ filename: au_pdf_name, content: Buffer.from(base64, 'base64'), contentType: 'application/pdf' }]
        });
        await pool.query('UPDATE abwesenheiten SET au_email_gesendet=true WHERE id=$1', [result.rows[0].id]);
      } catch (mailErr) { console.error('E-Mail Fehler:', mailErr.message); }
    }

    // Bei Urlaub: Admin benachrichtigen
    if (typ === 'urlaub') {
      const userRes = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
      try {
        await transporter.sendMail({
          from: 'meryem.jaber@mj-lernfoerderung.de',
          to: 'info@mj-lernfoerderung.de',
          subject: `Urlaubsantrag: ${userRes.rows[0].name}`,
          html: `<p>Guten Tag,</p><p><strong>${userRes.rows[0].name}</strong> hat einen Urlaubsantrag gestellt:</p><ul><li>Zeitraum: ${new Date(datum_von).toLocaleDateString('de-DE')} – ${new Date(datum_bis).toLocaleDateString('de-DE')}</li>${notizen ? `<li>Notizen: ${notizen}</li>` : ''}</ul><p>Bitte genehmigen oder ablehnen Sie den Antrag in der Plattform.</p>`
        });
      } catch (mailErr) { console.error('E-Mail Fehler:', mailErr.message); }
    }

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Urlaub genehmigen/ablehnen (Admin)
router.patch('/:id/status', auth, adminOnly, async (req, res) => {
  const { status, admin_notiz } = req.body;
  try {
    const result = await pool.query(
      `UPDATE abwesenheiten SET status=$1, admin_notiz=$2 WHERE id=$3 RETURNING *`,
      [status, admin_notiz || null, req.params.id]
    );
    const antrag = result.rows[0];
    
    // E-Mail an Lehrkraft
    const userRes = await pool.query('SELECT name, email FROM users WHERE id=$1', [antrag.user_id]);
    const user = userRes.rows[0];
    const statusText = status === 'genehmigt' ? '✅ genehmigt' : '❌ abgelehnt';
    
    try {
      await transporter.sendMail({
        from: 'meryem.jaber@mj-lernfoerderung.de',
        to: user.email,
        subject: `Urlaubsantrag ${statusText}`,
        html: `
          <p>Hallo ${user.name},</p>
          <p>Dein Urlaubsantrag wurde <strong>${statusText}</strong>.</p>
          <ul>
            <li>Zeitraum: ${new Date(antrag.datum_von).toLocaleDateString('de-DE')} – ${new Date(antrag.datum_bis).toLocaleDateString('de-DE')}</li>
            ${admin_notiz ? `<li>Notiz der Verwaltung: ${admin_notiz}</li>` : ''}
          </ul>
          <p>Mit freundlichen Grüßen<br>MJ Lernförderung</p>
        `
      });
    } catch (mailErr) { console.error('E-Mail Fehler:', mailErr.message); }

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Löschen
router.delete('/:id', auth, async (req, res) => {
  try {
    const check = await pool.query('SELECT user_id FROM abwesenheiten WHERE id=$1', [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'Keine Berechtigung' });
    await pool.query('DELETE FROM abwesenheiten WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AU PDF Download
router.get('/:id/au-pdf', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT au_pdf_name, au_pdf_data FROM abwesenheiten WHERE id=$1', [req.params.id]);
    const a = result.rows[0];
    if (!a?.au_pdf_data) return res.status(404).json({ error: 'Kein PDF' });
    const base64 = a.au_pdf_data.split(',')[1] || a.au_pdf_data;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${a.au_pdf_name}"`);
    res.send(Buffer.from(base64, 'base64'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Stunden abrufen
router.get('/', auth, async (req, res) => {
  try {
    const { monat, schueler_id, lehrkraft_id } = req.query;
    let query = `
      SELECT st.*, 
        u.name as lehrkraft_name,
        s.vorname||' '||s.nachname as schueler_name,
        s.but_status, s.schule, s.klasse
      FROM stunden st
      JOIN users u ON st.lehrkraft_id=u.id
      JOIN schueler s ON st.schueler_id=s.id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      query += ` AND st.lehrkraft_id=$${params.length}`;
    }
    if (monat) {
      params.push(monat + '-01');
      params.push(monat + '-31');
      query += ` AND st.datum BETWEEN $${params.length-1} AND $${params.length}`;
    }
    if (schueler_id) { params.push(schueler_id); query += ` AND st.schueler_id=$${params.length}`; }
    if (lehrkraft_id && req.user.role === 'admin') { params.push(lehrkraft_id); query += ` AND st.lehrkraft_id=$${params.length}`; }
    query += ' ORDER BY st.datum DESC, st.startzeit DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stunde eintragen
router.post('/', auth, async (req, res) => {
  const { schueler_id, datum, startzeit, endzeit, fach, ort, lernfortschritt, fahrt_von, fahrt_nach, fahrt_km } = req.body;
  try {
    // Dauer berechnen
    const [sh, sm] = startzeit.split(':').map(Number);
    const [eh, em] = endzeit.split(':').map(Number);
    const dauer_minuten = (eh * 60 + em) - (sh * 60 + sm);

    const result = await pool.query(
      `INSERT INTO stunden (lehrkraft_id,schueler_id,datum,startzeit,endzeit,dauer_minuten,fach,ort,inhalt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, schueler_id, datum, startzeit, endzeit, dauer_minuten, fach, ort, lernfortschritt]
    );

    // BuT-Gutschein automatisch abziehen wenn Schüler BuT hat
    const schuelerRes = await pool.query('SELECT but_status FROM schueler WHERE id=$1', [schueler_id]);
    if (schuelerRes.rows[0]?.but_status) {
      const butRes = await pool.query(
        `SELECT * FROM but_antraege 
         WHERE schueler_id=$1 AND aktiv=true 
         AND NOW() BETWEEN gueltig_von AND gueltig_bis + INTERVAL '1 day'
         AND gutscheine_verbraucht < gutscheine_gesamt
         ORDER BY gueltig_bis ASC LIMIT 1`,
        [schueler_id]
      );
      if (butRes.rows[0]) {
        const antrag = butRes.rows[0];
        const neu = antrag.gutscheine_verbraucht + 1;
        await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, antrag.id]);
        
        // Warnung zurückgeben wenn nur noch 1 übrig
        const verbleibend = antrag.gutscheine_gesamt - neu;
        return res.json({ ...result.rows[0], but_warnung: verbleibend <= 1, but_verbleibend: verbleibend });
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unterschrift speichern
router.patch('/:id/unterschrift', auth, async (req, res) => {
  const { unterschrift_data, unterschrift_name } = req.body;
  try {
    const result = await pool.query(
      `UPDATE stunden SET unterschrift_data=$1, unterschrift_name=$2, unterschrift_datum=NOW()
       WHERE id=$3 RETURNING *`,
      [unterschrift_data, unterschrift_name, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stunden als abgerechnet markieren
router.patch('/abrechnen', auth, async (req, res) => {
  const { stunden_ids } = req.body;
  try {
    await pool.query(
      'UPDATE stunden SET abgerechnet=true WHERE id=ANY($1) AND lehrkraft_id=$2',
      [stunden_ids, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Export einer Stunde
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.*, u.name as lehrkraft_name, u.telefon as lehrkraft_tel, u.email as lehrkraft_email,
       s.vorname, s.nachname, s.schule, s.klasse, s.but_status, s.eltern_name, s.eltern_tel,
       s.vorname||' '||s.nachname as schueler_name
       FROM stunden st JOIN users u ON st.lehrkraft_id=u.id JOIN schueler s ON st.schueler_id=s.id
       WHERE st.id=$1`, [req.params.id]
    );
    const st = result.rows[0];
    if (!st) return res.status(404).json({ error: 'Nicht gefunden' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=stundennachweis-${st.id}.pdf`);
    doc.pipe(res);

    // Header ohne Logo
    doc.fontSize(20).fillColor('#9b7fd4').font('Helvetica-Bold');
    doc.text('MJ Lernförderung', 50, 40);
    doc.fontSize(10).fillColor('#888').font('Helvetica');
    doc.text('Georgstraße 38 · 30159 Hannover', 50, 65);
    doc.text('info@mj-lernfoerderung.de · www.mj-lernfoerderung.de', 50, 78);

    // Linie
    doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#9b7fd4').stroke();

    // Titel
    doc.fontSize(16).fillColor('#2d2040').font('Helvetica-Bold');
    doc.text('STUNDENNACHWEIS', 50, 130, { align: 'center' });

    // Info Box
    doc.roundedRect(50, 160, 495, 140, 8).fillColor('#f0ebfa').fill();
    
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold');
    doc.text('SCHÜLER', 70, 175);
    doc.fontSize(13).fillColor('#2d2040').font('Helvetica-Bold');
    doc.text(`${st.vorname} ${st.nachname}`, 70, 190);
    doc.fontSize(10).fillColor('#666').font('Helvetica');
    doc.text(`Schule: ${st.schule || '–'}  ·  Klasse: ${st.klasse || '–'}`, 70, 208);
    doc.text(`Eltern: ${st.eltern_name || '–'}  ·  Tel: ${st.eltern_tel || '–'}`, 70, 222);
    doc.text(`BuT-Förderung: ${st.but_status ? 'Ja ✓' : 'Nein'}`, 70, 236);

    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold');
    doc.text('LEHRKRAFT', 320, 175);
    doc.fontSize(13).fillColor('#2d2040').font('Helvetica-Bold');
    doc.text(st.lehrkraft_name, 320, 190);
    doc.fontSize(10).fillColor('#666').font('Helvetica');
    doc.text(`E-Mail: ${st.lehrkraft_email || '–'}`, 320, 208);
    doc.text(`Tel: ${st.lehrkraft_tel || '–'}`, 320, 222);

    // Stunden Details
    doc.roundedRect(50, 315, 495, 100, 8).fillColor('#ffffff').stroke('#e8e0f5');
    
    const details = [
      ['Datum', new Date(st.datum).toLocaleDateString('de-DE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })],
      ['Uhrzeit', `${st.startzeit} – ${st.endzeit} Uhr (${st.dauer_minuten || '–'} Min.)`],
      ['Fach', st.fach || '–'],
      ['Ort', st.ort === 'online' ? 'Online' : 'Vor Ort'],
      ...(st.ort !== 'online' && st.fahrt_km ? [
        ['Fahrtweg', `${st.fahrt_km} km (Hinfahrt)`],
        ['Fahrtkosten', `${(st.fahrt_km * 0.38).toFixed(2)} € (0,38 €/km)`],
      ] : []),
    ];

    let y = 325;
    details.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#9b7fd4').font('Helvetica-Bold').text(label + ':', 70, y);
      doc.fontSize(10).fillColor('#2d2040').font('Helvetica').text(value, 180, y);
      y += 18;
    });

    // Lernfortschritt
    doc.roundedRect(50, 430, 495, 80, 8).fillColor('#f0ebfa').fill();
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold').text('LERNFORTSCHRITT', 70, 442);
    doc.fontSize(10).fillColor('#2d2040').font('Helvetica').text(st.inhalt || '–', 70, 458, { width: 455 });

    // Unterschrift
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold').text('UNTERSCHRIFT ELTERNTEIL', 50, 530);
    if (st.unterschrift_data) {
      const imgData = st.unterschrift_data.replace(/^data:image\/png;base64,/, '');
      doc.image(Buffer.from(imgData, 'base64'), 50, 548, { width: 200, height: 70 });
      doc.fontSize(10).fillColor('#666').font('Helvetica');
      doc.text(`Name: ${st.unterschrift_name}`, 50, 625);
      doc.text(`Datum: ${new Date(st.unterschrift_datum).toLocaleString('de-DE')}`, 50, 638);
    } else {
      doc.rect(50, 548, 240, 70).strokeColor('#e8e0f5').stroke();
      doc.fontSize(10).fillColor('#bbb').text('Unterschrift ausstehend', 70, 578);
    }

    // Footer
    doc.moveTo(50, 700).lineTo(545, 700).strokeColor('#9b7fd4').stroke();
    doc.fontSize(8).fillColor('#888').font('Helvetica');
    doc.text('MJ Lernförderung · Souad Meryem Jaber · Georgstraße 38 · 30159 Hannover · info@mj-lernfoerderung.de', 50, 710, { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Stunde löschen
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM stunden WHERE id=$1 AND (lehrkraft_id=$2 OR $3=true)', 
      [req.params.id, req.user.id, req.user.role === 'admin']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Signatur-Link per Email senden
router.post('/:id/signatur-link', auth, async (req, res) => {
  const { email } = req.body;
  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    // Stunde laden
    const stundeRes = await pool.query(
      `SELECT st.*, s.vorname, s.nachname, u.name as lehrkraft_name
       FROM stunden st
       JOIN schueler s ON st.schueler_id = s.id
       JOIN users u ON st.lehrkraft_id = u.id
       WHERE st.id = $1`,
      [req.params.id]
    );
    const st = stundeRes.rows[0];
    if (!st) return res.status(404).json({ error: 'Stunde nicht gefunden' });

    // Token speichern
    await pool.query(
      `INSERT INTO signatur_tokens (stunde_id, token, email) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [req.params.id, token, email]
    );

    // Email senden
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.ionos.de', port: 587, secure: false,
      auth: { user: 'meryem.jaber@mj-lernfoerderung.de', pass: 'BENQFunk68!' }
    });

    const link = `https://plattform-mj-1.onrender.com/unterschreiben/${token}`;
    const datum = new Date(st.datum).toLocaleDateString('de-DE');

    await transporter.sendMail({
      from: 'MJ Lernförderung <meryem.jaber@mj-lernfoerderung.de>',
      to: email,
      subject: `Unterschrift benötigt – Nachhilfe ${datum}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto">
          <h2 style="color:#9b7fd4">MJ Lernförderung</h2>
          <p>Sehr geehrte Eltern,</p>
          <p>für die Nachhilfestunde am <strong>${datum}</strong> mit Lehrkraft <strong>${st.lehrkraft_name}</strong> wird Ihre digitale Unterschrift benötigt.</p>
          <p><strong>Schüler:</strong> ${st.vorname} ${st.nachname}<br/>
          <strong>Zeit:</strong> ${st.startzeit} – ${st.endzeit} Uhr<br/>
          <strong>Fach:</strong> ${st.fach || '–'}</p>
          <a href="${link}" style="display:inline-block;background:#9b7fd4;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
            ✍️ Jetzt unterschreiben
          </a>
          <p style="color:#888;font-size:12px">Dieser Link ist 7 Tage gültig.</p>
        </div>
      `
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Signatur-Seite laden (öffentlich)
router.get('/signatur/:token', async (req, res) => {
  try {
    const tokenRes = await pool.query(
      `SELECT st.*, s.vorname, s.nachname, u.name as lehrkraft_name, tok.verwendet, tok.email
       FROM signatur_tokens tok
       JOIN stunden st ON tok.stunde_id = st.id
       JOIN schueler s ON st.schueler_id = s.id
       JOIN users u ON st.lehrkraft_id = u.id
       WHERE tok.token = $1 AND tok.ablaeuft_am > NOW()`,
      [req.params.token]
    );
    if (!tokenRes.rows[0]) return res.status(404).json({ error: 'Link ungültig oder abgelaufen' });
    res.json(tokenRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unterschrift via Token speichern (öffentlich)
router.post('/signatur/:token', async (req, res) => {
  const { unterschrift_data, unterschrift_name } = req.body;
  try {
    const tokenRes = await pool.query(
      `SELECT * FROM signatur_tokens WHERE token=$1 AND verwendet=false AND ablaeuft_am > NOW()`,
      [req.params.token]
    );
    if (!tokenRes.rows[0]) return res.status(400).json({ error: 'Link ungültig oder bereits verwendet' });
    
    const stunde_id = tokenRes.rows[0].stunde_id;
    await pool.query(
      `UPDATE stunden SET unterschrift_data=$1, unterschrift_name=$2, unterschrift_datum=NOW() WHERE id=$3`,
      [unterschrift_data, unterschrift_name, stunde_id]
    );
    await pool.query(`UPDATE signatur_tokens SET verwendet=true WHERE token=$1`, [req.params.token]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

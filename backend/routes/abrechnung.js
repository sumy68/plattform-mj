const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const MINIJOB_GRENZE = 603;

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.de', port: 587, secure: false,
  auth: { user: 'meryem.jaber@mj-lernfoerderung.de', pass: 'BENQFunk68!' }
});

// Guthaben einer Honorarkraft (alle offenen Stunden)
router.get('/guthaben/:user_id', auth, async (req, res) => {
  try {
    const userId = req.params.user_id;
    const userRes = await pool.query('SELECT name, stundensatz, email, vorname, nachname, adresse, plz, ort, iban, steuernummer FROM users WHERE id=$1', [userId]);
    const user = userRes.rows[0];
    
    // Alle offenen (nicht abgerechneten) Stunden
    const stundenRes = await pool.query(
      `SELECT st.*, s.vorname||' '||s.nachname as schueler_name
       FROM stunden st JOIN schueler s ON st.schueler_id=s.id
       WHERE st.lehrkraft_id=$1 AND st.abgerechnet=false
       ORDER BY st.datum DESC`,
      [userId]
    );
    
    const stunden = stundenRes.rows;
    const stundensatz = parseFloat(user.stundensatz) || 0;
    const gesamtBetrag = stunden.length * stundensatz;
    
    // Diesen Monat bereits abgerechnet
    const monat = new Date().toISOString().slice(0,7);
    const bereitsRes = await pool.query(
      `SELECT COALESCE(SUM(betrag), 0) as betrag FROM rechnungen WHERE user_id=$1 AND to_char(erstellt_am,'YYYY-MM')=$2`,
      [userId, monat]
    );
    const bereitsAbgerechnet = parseFloat(bereitsRes.rows[0]?.betrag) || 0;
    const nochMoeglich = Math.max(0, MINIJOB_GRENZE - bereitsAbgerechnet);
    
    res.json({
      user,
      stunden,
      stundensatz,
      gesamt_stunden: stunden.length,
      gesamt_betrag: gesamtBetrag,
      bereits_abgerechnet: bereitsAbgerechnet,
      noch_moeglich: nochMoeglich,
      minijob_grenze: MINIJOB_GRENZE,
      prozent_verbraucht: Math.round((bereitsAbgerechnet / MINIJOB_GRENZE) * 100)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rechnung erstellen und senden
router.post('/rechnung', auth, async (req, res) => {
  const { stunden_ids, betrag } = req.body;
  const userId = req.user.id;
  
  try {
    // Tabelle anlegen falls nicht vorhanden
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rechnungen (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        stunden_ids INTEGER[],
        betrag NUMERIC(10,2),
        rechnungsnummer VARCHAR(50),
        pdf_data TEXT,
        erstellt_am TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const userRes = await pool.query(
      'SELECT *, name as vollname FROM users WHERE id=$1', [userId]
    );
    const user = userRes.rows[0];
    
    if (!user.iban || !user.adresse) {
      return res.status(400).json({ error: 'Bitte zuerst Profil vervollständigen (IBAN und Adresse erforderlich)' });
    }
    
    // Stunden abrufen
    const stundenRes = await pool.query(
      `SELECT st.*, s.vorname||' '||s.nachname as schueler_name
       FROM stunden st JOIN schueler s ON st.schueler_id=s.id
       WHERE st.id=ANY($1)`, [stunden_ids]
    );
    const stunden = stundenRes.rows;
    
    // Rechnungsnummer generieren
    const rechnungsnr = `MJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const datum = new Date().toLocaleDateString('de-DE');
    const monat = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    
    // PDF erstellen
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
      
      // Logo
      const logoPath = path.join(__dirname, '../logo_mj.png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, 450, 30, { width: 80 });
      
      // Absender
      doc.fontSize(10).fillColor('#666').font('Helvetica');
      doc.text(`${user.vorname || ''} ${user.nachname || user.name}`, 50, 50);
      doc.text(user.adresse || '', 50, 63);
      doc.text(`${user.plz || ''} ${user.ort || ''}`, 50, 76);
      doc.text(user.email, 50, 89);
      
      // Empfänger
      doc.fontSize(10).fillColor('#333');
      doc.text('MJ Lernförderung', 50, 130);
      doc.text('Souad Meryem Jaber', 50, 143);
      doc.text('Georgstraße 38', 50, 156);
      doc.text('30159 Hannover', 50, 169);
      
      // Rechnungsdaten
      doc.fontSize(9).fillColor('#666');
      doc.text(`Rechnungsnummer: ${rechnungsnr}`, 350, 130);
      doc.text(`Datum: ${datum}`, 350, 143);
      doc.text(`Steuernummer: ${user.steuernummer || 'n.a.'}`, 350, 156);
      
      // Titel
      doc.fontSize(18).fillColor('#9b7fd4').font('Helvetica-Bold');
      doc.text('RECHNUNG', 50, 220);
      doc.fontSize(11).fillColor('#333').font('Helvetica');
      doc.text(`Honorar für Lernförderung — ${monat}`, 50, 245);
      
      // Linie
      doc.moveTo(50, 265).lineTo(545, 265).strokeColor('#9b7fd4').stroke();
      
      // Tabelle Header
      doc.fontSize(9).fillColor('#666').font('Helvetica-Bold');
      doc.text('Datum', 50, 280);
      doc.text('Schüler', 130, 280);
      doc.text('Zeit', 280, 280);
      doc.text('Fach', 380, 280);
      doc.text('Betrag', 490, 280);
      doc.moveTo(50, 292).lineTo(545, 292).strokeColor('#ddd').stroke();
      
      // Stunden
      let y = 300;
      doc.font('Helvetica').fillColor('#333');
      stunden.forEach(st => {
        doc.fontSize(9);
        doc.text(new Date(st.datum).toLocaleDateString('de-DE'), 50, y);
        doc.text(st.schueler_name, 130, y, { width: 140 });
        doc.text(`${st.startzeit}–${st.endzeit}`, 280, y);
        doc.text(st.fach || '–', 380, y);
        doc.text(`${parseFloat(user.stundensatz).toFixed(2)} €`, 490, y);
        y += 18;
      });
      
      // Summe
      doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor('#9b7fd4').stroke();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#9b7fd4');
      doc.text(`Gesamtbetrag: ${parseFloat(betrag).toFixed(2)} €`, 50, y + 15, { align: 'right' });
      
      // Hinweis Kleinunternehmer
      doc.fontSize(9).fillColor('#888').font('Helvetica');
      doc.text('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', 50, y + 45);
      
      // IBAN
      doc.fontSize(10).fillColor('#333').font('Helvetica-Bold');
      doc.text('Bankverbindung:', 50, y + 70);
      doc.font('Helvetica').text(`IBAN: ${user.iban}`, 50, y + 85);
      
      // Footer
      doc.moveTo(50, 750).lineTo(545, 750).strokeColor('#9b7fd4').stroke();
      doc.fontSize(8).fillColor('#888');
      doc.text('MJ Lernförderung · Souad Meryem Jaber · Georgstraße 38 · 30159 Hannover', 50, 760, { align: 'center' });
      
      doc.end();
    });
    
    const pdfBuffer = Buffer.concat(chunks);
    const pdfBase64 = pdfBuffer.toString('base64');
    
    // Rechnung in DB speichern
    await pool.query(
      `INSERT INTO rechnungen (user_id, stunden_ids, betrag, rechnungsnummer, pdf_data) VALUES ($1,$2,$3,$4,$5)`,
      [userId, stunden_ids, betrag, rechnungsnr, pdfBase64]
    );
    
    // Stunden als abgerechnet markieren
    await pool.query('UPDATE stunden SET abgerechnet=true WHERE id=ANY($1)', [stunden_ids]);
    
    // E-Mail senden
    const senderEmail = user.email;
    try {
      await transporter.sendMail({
        from: 'meryem.jaber@mj-lernfoerderung.de',
        to: 'info@mj-lernfoerderung.de',
        cc: user.email,
        replyTo: senderEmail,
        subject: `Rechnung Honorarkraft ${user.vorname || ''} ${user.nachname || user.name} ${monat}`,
        html: `
          <p>Guten Tag,</p>
          <p><strong>${user.vorname || ''} ${user.nachname || user.name}</strong> hat eine Rechnung gestellt.</p>
          <ul>
            <li>Rechnungsnummer: ${rechnungsnr}</li>
            <li>Zeitraum: ${monat}</li>
            <li>Betrag: ${parseFloat(betrag).toFixed(2)} €</li>
            <li>Anzahl Stunden: ${stunden.length}</li>
          </ul>
          <p>Die Rechnung ist im Anhang.</p>
        `,
        attachments: [{
          filename: `Rechnung_${rechnungsnr}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
    } catch (mailErr) {
      console.error('E-Mail Fehler:', mailErr.message);
    }
    
    res.json({ success: true, rechnungsnummer: rechnungsnr, pdf: pdfBase64 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Monats-Export CSV
router.get('/export/csv/:monat', auth, adminOnly, async (req, res) => {
  try {
    const { monat } = req.params;
    const result = await pool.query(
      `SELECT st.*, u.name as lehrkraft_name, u.role as lehrkraft_role, u.stundensatz,
       s.vorname||' '||s.nachname as schueler_name, s.but_status
       FROM stunden st JOIN users u ON st.lehrkraft_id=u.id JOIN schueler s ON st.schueler_id=s.id
       WHERE to_char(st.datum,'YYYY-MM')=$1 ORDER BY u.name, st.datum`, [monat]
    );
    const rows = result.rows;
    const header = 'Lehrkraft;Rolle;Datum;Startzeit;Endzeit;Schüler;Fach;Ort;BuT;Stundensatz;Abgerechnet;Unterschrift';
    const lines = rows.map(r => [
      r.lehrkraft_name, r.lehrkraft_role,
      new Date(r.datum).toLocaleDateString('de-DE'),
      r.startzeit, r.endzeit, r.schueler_name,
      r.fach || '', r.ort,
      r.but_status ? 'Ja' : 'Nein',
      r.stundensatz + ' €',
      r.abgerechnet ? 'Ja' : 'Nein',
      r.unterschrift_name || 'Ausstehend'
    ].join(';'));
    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=monatsübersicht-${monat}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Monats-Export PDF
router.get('/export/pdf/:monat', auth, adminOnly, async (req, res) => {
  try {
    const { monat } = req.params;
    const result = await pool.query(
      `SELECT st.*, u.name as lehrkraft_name, u.role as lehrkraft_role, u.stundensatz,
       s.vorname||' '||s.nachname as schueler_name
       FROM stunden st JOIN users u ON st.lehrkraft_id=u.id JOIN schueler s ON st.schueler_id=s.id
       WHERE to_char(st.datum,'YYYY-MM')=$1 ORDER BY u.name, st.datum`, [monat]
    );
    const rows = result.rows;
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=monatsübersicht-${monat}.pdf`);
    doc.pipe(res);
    doc.fontSize(18).fillColor('#9b7fd4').text('MJ Lernförderung', { align: 'center' });
    doc.fontSize(13).fillColor('#333').text(`Monatsübersicht ${monat}`, { align: 'center' });
    doc.moveDown();
    const byLehrkraft = {};
    rows.forEach(r => {
      if (!byLehrkraft[r.lehrkraft_name]) byLehrkraft[r.lehrkraft_name] = { role: r.lehrkraft_role, stundensatz: r.stundensatz, stunden: [] };
      byLehrkraft[r.lehrkraft_name].stunden.push(r);
    });
    Object.entries(byLehrkraft).forEach(([name, data]) => {
      doc.fontSize(12).fillColor('#9b7fd4').text(`${name} (${data.role}) — ${data.stundensatz} €/Std.`);
      data.stunden.forEach((st, i) => {
        doc.fontSize(9).fillColor('#555').text(`  ${i+1}. ${new Date(st.datum).toLocaleDateString('de-DE')} | ${st.startzeit}–${st.endzeit} | ${st.schueler_name} | ${st.fach || '-'} | ${st.abgerechnet ? 'Abgerechnet' : 'Offen'}`);
      });
      const betrag = data.stunden.length * parseFloat(data.stundensatz);
      doc.fontSize(10).fillColor('#333').text(`  Gesamt: ${data.stunden.length} Std. = ${betrag.toFixed(2)} €`);
      doc.moveDown(0.5);
    });
    const gesamt = rows.length;
    const gesamtBetrag = Object.values(byLehrkraft).reduce((sum, d) => sum + d.stunden.length * parseFloat(d.stundensatz), 0);
    doc.moveDown();
    doc.fontSize(13).fillColor('#9b7fd4').text(`Gesamt: ${gesamt} Stunden | Gesamtkosten: ${gesamtBetrag.toFixed(2)} €`, { align: 'right' });
    doc.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Abrechnen (Lehrkraft markiert Stunden)
router.post('/abrechnen', auth, async (req, res) => {
  const { stunden_ids } = req.body;
  try {
    await pool.query('UPDATE stunden SET abgerechnet=true WHERE id=ANY($1) AND lehrkraft_id=$2', [stunden_ids, req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// Eigene Rechnungen abrufen
router.get('/meine-rechnungen', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, rechnungsnummer, betrag, pdf_data, erstellt_am FROM rechnungen WHERE user_id=$1 ORDER BY erstellt_am DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

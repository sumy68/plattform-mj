const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// Guthabenkonto einer Lehrkraft
router.get('/guthaben/:lehrkraft_id', auth, async (req, res) => {
  try {
    const lid = req.user.role === 'admin' ? req.params.lehrkraft_id : req.user.id;
    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE abgerechnet=false) as offen,
        COUNT(*) FILTER (WHERE abgerechnet=true) as abgerechnet,
        COUNT(*) as gesamt,
        u.stundensatz
       FROM stunden st JOIN users u ON u.id=st.lehrkraft_id
       WHERE st.lehrkraft_id=$1 GROUP BY u.stundensatz`,
      [lid]
    );
    res.json(result.rows[0] || { offen: 0, abgerechnet: 0, gesamt: 0, stundensatz: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Monatsübersicht
router.get('/monatsübersicht', auth, async (req, res) => {
  const { monat } = req.query;
  try {
    const lid = req.user.role === 'admin' ? null : req.user.id;
    let query = `
      SELECT
        u.id as lehrkraft_id, u.name as lehrkraft_name, u.stundensatz,
        COUNT(*) as stunden_gesamt,
        COUNT(*) FILTER (WHERE st.abgerechnet=true) as stunden_abgerechnet,
        COUNT(*) FILTER (WHERE st.abgerechnet=false) as stunden_guthaben,
        COUNT(*) FILTER (WHERE st.abgerechnet=true) * u.stundensatz as auszahlungsbetrag
      FROM stunden st JOIN users u ON st.lehrkraft_id=u.id
      WHERE to_char(st.datum,'YYYY-MM')=$1
    `;
    const params = [monat];
    if (lid) { params.push(lid); query += ` AND st.lehrkraft_id=$2`; }
    query += ' GROUP BY u.id,u.name,u.stundensatz ORDER BY u.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Abrechnung per Klick
router.post('/abrechnen', auth, async (req, res) => {
  const { stunden_ids } = req.body;
  try {
    const lid = req.user.id;
    await pool.query(
      'UPDATE stunden SET abgerechnet=true WHERE id=ANY($1) AND lehrkraft_id=$2',
      [stunden_ids, lid]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Monatsnachweis
router.get('/pdf/:lehrkraft_id/:monat', auth, async (req, res) => {
  try {
    const { lehrkraft_id, monat } = req.params;
    const stunden = await pool.query(
      `SELECT st.*, s.vorname||' '||s.nachname as schueler_name, s.but_status
       FROM stunden st JOIN schueler s ON st.schueler_id=s.id
       WHERE st.lehrkraft_id=$1 AND to_char(st.datum,'YYYY-MM')=$2
       ORDER BY st.datum, st.startzeit`,
      [lehrkraft_id, monat]
    );
    const user = await pool.query('SELECT name,stundensatz FROM users WHERE id=$1', [lehrkraft_id]);
    const lk = user.rows[0];

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=monatsnachweis-${monat}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).fillColor('#9b7fd4').text('MJ Lernförderung', { align: 'center' });
    doc.fontSize(13).fillColor('#333').text(`Monatsnachweis ${monat} – ${lk.name}`, { align: 'center' });
    doc.moveDown();

    stunden.rows.forEach((st, i) => {
      doc.fontSize(10).fillColor('#333');
      doc.text(`${i+1}. ${new Date(st.datum).toLocaleDateString('de-DE')} | ${st.startzeit}–${st.endzeit} | ${st.schueler_name} | ${st.fach} | ${st.ort} | BuT: ${st.but_status?'Ja':'Nein'} | ${st.unterschrift_name ? '✓ Unterschrift' : '⚠ Ausstehend'}`);
    });

    doc.moveDown();
    const abgerechnet = stunden.rows.filter(s => s.abgerechnet).length;
    doc.fontSize(12).fillColor('#9b7fd4');
    doc.text(`Gesamt: ${stunden.rows.length} Stunden | Abgerechnet: ${abgerechnet} | Betrag: ${(abgerechnet * lk.stundensatz).toFixed(2)} €`);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Admin Monats-Export CSV
router.get('/export/csv/:monat', auth, adminOnly, async (req, res) => {
  try {
    const { monat } = req.params;
    const result = await pool.query(
      `SELECT st.*, 
        u.name as lehrkraft_name, u.role as lehrkraft_role, u.stundensatz,
        s.vorname||' '||s.nachname as schueler_name, s.but_status
       FROM stunden st 
       JOIN users u ON st.lehrkraft_id=u.id 
       JOIN schueler s ON st.schueler_id=s.id
       WHERE to_char(st.datum,'YYYY-MM')=$1
       ORDER BY u.name, st.datum`,
      [monat]
    );

    const rows = result.rows;
    const header = 'Lehrkraft;Rolle;Datum;Startzeit;Endzeit;Schüler;Fach;Ort;BuT;Stundensatz;Abgerechnet;Unterschrift';
    const lines = rows.map(r => [
      r.lehrkraft_name,
      r.lehrkraft_role,
      new Date(r.datum).toLocaleDateString('de-DE'),
      r.startzeit,
      r.endzeit,
      r.schueler_name,
      r.fach || '',
      r.ort,
      r.but_status ? 'Ja' : 'Nein',
      r.stundensatz + ' €',
      r.abgerechnet ? 'Ja' : 'Nein',
      r.unterschrift_name || 'Ausstehend'
    ].join(';'));

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=monatsübersicht-${monat}.csv`);
    res.send('\uFEFF' + csv); // BOM für Excel
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Monats-Export PDF
router.get('/export/pdf/:monat', auth, adminOnly, async (req, res) => {
  try {
    const { monat } = req.params;
    const result = await pool.query(
      `SELECT st.*, 
        u.name as lehrkraft_name, u.role as lehrkraft_role, u.stundensatz,
        s.vorname||' '||s.nachname as schueler_name
       FROM stunden st 
       JOIN users u ON st.lehrkraft_id=u.id 
       JOIN schueler s ON st.schueler_id=s.id
       WHERE to_char(st.datum,'YYYY-MM')=$1
       ORDER BY u.name, st.datum`,
      [monat]
    );

    const rows = result.rows;
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=monatsübersicht-${monat}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(18).fillColor('#9b7fd4').text('MJ Lernförderung', { align: 'center' });
    doc.fontSize(13).fillColor('#333').text(`Monatsübersicht ${monat}`, { align: 'center' });
    doc.moveDown();

    // Gruppieren nach Lehrkraft
    const byLehrkraft = {};
    rows.forEach(r => {
      if (!byLehrkraft[r.lehrkraft_name]) byLehrkraft[r.lehrkraft_name] = { role: r.lehrkraft_role, stundensatz: r.stundensatz, stunden: [] };
      byLehrkraft[r.lehrkraft_name].stunden.push(r);
    });

    Object.entries(byLehrkraft).forEach(([name, data]) => {
      doc.fontSize(12).fillColor('#9b7fd4').text(`${name} (${data.role}) — ${data.stundensatz} €/Std.`);
      data.stunden.forEach((st, i) => {
        doc.fontSize(9).fillColor('#555').text(
          `  ${i+1}. ${new Date(st.datum).toLocaleDateString('de-DE')} | ${st.startzeit}–${st.endzeit} | ${st.schueler_name} | ${st.fach || '-'} | ${st.abgerechnet ? 'Abgerechnet' : 'Offen'}`
        );
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
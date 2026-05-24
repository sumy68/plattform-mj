const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const PDFDocument = require('pdfkit');

function generateStundenPDF(st) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#9b7fd4').font('Helvetica-Bold');
    doc.text('MJ Lernförderung', 50, 40);
    doc.fontSize(10).fillColor('#888').font('Helvetica');
    doc.text('Georgstraße 38 · 30159 Hannover', 50, 65);
    doc.text('info@mj-lernfoerderung.de · www.mj-lernfoerderung.de', 50, 78);
    doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#9b7fd4').stroke();
    doc.fontSize(16).fillColor('#2d2040').font('Helvetica-Bold');
    doc.text('STUNDENNACHWEIS', 50, 130, { align: 'center' });
    doc.roundedRect(50, 160, 495, 140, 8).fillColor('#f0ebfa').fill();
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold');
    doc.text('SCHÜLER', 70, 175);
    doc.fontSize(13).fillColor('#2d2040').font('Helvetica-Bold');
    doc.text(`${st.s_vorname} ${st.s_nachname}`, 70, 190);
    doc.fontSize(10).fillColor('#666').font('Helvetica');
    doc.text(`Schule: ${st.schule || '–'}  ·  Klasse: ${st.klasse || '–'}`, 70, 208);
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold');
    doc.text('LEHRKRAFT', 320, 175);
    doc.fontSize(13).fillColor('#2d2040').font('Helvetica-Bold');
    doc.text(st.lehrkraft_name || '–', 320, 190);
    const details = [
      ['Datum', new Date(st.datum).toLocaleDateString('de-DE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })],
      ['Fach', st.fach || '–'],
    ];
    const detailBoxHeight = details.length * 18 + 20;
    doc.roundedRect(50, 315, 495, detailBoxHeight, 8).fillColor('#ffffff').stroke('#e8e0f5');
    let y = 325;
    details.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#9b7fd4').font('Helvetica-Bold').text(label + ':', 70, y);
      doc.fontSize(10).fillColor('#2d2040').font('Helvetica').text(value, 180, y);
      y += 18;
    });
    const unterschriftY = y + 30;
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold').text('UNTERSCHRIFT ELTERNTEIL', 50, unterschriftY);
    if (st.unterschrift_data) {
      const imgData = st.unterschrift_data.replace(/^data:image\/png;base64,/, '');
      doc.image(Buffer.from(imgData, 'base64'), 50, unterschriftY + 18, { width: 200, height: 70 });
      doc.fontSize(10).fillColor('#666').font('Helvetica');
      doc.text(`Name: ${st.unterschrift_name || ''}`, 50, unterschriftY + 95);
    }
    doc.moveTo(50, 700).lineTo(545, 700).strokeColor('#9b7fd4').stroke();
    doc.fontSize(8).fillColor('#888').font('Helvetica');
    doc.text('MJ Lernförderung · Souad Meryem Jaber · Georgstraße 38 · 30159 Hannover · info@mj-lernfoerderung.de', 50, 710, { align: 'center' });
    doc.end();
  });
}
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/zip', auth, adminOnly, async (req, res) => {
  try {
    const { monat } = req.query;
    const params = monat ? [monat] : [];
    const filter = monat ? "AND TO_CHAR(b.created_at, 'YYYY-MM') = $1" : '';
    const filterD = monat ? "AND TO_CHAR(d.created_at, 'YYYY-MM') = $1" : '';

    const butResult = await pool.query(
      `SELECT b.antrag_pdf_name, b.antrag_pdf_data, s.vorname, s.nachname,
              TO_CHAR(b.created_at, 'YYYY-MM') as monat
       FROM but_antraege b JOIN schueler s ON b.schueler_id = s.id
       WHERE b.antrag_pdf_data IS NOT NULL ${filter}`, params);

    const dokResult = await pool.query(
      `SELECT d.name, d.data, d.typ, u.name as lehrkraft_name,
              TO_CHAR(d.created_at, 'YYYY-MM') as monat
       FROM dokumente d JOIN users u ON d.user_id = u.id
       WHERE d.data IS NOT NULL ${filterD}`, params);

    const filename = monat ? `MJ_Export_${monat}.zip` : `MJ_Export_Gesamt.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const row of butResult.rows) {
      if (!row.antrag_pdf_data) continue;
      const base64 = row.antrag_pdf_data.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const safe = `${row.vorname}_${row.nachname}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      archive.append(buffer, { name: `BuT-Antraege/${row.monat}/${row.antrag_pdf_name || safe + '.pdf'}` });
    }

    for (const row of dokResult.rows) {
      if (!row.data) continue;
      const base64 = row.data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const safe = (row.lehrkraft_name || 'Unbekannt').replace(/[^a-zA-Z0-9_-]/g, '_');
      archive.append(buffer, { name: `Lehrkraft-Dokumente/${row.monat}/${safe}/${row.name || 'dokument.pdf'}` });
    }

    // Stundennachweise
    const filterS = monat ? "AND TO_CHAR(st.datum, 'YYYY-MM') = $1" : '';
    const stundenResult = await pool.query(
      `SELECT st.unterschrift_data, st.datum, st.fach,
              s.vorname as s_vorname, s.nachname as s_nachname,
              u.name as lehrkraft_name,
              TO_CHAR(st.datum, 'YYYY-MM') as monat
       FROM stunden st
       JOIN schueler s ON st.schueler_id = s.id
       JOIN users u ON st.lehrkraft_id = u.id
       WHERE st.unterschrift_data IS NOT NULL ${filterS}`, params);

    for (const row of stundenResult.rows) {
      if (!row.unterschrift_data) continue;
      const safe_lk = (row.lehrkraft_name || 'Unbekannt').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safe_s = `${row.s_vorname}_${row.s_nachname}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const datum = new Date(row.datum).toISOString().slice(0,10);
      const pdfBuffer = await generateStundenPDF(row);
      archive.append(pdfBuffer, { name: `Stundennachweise/${row.monat}/${safe_lk}/${datum}_${safe_s}.pdf` });
    }

    // Rechnungen
    const filterR = monat ? "AND TO_CHAR(r.erstellt_am, 'YYYY-MM') = $1" : '';
    const rechnungResult = await pool.query(
      `SELECT r.rechnungsnummer, r.pdf_data, r.erstellt_am,
              u.name as lehrkraft_name,
              TO_CHAR(r.erstellt_am, 'YYYY-MM') as monat
       FROM rechnungen r JOIN users u ON r.user_id = u.id
       WHERE r.pdf_data IS NOT NULL ${filterR}`, params);

    for (const row of rechnungResult.rows) {
      if (!row.pdf_data) continue;
      const base64 = row.pdf_data.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const safe_lk = (row.lehrkraft_name || 'Unbekannt').replace(/[^a-zA-Z0-9_-]/g, '_');
      archive.append(buffer, { name: `Rechnungen/${row.monat}/${safe_lk}/${row.rechnungsnummer}.pdf` });
    }

    await archive.finalize();
  } catch (err) {
    console.error('Export Fehler:', err);
    res.status(500).json({ error: 'Export fehlgeschlagen' });
  }
});

module.exports = router;

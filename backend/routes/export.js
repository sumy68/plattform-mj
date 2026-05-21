const express = require('express');
const router = express.Router();
const { ZipArchive } = require('archiver');
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

    const archive = new ZipArchive({ zlib: { level: 9 } });
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
      const safe = row.lehrkraft_name.replace(/[^a-zA-Z0-9_-]/g, '_');
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
      const base64 = row.unterschrift_data.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const safe_lk = row.lehrkraft_name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safe_s = `${row.s_vorname}_${row.s_nachname}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const datum = new Date(row.datum).toISOString().slice(0,10);
      archive.append(buffer, { name: `Stundennachweise/${row.monat}/${safe_lk}/${datum}_${safe_s}.pdf` });
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
      const safe_lk = row.lehrkraft_name.replace(/[^a-zA-Z0-9_-]/g, '_');
      archive.append(buffer, { name: `Rechnungen/${row.monat}/${safe_lk}/${row.rechnungsnummer}.pdf` });
    }

    await archive.finalize();
  } catch (err) {
    console.error('Export Fehler:', err);
    res.status(500).json({ error: 'Export fehlgeschlagen' });
  }
});

module.exports = router;

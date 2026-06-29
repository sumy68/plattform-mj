const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const { berechneKlasse } = require('../utils/klasse');

// Anker-Datensatz "Verwaltung" finden oder anlegen (selbstheilend)
async function getVerwaltungSchuelerId() {
  const r = await pool.query(`SELECT id FROM schueler WHERE ist_verwaltung=true ORDER BY id LIMIT 1`);
  if (r.rows[0]) {
    await pool.query(`UPDATE schueler SET aktiv=true WHERE id=$1 AND aktiv=false`, [r.rows[0].id]);
    return r.rows[0].id;
  }
  const ins = await pool.query(
    `INSERT INTO schueler (vorname, nachname, ist_verwaltung, aktiv, but_status) VALUES ('Verwaltung','',true,true,false) RETURNING id`
  );
  return ins.rows[0].id;
}

// Google Maps Proxy
router.get('/maps/directions', auth, async (req, res) => {
  try {
    const { origin, destination } = req.query;
    const key = process.env.GOOGLE_MAPS_KEY;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&key=${key}`;
    const r = await fetch(url);
    const d = await r.json();
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stunden abrufen
router.get('/', auth, async (req, res) => {
  try {
    const { monat, schueler_id, lehrkraft_id } = req.query;
    let query = `
      SELECT st.*, 
        u.name as lehrkraft_name,
        u.stundensatz as lehrkraft_stundensatz,
        u.absage_stundensatz as lehrkraft_absage_stundensatz,
        s.vorname||' '||s.nachname as schueler_name,
        s.but_status, s.schule, s.klasse,
        st.unterrichtsform, st.gruppe_schueler_namen, st.gruppe_schueler_ids,
        st.unterschrift_data_2, st.unterschrift_name_2, st.unterschrift_datum_2,
        st.unterschrift_data_3, st.unterschrift_name_3, st.unterschrift_datum_3
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
      params.push(monat);
      query += ` AND to_char(st.datum, 'YYYY-MM') = $${params.length}`;
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

// Offene Verwaltungs-Stunden (zur Genehmigung, nur Admin)
router.get('/verwaltung/offen', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.*, u.name as lehrkraft_name
       FROM stunden st JOIN users u ON st.lehrkraft_id=u.id
       WHERE st.stundentyp='verwaltung' AND st.genehmigung_status='offen'
       ORDER BY st.datum DESC, st.startzeit DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stunde eintragen
router.post('/', auth, async (req, res) => {
  const { schueler_id, datum, startzeit, endzeit, fach, ort, lernfortschritt, fahrt_von, fahrt_nach, fahrt_km, stundentyp, zusatz_typ, zusatz_beschreibung, kurzfristige_absage, unterrichtsform, gruppe_schueler_ids, gruppe_schueler_namen, ist_verwaltung_stunde } = req.body;
  try {
    const [sh, sm] = startzeit.split(':').map(Number);
    const [eh, em] = endzeit.split(':').map(Number);
    const dauer_minuten = (eh * 60 + em) - (sh * 60 + sm);

    // Verwaltungs-Stunde? (per Flag/Stundentyp oder anhand des gewählten Ankers)
    let klasseFrozen = null;
    let istVerwaltung = ist_verwaltung_stunde === true || stundentyp === 'verwaltung';
    let effektiveSchuelerId = schueler_id;
    if (!istVerwaltung && schueler_id) {
      try {
        const scRes = await pool.query('SELECT klasse, klassenstufe_jahr, ist_verwaltung FROM schueler WHERE id=$1', [schueler_id]);
        if (scRes.rows[0]) {
          istVerwaltung = !!scRes.rows[0].ist_verwaltung;
          klasseFrozen = berechneKlasse(scRes.rows[0].klasse, scRes.rows[0].klassenstufe_jahr, datum ? new Date(datum) : new Date());
        }
      } catch(e) { /* ignore */ }
    }
    // Anker-Datensatz sicherstellen (legt ihn bei Bedarf automatisch an)
    if (istVerwaltung) {
      effektiveSchuelerId = await getVerwaltungSchuelerId();
      klasseFrozen = null;
    }

    // Verwaltungs-Stunden: kein Gruppenunterricht, kein BuT, Status "offen" (Admin-Genehmigung nötig)
    const form = istVerwaltung ? 'einzel' : (unterrichtsform || 'einzel');
    const gruppeIds = (!istVerwaltung && form !== 'einzel' && gruppe_schueler_ids?.length) ? gruppe_schueler_ids : [];
    const gruppeNamen = (!istVerwaltung && form !== 'einzel' && gruppe_schueler_namen) ? gruppe_schueler_namen : '';
    const finalStundentyp = istVerwaltung ? 'verwaltung' : (stundentyp || 'lehrstunde');
    const genehmigungStatus = istVerwaltung ? 'offen' : null;

    const result = await pool.query(
      `INSERT INTO stunden (lehrkraft_id,schueler_id,datum,startzeit,endzeit,dauer_minuten,fach,ort,inhalt,fahrt_von,fahrt_nach,fahrt_km,stundentyp,zusatz_typ,zusatz_beschreibung,kurzfristige_absage,unterrichtsform,gruppe_schueler_ids,gruppe_schueler_namen,klasse,genehmigung_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [req.user.id, effektiveSchuelerId, datum, startzeit, endzeit, dauer_minuten, fach, ort, lernfortschritt, fahrt_von||null, fahrt_nach||null, fahrt_km||null, finalStundentyp, zusatz_typ||null, zusatz_beschreibung||null, kurzfristige_absage||false, form, gruppeIds, gruppeNamen, klasseFrozen, genehmigungStatus]
    );

    // Verwaltungs-Stunden brauchen keine BuT-Prüfung und keine Unterschrift
    if (istVerwaltung) return res.json(result.rows[0]);

    // BuT: alle Schüler der Gruppe prüfen
    const alleSchuelerIds = [parseInt(schueler_id), ...gruppeIds.map(id => parseInt(id))].filter(id => !isNaN(id) && id > 0);
    console.log('BuT Check für Schüler IDs:', alleSchuelerIds);
    const dauer_stunden = (dauer_minuten || 60) / 60;
    let but_warnung = false;
    let but_verbleibend = null;

    for (const sid of alleSchuelerIds) {
      const schuelerRes = await pool.query('SELECT but_status FROM schueler WHERE id=$1', [sid]);
      if (!schuelerRes.rows[0]?.but_status) continue;
      const butRes = await pool.query(
        `SELECT * FROM but_antraege 
         WHERE schueler_id=$1 AND aktiv=true 
         AND $2::date BETWEEN gueltig_von AND gueltig_bis
         AND gutscheine_verbraucht < gutscheine_gesamt
         ORDER BY gueltig_bis ASC LIMIT 1`,
        [sid, datum]
      );
      if (!butRes.rows[0]) continue;
      const antrag = butRes.rows[0];
      const neu = parseFloat(antrag.gutscheine_verbraucht) + dauer_stunden;
      await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, antrag.id]);
      const verbleibend = parseFloat(antrag.gutscheine_gesamt) - neu;
      if (verbleibend <= 12) { but_warnung = true; but_verbleibend = verbleibend; }
    }

    if (but_warnung) return res.json({ ...result.rows[0], but_warnung: true, but_verbleibend });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stunde bearbeiten
router.put('/:id', auth, async (req, res) => {
  try {
    const altRes = await pool.query('SELECT * FROM stunden WHERE id=$1', [req.params.id]);
    const alt = altRes.rows[0];
    if (!alt) return res.status(404).json({ error: 'Stunde nicht gefunden' });
    if (req.user.role !== 'admin' && alt.lehrkraft_id !== req.user.id)
      return res.status(403).json({ error: 'Keine Berechtigung' });
    if (alt.abgerechnet)
      return res.status(403).json({ error: 'Stunde ist bereits abgerechnet und kann nicht mehr bearbeitet werden.' });

    const { schueler_id, datum, startzeit, endzeit, fach, ort, lernfortschritt, fahrt_von, fahrt_nach, fahrt_km, stundentyp, zusatz_typ, zusatz_beschreibung, kurzfristige_absage, unterrichtsform, gruppe_schueler_ids, gruppe_schueler_namen } = req.body;
    const istVerwaltung = alt.stundentyp === 'verwaltung';
    const [sh, sm] = startzeit.split(':').map(Number);
    const [eh, em] = endzeit.split(':').map(Number);
    const dauer_minuten = (eh * 60 + em) - (sh * 60 + sm);
    const form = istVerwaltung ? 'einzel' : (unterrichtsform || 'einzel');
    const gruppeIds = (!istVerwaltung && form !== 'einzel' && gruppe_schueler_ids && gruppe_schueler_ids.length) ? gruppe_schueler_ids : [];
    const gruppeNamen = (!istVerwaltung && form !== 'einzel' && gruppe_schueler_namen) ? gruppe_schueler_namen : '';

    // ALTES BuT zurueckbuchen (nicht bei Verwaltungs-Stunden)
    const altGruppeIds = (alt.gruppe_schueler_ids || []).map(id => parseInt(id)).filter(id => !isNaN(id));
    const altAlleIds = [parseInt(alt.schueler_id), ...altGruppeIds].filter(id => !isNaN(id) && id > 0);
    const altDauerStd = (alt.dauer_minuten || 60) / 60;
    for (const sid of (istVerwaltung ? [] : altAlleIds)) {
      const sc = await pool.query('SELECT but_status FROM schueler WHERE id=$1', [sid]);
      if (!sc.rows[0] || !sc.rows[0].but_status) continue;
      const but = await pool.query(
        `SELECT * FROM but_antraege WHERE schueler_id=$1 AND $2::date BETWEEN gueltig_von AND gueltig_bis AND gutscheine_verbraucht > 0 ORDER BY aktiv DESC, gueltig_bis DESC LIMIT 1`,
        [sid, alt.datum]
      );
      if (but.rows[0]) {
        const neu = Math.max(0, parseFloat(but.rows[0].gutscheine_verbraucht) - altDauerStd);
        await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, but.rows[0].id]);
      }
    }

    // Stunde updaten
    const result = await pool.query(
      `UPDATE stunden SET schueler_id=$1, datum=$2, startzeit=$3, endzeit=$4, dauer_minuten=$5, fach=$6, ort=$7, inhalt=$8, fahrt_von=$9, fahrt_nach=$10, fahrt_km=$11, stundentyp=$12, zusatz_typ=$13, zusatz_beschreibung=$14, kurzfristige_absage=$15, unterrichtsform=$16, gruppe_schueler_ids=$17, gruppe_schueler_namen=$18 WHERE id=$19 RETURNING *`,
      [schueler_id, datum, startzeit, endzeit, dauer_minuten, fach, ort, lernfortschritt, fahrt_von||null, fahrt_nach||null, fahrt_km||null, istVerwaltung ? 'verwaltung' : (stundentyp||'lehrstunde'), zusatz_typ||null, zusatz_beschreibung||null, kurzfristige_absage||false, form, gruppeIds, gruppeNamen, req.params.id]
    );

    // Verwaltungs-Stunde durch Lehrkraft geändert -> erneute Genehmigung nötig
    if (istVerwaltung && req.user.role !== 'admin') {
      const reset = await pool.query(
        `UPDATE stunden SET genehmigung_status='offen', genehmigung_grund=NULL, genehmigt_am=NULL, genehmigt_von=NULL WHERE id=$1 RETURNING *`,
        [req.params.id]
      );
      return res.json(reset.rows[0]);
    }
    if (istVerwaltung) return res.json(result.rows[0]);

    // NEUES BuT abziehen
    const neuAlleIds = [parseInt(schueler_id), ...gruppeIds.map(id => parseInt(id))].filter(id => !isNaN(id) && id > 0);
    const neuDauerStd = (dauer_minuten || 60) / 60;
    let but_warnung = false, but_verbleibend = null;
    for (const sid of neuAlleIds) {
      const sc = await pool.query('SELECT but_status FROM schueler WHERE id=$1', [sid]);
      if (!sc.rows[0] || !sc.rows[0].but_status) continue;
      const but = await pool.query(
        `SELECT * FROM but_antraege WHERE schueler_id=$1 AND aktiv=true AND $2::date BETWEEN gueltig_von AND gueltig_bis AND gutscheine_verbraucht < gutscheine_gesamt ORDER BY gueltig_bis ASC LIMIT 1`,
        [sid, datum]
      );
      if (!but.rows[0]) continue;
      const a = but.rows[0];
      const neu = parseFloat(a.gutscheine_verbraucht) + neuDauerStd;
      await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, a.id]);
      const verbleibend = parseFloat(a.gutscheine_gesamt) - neu;
      if (verbleibend <= 12) { but_warnung = true; but_verbleibend = verbleibend; }
    }

    if (but_warnung) return res.json({ ...result.rows[0], but_warnung: true, but_verbleibend });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stunde löschen
router.delete('/:id', auth, async (req, res) => {
  try {
    // BuT-Gutschein zurueckbuchen (exakte Dezimalstunden, alle Gruppenschueler, Datum-basiert)
    const stundeRes = await pool.query('SELECT * FROM stunden WHERE id=$1', [req.params.id]);
    if (stundeRes.rows[0]) {
      const st = stundeRes.rows[0];
      const gruppeIds = (st.gruppe_schueler_ids || []).map(id => parseInt(id)).filter(id => !isNaN(id));
      const alleSchuelerIds = [parseInt(st.schueler_id), ...gruppeIds].filter(id => !isNaN(id) && id > 0);
      const dauer_stunden = (st.dauer_minuten || 60) / 60;
      for (const sid of alleSchuelerIds) {
        const schuelerRes = await pool.query('SELECT but_status FROM schueler WHERE id=$1', [sid]);
        if (!schuelerRes.rows[0]?.but_status) continue;
        const butRes = await pool.query(
          `SELECT * FROM but_antraege 
           WHERE schueler_id=$1 AND $2::date BETWEEN gueltig_von AND gueltig_bis AND gutscheine_verbraucht > 0
           ORDER BY aktiv DESC, gueltig_bis DESC LIMIT 1`,
          [sid, st.datum]
        );
        if (butRes.rows[0]) {
          const neu = Math.max(0, parseFloat(butRes.rows[0].gutscheine_verbraucht) - dauer_stunden);
          await pool.query('UPDATE but_antraege SET gutscheine_verbraucht=$1 WHERE id=$2', [neu, butRes.rows[0].id]);
        }
      }
    }
    await pool.query('DELETE FROM stunden WHERE id=$1 AND (lehrkraft_id=$2 OR $3=true)',
      [req.params.id, req.user.id, req.user.role === 'admin']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unterschrift speichern
router.patch('/:id/unterschrift', auth, async (req, res) => {
  const { unterschrift_data, unterschrift_name, nr } = req.body;
  try {
    let query, params;
    if (nr === 2) {
      query = `UPDATE stunden SET unterschrift_data_2=$1, unterschrift_name_2=$2, unterschrift_datum_2=NOW() WHERE id=$3 RETURNING *`;
    } else if (nr === 3) {
      query = `UPDATE stunden SET unterschrift_data_3=$1, unterschrift_name_3=$2, unterschrift_datum_3=NOW() WHERE id=$3 RETURNING *`;
    } else {
      query = `UPDATE stunden SET unterschrift_data=$1, unterschrift_name=$2, unterschrift_datum=NOW() WHERE id=$3 RETURNING *`;
    }
    const result = await pool.query(query, [unterschrift_data, unterschrift_name, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verwaltungs-Stunde genehmigen/ablehnen (nur Admin)
router.patch('/:id/genehmigung', auth, adminOnly, async (req, res) => {
  const { status, grund } = req.body;
  if (!['genehmigt', 'abgelehnt'].includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }
  try {
    const result = await pool.query(
      `UPDATE stunden SET genehmigung_status=$1, genehmigung_grund=$2, genehmigt_am=NOW(), genehmigt_von=$3
       WHERE id=$4 AND stundentyp='verwaltung' RETURNING *`,
      [status, grund || null, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Verwaltungs-Stunde nicht gefunden' });
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

// PDF Export einer Stunde (bei Gruppe: ZIP mit einem PDF pro Schüler)
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.*, u.name as lehrkraft_name, u.telefon as lehrkraft_tel, u.email as lehrkraft_email,
       s.vorname, s.nachname, s.schule, s.klasse, s.but_status, s.eltern_name, s.eltern_tel,
       s.vorname||' '||s.nachname as schueler_name,
       st.unterrichtsform, st.gruppe_schueler_ids, st.gruppe_schueler_namen,
       st.unterschrift_data_2, st.unterschrift_name_2, st.unterschrift_datum_2,
       st.unterschrift_data_3, st.unterschrift_name_3, st.unterschrift_datum_3
       FROM stunden st JOIN users u ON st.lehrkraft_id=u.id JOIN schueler s ON st.schueler_id=s.id
       WHERE st.id=$1`, [req.params.id]
    );
    const st = result.rows[0];
    if (!st) return res.status(404).json({ error: 'Nicht gefunden' });

    // Bei Gruppenunterricht: ZIP mit einem PDF pro Schüler
    if (st.unterrichtsform && st.unterrichtsform !== 'einzel' && st.gruppe_schueler_ids && st.gruppe_schueler_ids.length > 0) {
      const alleIds = [st.schueler_id, ...st.gruppe_schueler_ids];
      const unterschriftenData = [
        { data: st.unterschrift_data, name: st.unterschrift_name, datum: st.unterschrift_datum },
        { data: st.unterschrift_data_2, name: st.unterschrift_name_2, datum: st.unterschrift_datum_2 },
        { data: st.unterschrift_data_3, name: st.unterschrift_name_3, datum: st.unterschrift_datum_3 },
      ];
      const archiver = require('archiver');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=stunde-${st.id}-gruppe.zip`);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      for (let i = 0; i < alleIds.length; i++) {
        const schuelerRes = await pool.query(
          'SELECT vorname, nachname, schule, klasse, but_status, eltern_name, eltern_tel FROM schueler WHERE id=$1',
          [alleIds[i]]
        );
        const sc = schuelerRes.rows[0];
        if (!sc) continue;
        const stFuerSchueler = { ...st, vorname: sc.vorname, nachname: sc.nachname, schule: sc.schule, klasse: st.klasse || sc.klasse, but_status: sc.but_status, eltern_name: sc.eltern_name, eltern_tel: sc.eltern_tel, schueler_name: `${sc.vorname} ${sc.nachname}`, unterschrift_data: unterschriftenData[i]?.data, unterschrift_name: unterschriftenData[i]?.name, unterschrift_datum: unterschriftenData[i]?.datum, unterrichtsform: 'einzel' };
        const pdfBuf = await genPDF(stFuerSchueler);
        archive.append(pdfBuf, { name: `${sc.vorname}_${sc.nachname}_${new Date(st.datum).toISOString().slice(0,10)}.pdf` });
      }
      await archive.finalize();
      return;
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=stundennachweis-${st.id}.pdf`);
    doc.pipe(res);

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
    const details = [
      ['Datum', new Date(st.datum).toLocaleDateString('de-DE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })],
      ['Uhrzeit', `${st.startzeit} – ${st.endzeit} Uhr (${st.dauer_minuten || '–'} Min.)`],
      ['Fach', st.fach || '–'],
      ['Ort', st.ort === 'online' ? 'Online' : 'Vor Ort'],
      ...(st.ort !== 'online' && st.fahrt_km ? [
        ['Fahrtweg', `${st.fahrt_km} km (Hinfahrt)`],
        ['Fahrtkosten', `${(parseFloat(st.fahrt_km) * 0.38).toFixed(2)} € (0,38 €/km)`],
      ] : []),
    ];
    const detailBoxHeight = details.length * 18 + 20;
    doc.roundedRect(50, 315, 495, detailBoxHeight, 8).fillColor('#ffffff').stroke('#e8e0f5');
    let y = 325;
    details.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#9b7fd4').font('Helvetica-Bold').text(label + ':', 70, y);
      doc.fontSize(10).fillColor('#2d2040').font('Helvetica').text(value, 180, y);
      y += 18;
    });
    const lernY = y + 15;
    const lernText = st.inhalt || '–';
    doc.fontSize(10).font('Helvetica');
    const lernTextHeight = doc.heightOfString(lernText, { width: 455 });
    const lernBoxHeight = Math.max(80, lernTextHeight + 40);
    doc.roundedRect(50, lernY, 495, lernBoxHeight, 8).fillColor('#f0ebfa').fill();
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold').text('LERNFORTSCHRITT', 70, lernY + 12);
    doc.fontSize(10).fillColor('#2d2040').font('Helvetica').text(lernText, 70, lernY + 28, { width: 455 });
    let unterschriftY = lernY + lernBoxHeight + 20;
    if (unterschriftY + 110 > 690) { doc.addPage(); unterschriftY = 60; }
    // Unterschriften je nach Unterrichtsform
    const unterschriften = [
      { data: st.unterschrift_data, name: st.unterschrift_name, datum: st.unterschrift_datum, label: st.unterrichtsform && st.unterrichtsform !== 'einzel' ? `Schüler 1: ${st.vorname} ${st.nachname}` : 'Elternteil' },
      ...(st.unterrichtsform === '2er' || st.unterrichtsform === '3er' ? [{ data: st.unterschrift_data_2, name: st.unterschrift_name_2, datum: st.unterschrift_datum_2, label: `Schüler 2${st.gruppe_schueler_namen ? ': ' + st.gruppe_schueler_namen.split(',')[0] : ''}` }] : []),
      ...(st.unterrichtsform === '3er' ? [{ data: st.unterschrift_data_3, name: st.unterschrift_name_3, datum: st.unterschrift_datum_3, label: `Schüler 3${st.gruppe_schueler_namen ? ': ' + st.gruppe_schueler_namen.split(',')[1] || '' : ''}` }] : []),
    ];
    let ux = 50;
    const uWidth = unterschriften.length === 1 ? 240 : unterschriften.length === 2 ? 220 : 140;
    const uGap = unterschriften.length === 1 ? 0 : unterschriften.length === 2 ? 55 : 35;
    unterschriften.forEach((u, i) => {
      const xPos = ux + i * (uWidth + uGap);
      doc.fontSize(9).fillColor('#5a4a7a').font('Helvetica-Bold').text(`UNTERSCHRIFT ${u.label.toUpperCase()}`, xPos, unterschriftY, { width: uWidth });
      if (u.data) {
        const imgData = u.data.replace(/^data:image\/png;base64,/, '');
        doc.image(Buffer.from(imgData, 'base64'), xPos, unterschriftY + 14, { width: uWidth, height: 60 });
        doc.fontSize(8).fillColor('#666').font('Helvetica');
        doc.text(`${u.name || ''}`, xPos, unterschriftY + 78);
        doc.text(`${u.datum ? new Date(u.datum).toLocaleString('de-DE') : ''}`, xPos, unterschriftY + 88);
      } else {
        doc.rect(xPos, unterschriftY + 14, uWidth, 60).strokeColor('#e8e0f5').stroke();
        doc.fontSize(8).fillColor('#bbb').text('ausstehend', xPos + 10, unterschriftY + 38);
      }
    });
    doc.moveTo(50, 700).lineTo(545, 700).strokeColor('#9b7fd4').stroke();
    doc.fontSize(8).fillColor('#888').font('Helvetica');
    doc.text('MJ Lernförderung · Souad Meryem Jaber · Georgstraße 38 · 30159 Hannover · info@mj-lernfoerderung.de', 50, 710, { align: 'center' });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Signatur-Link per Email senden
router.post('/:id/signatur-link', auth, async (req, res) => {
  const { email, nr } = req.body;
  const schuelerSlot = parseInt(nr) || 1;
  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
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
    await pool.query(
      `INSERT INTO signatur_tokens (stunde_id, token, email, schueler_slot) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [req.params.id, token, email, schuelerSlot]
    );
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.ionos.de', port: 587, secure: false,
      auth: { user: 'meryem.jaber@mj-lernfoerderung.de', pass: process.env.SMTP_PASS }
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
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Signatur-Seite laden (öffentlich)
router.get('/signatur/:token', async (req, res) => {
  try {
    const tokenRes = await pool.query(
      `SELECT st.*, s.vorname, s.nachname, u.name as lehrkraft_name, tok.verwendet, tok.email, tok.schueler_slot
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
    const slot = tokenRes.rows[0].schueler_slot || 1;
    let updateQ;
    if (slot === 2) updateQ = `UPDATE stunden SET unterschrift_data_2=$1, unterschrift_name_2=$2, unterschrift_datum_2=NOW() WHERE id=$3`;
    else if (slot === 3) updateQ = `UPDATE stunden SET unterschrift_data_3=$1, unterschrift_name_3=$2, unterschrift_datum_3=NOW() WHERE id=$3`;
    else updateQ = `UPDATE stunden SET unterschrift_data=$1, unterschrift_name=$2, unterschrift_datum=NOW() WHERE id=$3`;
    await pool.query(updateQ, [unterschrift_data, unterschrift_name, stunde_id]);
    await pool.query(`UPDATE signatur_tokens SET verwendet=true WHERE token=$1`, [req.params.token]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ZIP Download für ausgewählte Stunden-IDs (nur Admin)
router.post('/zip-by-ids', auth, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    console.log('ZIP IDs:', ids, 'Anzahl:', ids.length);
    if (!ids || ids.length === 0) return res.status(400).json({ error: 'Keine IDs' });

    const result = await pool.query(
      `SELECT st.*, st.unterschrift_data, st.unterschrift_name, st.unterschrift_datum,
              st.datum, st.fach, st.startzeit, st.endzeit, st.dauer_minuten,
              st.ort, st.fahrt_km, st.inhalt,
              s.vorname as s_vorname, s.nachname as s_nachname,
              s.schule, s.klasse, s.but_status, s.eltern_name, s.eltern_tel,
              u.name as lehrkraft_name, u.email as lehrkraft_email, u.telefon as lehrkraft_tel
       FROM stunden st
       JOIN schueler s ON st.schueler_id = s.id
       JOIN users u ON st.lehrkraft_id = u.id
       WHERE st.id = ANY($1::int[]) AND st.unterschrift_data IS NOT NULL`, [ids]
    );

    const archiver = require('archiver');
    const PDFDocument = require('pdfkit');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="Stundennachweise.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const st of result.rows) {
      const pdfBuffer = await genPDF(st);
      const safe_lk = (st.lehrkraft_name || 'Unbekannt').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safe_s = `${st.s_vorname}_${st.s_nachname}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const datum = new Date(st.datum).toISOString().slice(0,10);
      archive.append(pdfBuffer, { name: `${datum}_${safe_s}_${safe_lk}_${st.id}.pdf` });
    }

    await archive.finalize();
  } catch (err) {
    console.error('ZIP Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

function genPDF(st) {
  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');
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
    doc.text(`${st.s_vorname || st.vorname || '–'} ${st.s_nachname || st.nachname || ''}`, 70, 190);
    doc.fontSize(10).fillColor('#666').font('Helvetica');
    doc.text(`Schule: ${st.schule || '–'}  ·  Klasse: ${st.klasse || '–'}`, 70, 208);
    doc.text(`Eltern: ${st.eltern_name || st.s_eltern_name || '–'}  ·  Tel: ${st.eltern_tel || st.s_eltern_tel || '–'}`, 70, 222);
    doc.text(`BuT-Förderung: ${st.but_status ? 'Ja' : 'Nein'}`, 70, 236);
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold');
    doc.text('LEHRKRAFT', 320, 175);
    doc.fontSize(13).fillColor('#2d2040').font('Helvetica-Bold');
    doc.text(st.lehrkraft_name || '–', 320, 190);
    doc.fontSize(10).fillColor('#666').font('Helvetica');
    doc.text(`E-Mail: ${st.lehrkraft_email || '–'}`, 320, 208);
    doc.text(`Tel: ${st.lehrkraft_tel || '–'}`, 320, 222);
    const details = [
      ['Datum', new Date(st.datum).toLocaleDateString('de-DE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })],
      ['Uhrzeit', `${st.startzeit || '–'} – ${st.endzeit || '–'} Uhr (${st.dauer_minuten || '–'} Min.)`],
      ['Fach', st.fach || '–'],
      ['Ort', st.ort === 'online' ? 'Online' : 'Vor Ort'],
      ...(st.ort !== 'online' && st.fahrt_km ? [
        ['Fahrtweg', `${st.fahrt_km} km (Hinfahrt)`],
        ['Fahrtkosten', `${(parseFloat(st.fahrt_km) * 0.38).toFixed(2)} € (0,38 €/km)`],
      ] : []),
    ];
    const detailBoxHeight = details.length * 18 + 20;
    doc.roundedRect(50, 315, 495, detailBoxHeight, 8).fillColor('#ffffff').stroke('#e8e0f5');
    let y = 325;
    details.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#9b7fd4').font('Helvetica-Bold').text(label + ':', 70, y);
      doc.fontSize(10).fillColor('#2d2040').font('Helvetica').text(value, 180, y);
      y += 18;
    });
    const lernY = y + 15;
    const lernText = st.inhalt || '–';
    doc.fontSize(10).font('Helvetica');
    const lernTextHeight = doc.heightOfString(lernText, { width: 455 });
    const lernBoxHeight = Math.max(80, lernTextHeight + 40);
    doc.roundedRect(50, lernY, 495, lernBoxHeight, 8).fillColor('#f0ebfa').fill();
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold').text('LERNFORTSCHRITT', 70, lernY + 12);
    doc.fontSize(10).fillColor('#2d2040').font('Helvetica').text(lernText, 70, lernY + 28, { width: 455 });
    let unterschriftY = lernY + lernBoxHeight + 20;
    if (unterschriftY + 120 > 690) { doc.addPage(); unterschriftY = 60; }
    doc.fontSize(11).fillColor('#5a4a7a').font('Helvetica-Bold').text('UNTERSCHRIFT ELTERNTEIL', 50, unterschriftY);
    if (st.unterschrift_data) {
      const imgData = st.unterschrift_data.replace(/^data:image\/png;base64,/, '');
      doc.image(Buffer.from(imgData, 'base64'), 50, unterschriftY + 18, { width: 200, height: 70 });
      doc.fontSize(10).fillColor('#666').font('Helvetica');
      doc.text(`Name: ${st.unterschrift_name || ''}`, 50, unterschriftY + 95);
      doc.text(`Datum: ${st.unterschrift_datum ? new Date(st.unterschrift_datum).toLocaleString('de-DE') : ''}`, 50, unterschriftY + 108);
    }
    doc.moveTo(50, 700).lineTo(545, 700).strokeColor('#9b7fd4').stroke();
    doc.fontSize(8).fillColor('#888').font('Helvetica');
    doc.text('MJ Lernförderung · Souad Meryem Jaber · Georgstraße 38 · 30159 Hannover · info@mj-lernfoerderung.de', 50, 710, { align: 'center' });
    doc.end();
  });
}

module.exports = router;
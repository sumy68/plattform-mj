const router = require('express').Router();
const { pool } = require('../db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const notifications = [];
    const heute = new Date().toISOString().split('T')[0];
    const monat = new Date().toISOString().slice(0,7);
    const in30Tagen = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

    if (role === 'admin') {
      // 1. Neue Registrierungen
      const pending = await pool.query("SELECT COUNT(*) FROM users WHERE aktiv=false AND role!='admin'");
      if (parseInt(pending.rows[0].count) > 0) {
        notifications.push({ id:'pending', typ:'warning', icon:'🔓', titel:'Neue Registrierungen', text:`${pending.rows[0].count} Lehrkraft/Honorarkraft wartet auf Freischaltung`, link:'/freischaltung' });
      }

      // 2. Ausstehende Urlaubsanträge
      const urlaubPending = await pool.query(
        `SELECT COUNT(*), array_agg(u.name) as namen FROM abwesenheiten a 
         JOIN users u ON a.user_id=u.id WHERE a.typ='urlaub' AND a.status='ausstehend'`
      );
      if (parseInt(urlaubPending.rows[0].count) > 0) {
        const namen = (urlaubPending.rows[0].namen || []).slice(0,2).join(', ');
        notifications.push({ id:'urlaub_pending', typ:'warning', icon:'🏖️', titel:'Urlaubsanträge ausstehend', text:`${urlaubPending.rows[0].count} Antrag offen — ${namen}`, link:'/freischaltung' });
      }

      // 3. Krankmeldungen heute
      const krankHeute = await pool.query(
        `SELECT COUNT(*), array_agg(u.name) as namen FROM abwesenheiten a 
         JOIN users u ON a.user_id=u.id WHERE a.typ='krank' AND a.created_at::date = CURRENT_DATE`
      );
      if (parseInt(krankHeute.rows[0].count) > 0) {
        const namen = (krankHeute.rows[0].namen || []).slice(0,2).join(', ');
        notifications.push({ id:'krank_heute', typ:'danger', icon:'🤒', titel:'Neue Krankmeldung heute', text:`${namen} hat sich krankgemeldet`, link:'/abwesenheiten' });
      }

      // 4. Krank ohne AU
      const krankOhneAU = await pool.query(
        `SELECT a.id, u.name FROM abwesenheiten a JOIN users u ON a.user_id=u.id 
         WHERE a.typ='krank' AND a.au_pdf_data IS NULL AND u.role='honorarkraft'`
      );
      krankOhneAU.rows.forEach(r => {
        notifications.push({ id:`krank_au_${r.id}`, typ:'danger', icon:'📄', titel:'AU-Bescheinigung fehlt', text:`${r.name} hat keine AU hochgeladen`, link:'/abwesenheiten' });
      });

      // 5. Honorarkräfte ohne Rechnung diesen Monat
      const honorar = await pool.query("SELECT id, name FROM users WHERE role='honorarkraft' AND aktiv=true");
      for (const hk of honorar.rows) {
        const stunden = await pool.query(`SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND to_char(datum,'YYYY-MM')=$2`, [hk.id, monat]);
        const abgerechnet = await pool.query(`SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND to_char(datum,'YYYY-MM')=$2 AND abgerechnet=true`, [hk.id, monat]);
        if (parseInt(stunden.rows[0].count) > 0 && parseInt(abgerechnet.rows[0].count) === 0) {
          notifications.push({ id:`rechnung_${hk.id}`, typ:'warning', icon:'📄', titel:'Keine Rechnung gestellt', text:`${hk.name} hat diesen Monat noch keine Rechnung gestellt`, link:'/abrechnung' });
        }
      }

      // 6. BuT läuft bald ab
      const butBald = await pool.query(
        `SELECT b.id, s.vorname||' '||s.nachname as name, b.gueltig_bis 
         FROM but_antraege b JOIN schueler s ON b.schueler_id=s.id
         WHERE b.aktiv=true AND b.gueltig_bis BETWEEN $1 AND $2`, [heute, in30Tagen]
      );
      butBald.rows.forEach(r => {
        notifications.push({ id:`but_${r.id}`, typ:'warning', icon:'⏰', titel:'BuT läuft bald ab', text:`${r.name} — Antrag läuft am ${new Date(r.gueltig_bis).toLocaleDateString('de-DE')} ab`, link:'/but' });
      });

      // 6b. BuT-Stunden fast verbraucht (<=12)
      const butFastLeer = await pool.query(
        `SELECT b.id, s.vorname||' '||s.nachname as name, 
                (b.gutscheine_gesamt - b.gutscheine_verbraucht)::numeric as offen
         FROM but_antraege b JOIN schueler s ON b.schueler_id=s.id
         WHERE b.aktiv=true AND (b.gutscheine_gesamt - b.gutscheine_verbraucht) <= 12 
         AND (b.gutscheine_gesamt - b.gutscheine_verbraucht) > 0`
      );
      butFastLeer.rows.forEach(r => {
        const offenStr = Number(r.offen).toLocaleString('de-DE', { maximumFractionDigits: 2 });
        notifications.push({ id:`but_leer_${r.id}`, typ:'danger', icon:'⚠️', titel:'BuT-Antrag fast aufgebraucht', text:`${r.name} — nur noch ${offenStr}h. Bitte Schüler/Eltern um neuen Antrag bitten.`, link:'/but' });
      });

      // 7. Schüler ohne Lehrkraft
      const ohneLehrer = await pool.query(
        `SELECT s.id, s.vorname||' '||s.nachname as name FROM schueler s
         WHERE s.aktiv=true AND NOT EXISTS (SELECT 1 FROM lehrkraft_schueler ls WHERE ls.schueler_id=s.id)`
      );
      ohneLehrer.rows.forEach(r => {
        notifications.push({ id:`schueler_${r.id}`, typ:'info', icon:'👧', titel:'Schüler ohne Lehrkraft', text:`${r.name} ist noch keiner Lehrkraft zugewiesen`, link:'/schueler' });
      });

      // 8. Unterschriften fehlen (Admin) — Verwaltungs-Stunden ausgenommen
      const unterschriften = await pool.query(`SELECT COUNT(*) FROM stunden WHERE unterschrift_data IS NULL AND COALESCE(stundentyp,'') <> 'verwaltung' AND to_char(datum,'YYYY-MM')=$1`, [monat]);
      if (parseInt(unterschriften.rows[0].count) > 0) {
        notifications.push({ id:'unterschrift', typ:'warning', icon:'✍️', titel:'Unterschriften fehlen', text:`${unterschriften.rows[0].count} Stunde(n) ohne Unterschrift diesen Monat`, link:'/stunden' });
      }

      // 9. Verwaltungs-Stunden zur Genehmigung
      const verwOffen = await pool.query(`SELECT COUNT(*) FROM stunden WHERE stundentyp='verwaltung' AND genehmigung_status='offen'`);
      if (parseInt(verwOffen.rows[0].count) > 0) {
        notifications.push({ id:'verwaltung_offen', typ:'warning', icon:'🗂️', titel:'Verwaltungs-Stunden prüfen', text:`${verwOffen.rows[0].count} Stunde(n) warten auf Genehmigung`, link:'/freischaltung' });
      }

    } else {
      // LEHRKRAFT / HONORARKRAFT

      // 1. Urlaub genehmigt oder abgelehnt (letzte 7 Tage)
      const urlaubEntschieden = await pool.query(
        `SELECT id, status, datum_von, datum_bis, admin_notiz FROM abwesenheiten 
         WHERE user_id=$1 AND typ='urlaub' AND status != 'ausstehend' 
         AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at DESC LIMIT 3`, [userId]
      );
      urlaubEntschieden.rows.forEach(u => {
        const istGenehmigt = u.status === 'genehmigt';
        notifications.push({
          id:`urlaub_entschieden_${u.id}`,
          typ: istGenehmigt ? 'info' : 'danger',
          icon: istGenehmigt ? '✅' : '❌',
          titel: `Urlaub ${istGenehmigt ? 'genehmigt' : 'abgelehnt'}`,
          text: `${new Date(u.datum_von).toLocaleDateString('de-DE')} – ${new Date(u.datum_bis).toLocaleDateString('de-DE')}${u.admin_notiz ? ` · ${u.admin_notiz}` : ''}`,
          link: '/abwesenheiten'
        });
      });

      // 2. Krank ohne AU
      const eigeneKrank = await pool.query(`SELECT id FROM abwesenheiten WHERE user_id=$1 AND typ='krank' AND au_pdf_data IS NULL`, [userId]);
      if (eigeneKrank.rows.length > 0) {
        notifications.push({ id:'eigene_krank', typ:'danger', icon:'🤒', titel:'AU-Bescheinigung fehlt', text:'Du hast eine Krankmeldung ohne AU-Bescheinigung', link:'/abwesenheiten' });
      }

      // 3. Profil unvollständig
      const profil = await pool.query('SELECT iban, steuernummer FROM users WHERE id=$1', [userId]);
      if (!profil.rows[0]?.iban || !profil.rows[0]?.steuernummer) {
        notifications.push({ id:'profil', typ:'info', icon:'👤', titel:'Profil unvollständig', text:'IBAN oder Steuernummer fehlt noch', link:'/mein-profil' });
      }

      // 4. Offene Stunden älter als 30 Tage
      const vor30 = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
      const offeneAlt = await pool.query(`SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND abgerechnet=false AND datum < $2`, [userId, vor30]);
      if (parseInt(offeneAlt.rows[0].count) > 0) {
        notifications.push({ id:'offen_alt', typ:'warning', icon:'💰', titel:'Offene Stunden', text:`${offeneAlt.rows[0].count} Stunden seit mehr als 30 Tagen nicht abgerechnet`, link:'/mein-guthaben' });
      }

      // 5. Lange keine Stunden
      const letzteStunde = await pool.query(`SELECT MAX(datum) as letzte FROM stunden WHERE lehrkraft_id=$1`, [userId]);
      if (letzteStunde.rows[0]?.letzte) {
        const tage = Math.floor((new Date() - new Date(letzteStunde.rows[0].letzte)) / (1000*60*60*24));
        if (tage > 14) {
          notifications.push({ id:'keine_stunden', typ:'info', icon:'📅', titel:'Lange keine Stunden', text:`Letzte Stunde vor ${tage} Tagen eingetragen`, link:'/meine-stunden' });
        }
      }

      // 5b. Keine Rechnung Ende Monat
      const heute2 = new Date();
      const letzterTagDesMonats = new Date(heute2.getFullYear(), heute2.getMonth() + 1, 0).getDate();
      if (heute2.getDate() >= 25) {
        // Prüfe ob Rechnung diesen Monat gestellt wurde
        try {
          await pool.query(`CREATE TABLE IF NOT EXISTS rechnungen (id SERIAL PRIMARY KEY, user_id INTEGER, stunden_ids INTEGER[], betrag NUMERIC(10,2), rechnungsnummer VARCHAR(50), pdf_data TEXT, erstellt_am TIMESTAMP DEFAULT NOW())`);
          const rechnungRes = await pool.query(
            `SELECT COUNT(*) FROM rechnungen WHERE user_id=$1 AND to_char(erstellt_am,'YYYY-MM')=$2`,
            [userId, monat]
          );
          const hatStunden = await pool.query(
            `SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND to_char(datum,'YYYY-MM')=$2`,
            [userId, monat]
          );
          if (parseInt(rechnungRes.rows[0].count) === 0 && parseInt(hatStunden.rows[0].count) > 0) {
            notifications.push({ id:'keine_rechnung', typ:'danger', icon:'📄', titel:'Rechnung noch nicht gestellt!', text:`Monat endet in ${letzterTagDesMonats - heute2.getDate()} Tagen — Rechnung noch ausstehend`, link:'/mein-guthaben' });
          }
        } catch(e) {}
      }

      // 5c. BuT-Antrag fast verbraucht bei eigenen Schülern (<=12h)
      const butLeerLK = await pool.query(
        `SELECT b.id, s.vorname||' '||s.nachname as name,
                (b.gutscheine_gesamt - b.gutscheine_verbraucht)::numeric as offen
         FROM but_antraege b 
         JOIN schueler s ON b.schueler_id=s.id
         JOIN lehrkraft_schueler ls ON ls.schueler_id=s.id
         WHERE ls.lehrkraft_id=$1 AND b.aktiv=true 
         AND (b.gutscheine_gesamt - b.gutscheine_verbraucht) <= 12
         AND (b.gutscheine_gesamt - b.gutscheine_verbraucht) > 0`,
        [userId]
      );
      butLeerLK.rows.forEach(r => {
        const offenStr = Number(r.offen).toLocaleString('de-DE', { maximumFractionDigits: 2 });
        notifications.push({ id:`but_leer_lk_${r.id}`, typ:'danger', icon:'⚠️', titel:'BuT-Antrag einholen!', text:`${r.name} hat nur noch ${offenStr}h. Bitte beim Schüler/Eltern den neuen BuT-Antrag einholen.`, link:'/but' });
      });

      // 6. Unterschriften fehlen — Verwaltungs-Stunden ausgenommen
      const unterschriften = await pool.query(`SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND unterschrift_data IS NULL AND COALESCE(stundentyp,'') <> 'verwaltung' AND to_char(datum,'YYYY-MM')=$2`, [userId, monat]);
      if (parseInt(unterschriften.rows[0].count) > 0) {
        notifications.push({ id:'unterschrift', typ:'warning', icon:'✍️', titel:'Unterschriften fehlen', text:`${unterschriften.rows[0].count} Stunde(n) ohne Unterschrift diesen Monat`, link:'/meine-stunden' });
      }

      // 7. Verwaltungs-Stunden genehmigt/abgelehnt (letzte 7 Tage)
      const verwEntschieden = await pool.query(
        `SELECT id, genehmigung_status, datum, genehmigung_grund FROM stunden
         WHERE lehrkraft_id=$1 AND stundentyp='verwaltung' AND genehmigung_status IN ('genehmigt','abgelehnt')
         AND genehmigt_am > NOW() - INTERVAL '7 days'
         ORDER BY genehmigt_am DESC LIMIT 3`, [userId]
      );
      verwEntschieden.rows.forEach(v => {
        const ok = v.genehmigung_status === 'genehmigt';
        notifications.push({
          id:`verwaltung_${v.id}`,
          typ: ok ? 'info' : 'danger',
          icon: ok ? '✅' : '❌',
          titel: `Verwaltungs-Stunde ${ok ? 'genehmigt' : 'abgelehnt'}`,
          text: `${new Date(v.datum).toLocaleDateString('de-DE')}${v.genehmigung_grund ? ` · ${v.genehmigung_grund}` : ''}`,
          link: '/meine-stunden'
        });
      });
    }

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
// WIRD BEREITS OBEN DEFINIERT - nur reminder

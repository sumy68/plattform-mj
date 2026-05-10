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

      // 2. Krank ohne AU
      const krankOhneAU = await pool.query(
        `SELECT a.id, u.name FROM abwesenheiten a JOIN users u ON a.user_id=u.id 
         WHERE a.typ='krank' AND a.au_pdf_data IS NULL AND u.role='honorarkraft'`
      );
      krankOhneAU.rows.forEach(r => {
        notifications.push({ id:`krank_${r.id}`, typ:'danger', icon:'🤒', titel:'AU-Bescheinigung fehlt', text:`${r.name} hat keine AU hochgeladen`, link:'/abwesenheiten' });
      });

      // 3. Honorarkräfte ohne Rechnung diesen Monat
      const honorar = await pool.query("SELECT id, name FROM users WHERE role='honorarkraft' AND aktiv=true");
      for (const hk of honorar.rows) {
        const stunden = await pool.query(
          `SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND to_char(datum,'YYYY-MM')=$2`,
          [hk.id, monat]
        );
        const abgerechnet = await pool.query(
          `SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND to_char(datum,'YYYY-MM')=$2 AND abgerechnet=true`,
          [hk.id, monat]
        );
        if (parseInt(stunden.rows[0].count) > 0 && parseInt(abgerechnet.rows[0].count) === 0) {
          notifications.push({ id:`rechnung_${hk.id}`, typ:'warning', icon:'📄', titel:'Keine Rechnung gestellt', text:`${hk.name} hat diesen Monat noch keine Rechnung gestellt`, link:'/abrechnung' });
        }
      }

      // 4. BuT läuft bald ab
      const butBald = await pool.query(
        `SELECT b.id, s.vorname||' '||s.nachname as name, b.gueltig_bis 
         FROM but_antraege b JOIN schueler s ON b.schueler_id=s.id
         WHERE b.aktiv=true AND b.gueltig_bis BETWEEN $1 AND $2`,
        [heute, in30Tagen]
      );
      butBald.rows.forEach(r => {
        notifications.push({ id:`but_${r.id}`, typ:'warning', icon:'⏰', titel:'BuT läuft bald ab', text:`${r.name} — Antrag läuft am ${new Date(r.gueltig_bis).toLocaleDateString('de-DE')} ab`, link:'/but' });
      });

      // 5. Schüler ohne Lehrkraft
      const ohneLehrer = await pool.query(
        `SELECT s.id, s.vorname||' '||s.nachname as name FROM schueler s
         WHERE s.aktiv=true AND NOT EXISTS (SELECT 1 FROM lehrkraft_schueler ls WHERE ls.schueler_id=s.id)`
      );
      ohneLehrer.rows.forEach(r => {
        notifications.push({ id:`schueler_${r.id}`, typ:'info', icon:'👧', titel:'Schüler ohne Lehrkraft', text:`${r.name} ist noch keiner Lehrkraft zugewiesen`, link:'/schueler' });
      });

    } else {
      // Lehrkraft/Honorarkraft Notifications

      // 1. Krank ohne AU (eigene)
      const eigeneKrank = await pool.query(
        `SELECT id FROM abwesenheiten WHERE user_id=$1 AND typ='krank' AND au_pdf_data IS NULL`,
        [userId]
      );
      if (eigeneKrank.rows.length > 0) {
        notifications.push({ id:'eigene_krank', typ:'danger', icon:'🤒', titel:'AU-Bescheinigung fehlt', text:'Du hast eine Krankmeldung ohne AU-Bescheinigung', link:'/abwesenheiten' });
      }

      // 2. Profil unvollständig
      const profil = await pool.query('SELECT iban, steuernummer FROM users WHERE id=$1', [userId]);
      if (!profil.rows[0]?.iban || !profil.rows[0]?.steuernummer) {
        notifications.push({ id:'profil', typ:'info', icon:'👤', titel:'Profil unvollständig', text:'IBAN oder Steuernummer fehlt noch', link:'/mein-profil' });
      }

      // 3. Offene Stunden älter als 30 Tage
      const vor30 = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
      const offeneAlt = await pool.query(
        `SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND abgerechnet=false AND datum < $2`,
        [userId, vor30]
      );
      if (parseInt(offeneAlt.rows[0].count) > 0) {
        notifications.push({ id:'offen_alt', typ:'warning', icon:'💰', titel:'Offene Stunden', text:`${offeneAlt.rows[0].count} Stunden seit mehr als 30 Tagen nicht abgerechnet`, link:'/mein-guthaben' });
      }

      // 4. Lange keine Stunden
      const letzteStunde = await pool.query(
        `SELECT MAX(datum) as letzte FROM stunden WHERE lehrkraft_id=$1`, [userId]
      );
      if (letzteStunde.rows[0]?.letzte) {
        const tage = Math.floor((new Date() - new Date(letzteStunde.rows[0].letzte)) / (1000*60*60*24));
        if (tage > 14) {
          notifications.push({ id:'keine_stunden', typ:'info', icon:'📅', titel:'Lange keine Stunden', text:`Letzte Stunde vor ${tage} Tagen eingetragen`, link:'/meine-stunden' });
        }
      }
    }

    // Für ALLE: Unterschriften fehlen
    const unterschriftQuery = role === 'admin'
      ? `SELECT COUNT(*) FROM stunden WHERE unterschrift_data IS NULL AND to_char(datum,'YYYY-MM')=$1`
      : `SELECT COUNT(*) FROM stunden WHERE lehrkraft_id=$1 AND unterschrift_data IS NULL AND to_char(datum,'YYYY-MM')=$2`;
    const unterschriftParams = role === 'admin' ? [monat] : [userId, monat];
    const unterschriften = await pool.query(unterschriftQuery, unterschriftParams);
    if (parseInt(unterschriften.rows[0].count) > 0) {
      notifications.push({ 
        id:'unterschrift', typ:'warning', icon:'✍️', 
        titel:'Unterschriften fehlen', 
        text:`${unterschriften.rows[0].count} Stunde(n) ohne Unterschrift diesen Monat`, 
        link: role === 'admin' ? '/stunden' : '/meine-stunden' 
      });
    }

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const router = require('express').Router();

// Migration: Spalte stundenbedarf_woche (Dezimalstunden pro Woche)
(async () => {
  try {
    const { pool } = require('../db');
    await pool.query(`ALTER TABLE schueler ADD COLUMN IF NOT EXISTS stundenbedarf_woche NUMERIC(5,2)`);
    await pool.query(`DO $$
      BEGIN
        IF (SELECT data_type FROM information_schema.columns WHERE table_name='schueler' AND column_name='diagnose') = 'text' THEN
          ALTER TABLE schueler ALTER COLUMN diagnose TYPE text[] USING
            CASE WHEN diagnose IS NULL OR diagnose='' THEN '{}'::text[]
                 ELSE string_to_array(diagnose, ',') END;
        END IF;
      END $$;`);
    // diagnose_cleanup_v1: Müll-Einträge { } aus diagnose-Arrays entfernen
    await pool.query(`UPDATE schueler SET diagnose = (
      SELECT COALESCE(array_agg(x), '{}')
      FROM unnest(diagnose) AS x
      WHERE x NOT IN ('{', '}', '{}', '')
    ) WHERE diagnose IS NOT NULL;`);
  } catch (e) { console.error('Migration stundenbedarf_woche:', e.message); }
})();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const { berechneKlasse, schuljahrVon } = require('../utils/klasse');

// Alle Schüler (Admin: alle, Lehrkraft: nur zugewiesene)
router.get('/', auth, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query('SELECT * FROM schueler WHERE aktiv=true ORDER BY nachname,vorname');
    } else {
      result = await pool.query(
        `SELECT s.* FROM schueler s
         JOIN lehrkraft_schueler ls ON s.id=ls.schueler_id
         WHERE ls.lehrkraft_id=$1 AND s.aktiv=true
         ORDER BY s.nachname,s.vorname`,
        [req.user.id]
      );
    }
    const rows = result.rows.map(r => ({ ...r, klasse_original: r.klasse, klasse: berechneKlasse(r.klasse, r.klassenstufe_jahr) }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schüler anlegen (nur Admin)
router.post('/', auth, adminOnly, async (req, res) => {
  const { vorname, nachname, geburtsdatum, schule, klasse, faecher, sprachen, eltern_name, eltern_tel, eltern_email, adresse, but_status, but_zeitraum_von, but_zeitraum_bis, diagnose, notizen, deutschniveau, lieblingsfach, schwachstes_fach, konzentration, eigenmotivation, selbststaendigkeit, tipps_tricks, stundenbedarf_woche } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO schueler (vorname,nachname,geburtsdatum,schule,klasse,faecher,sprachen,eltern_name,eltern_tel,eltern_email,adresse,but_status,but_zeitraum_von,but_zeitraum_bis,diagnose,notizen,deutschniveau,lieblingsfach,schwachstes_fach,konzentration,eigenmotivation,selbststaendigkeit,tipps_tricks,klassenstufe_jahr,stundenbedarf_woche)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
      [vorname,nachname,geburtsdatum||null,schule,klasse,faecher,sprachen,eltern_name,eltern_tel,eltern_email,adresse,but_status,but_zeitraum_von||null,but_zeitraum_bis||null,diagnose,notizen,deutschniveau,lieblingsfach,schwachstes_fach,konzentration,eigenmotivation,selbststaendigkeit,tipps_tricks,schuljahrVon(new Date()),stundenbedarf_woche!==undefined?stundenbedarf_woche:null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schüler bearbeiten
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { vorname, nachname, geburtsdatum, schule, klasse, faecher, sprachen, eltern_name, eltern_tel, eltern_email, adresse, but_status, but_zeitraum_von, but_zeitraum_bis, diagnose, notizen, deutschniveau, lieblingsfach, schwachstes_fach, konzentration, eigenmotivation, selbststaendigkeit, tipps_tricks, stundenbedarf_woche } = req.body;
  try {
    const result = await pool.query(
      `UPDATE schueler SET vorname=$1,nachname=$2,geburtsdatum=$3,schule=$4,klasse=$5,faecher=$6,sprachen=$7,
       eltern_name=$8,eltern_tel=$9,eltern_email=$10,adresse=$11,but_status=$12,
       but_zeitraum_von=$13,but_zeitraum_bis=$14,diagnose=$15,notizen=$16,
       deutschniveau=$17,lieblingsfach=$18,schwachstes_fach=$19,konzentration=$20,
       eigenmotivation=$21,selbststaendigkeit=$22,tipps_tricks=$23,klassenstufe_jahr=$24,stundenbedarf_woche=$25 WHERE id=$26 RETURNING *`,
      [vorname,nachname,geburtsdatum||null,schule,klasse,faecher,sprachen,eltern_name,eltern_tel,eltern_email,adresse,but_status,but_zeitraum_von||null,but_zeitraum_bis||null,diagnose,notizen,deutschniveau,lieblingsfach,schwachstes_fach,konzentration,eigenmotivation,selbststaendigkeit,tipps_tricks,schuljahrVon(new Date()),stundenbedarf_woche!==undefined?stundenbedarf_woche:null,req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schüler deaktivieren
router.patch('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE schueler SET aktiv=$1 WHERE id=$2', [req.body.aktiv, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Zuweisungen abrufen
router.get('/:id/zuweisungen', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id as lehrkraft_id, u.name, u.role 
       FROM lehrkraft_schueler ls 
       JOIN users u ON ls.lehrkraft_id=u.id 
       WHERE ls.schueler_id=$1`,
      [req.params.id]
    );
    const rows = result.rows.map(r => ({ ...r, klasse_original: r.klasse, klasse: berechneKlasse(r.klasse, r.klassenstufe_jahr) }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Zuweisung hinzufügen
router.post('/:id/zuweisung', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO lehrkraft_schueler (lehrkraft_id,schueler_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.body.lehrkraft_id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Zuweisung entfernen
router.delete('/:id/zuweisung/:lehrkraft_id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM lehrkraft_schueler WHERE schueler_id=$1 AND lehrkraft_id=$2', [req.params.id, req.params.lehrkraft_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM but_antraege WHERE schueler_id=$1', [req.params.id]);
    await pool.query('DELETE FROM lehrkraft_schueler WHERE schueler_id=$1', [req.params.id]);
    await pool.query('DELETE FROM stunden WHERE schueler_id=$1', [req.params.id]);
    await pool.query('DELETE FROM but_antraege WHERE schueler_id=$1', [req.params.id]);
    await pool.query('DELETE FROM schueler WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-Übersicht: alle Lehrkräfte mit zugewiesenen Schülern
router.get('/uebersicht/lehrkraefte', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id AS lehrkraft_id, u.name AS lehrkraft_name, u.role,
        COALESCE(
          json_agg(
            json_build_object('id', s.id, 'name', s.vorname || ' ' || s.nachname, 'klasse', s.klasse)
            ORDER BY s.nachname, s.vorname
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS schueler
      FROM users u
      LEFT JOIN lehrkraft_schueler ls ON ls.lehrkraft_id = u.id
      LEFT JOIN schueler s ON s.id = ls.schueler_id AND s.aktiv = true
      WHERE u.role IN ('lehrkraft','honorarkraft') AND u.aktiv = true
      GROUP BY u.id, u.name, u.role
      ORDER BY u.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Lehrkraft kann SchülerInnen-Infos bearbeiten
router.put('/:id/infos', auth, async (req, res) => {
  const { deutschniveau, lieblingsfach, schwachstes_fach, konzentration, eigenmotivation, selbststaendigkeit, tipps_tricks } = req.body;
  try {
    const result = await pool.query(
      `UPDATE schueler SET deutschniveau=$1, lieblingsfach=$2, schwachstes_fach=$3, konzentration=$4, eigenmotivation=$5, selbststaendigkeit=$6, tipps_tricks=$7 WHERE id=$8 RETURNING *`,
      [deutschniveau, lieblingsfach, schwachstes_fach, konzentration, eigenmotivation, selbststaendigkeit, tipps_tricks, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

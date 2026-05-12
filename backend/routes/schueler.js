const router = require('express').Router();
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

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
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schüler anlegen (nur Admin)
router.post('/', auth, adminOnly, async (req, res) => {
  const { vorname, nachname, geburtsdatum, schule, klasse, faecher, sprachen, eltern_name, eltern_tel, eltern_email, adresse, but_status, but_zeitraum_von, but_zeitraum_bis, diagnose, notizen } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO schueler (vorname,nachname,geburtsdatum,schule,klasse,faecher,sprachen,eltern_name,eltern_tel,eltern_email,adresse,but_status,but_zeitraum_von,but_zeitraum_bis,diagnose,notizen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [vorname,nachname,geburtsdatum||null,schule,klasse,faecher,sprachen,eltern_name,eltern_tel,eltern_email,adresse,but_status,but_zeitraum_von||null,but_zeitraum_bis||null,diagnose,notizen]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schüler bearbeiten
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { vorname, nachname, geburtsdatum, schule, klasse, faecher, sprachen, eltern_name, eltern_tel, eltern_email, adresse, but_status, but_zeitraum_von, but_zeitraum_bis, diagnose, notizen } = req.body;
  try {
    const result = await pool.query(
      `UPDATE schueler SET vorname=$1,nachname=$2,geburtsdatum=$3,schule=$4,klasse=$5,faecher=$6,sprachen=$7,
       eltern_name=$8,eltern_tel=$9,eltern_email=$10,adresse=$11,but_status=$12,
       but_zeitraum_von=$13,but_zeitraum_bis=$14,diagnose=$15,notizen=$16 WHERE id=$17 RETURNING *`,
      [vorname,nachname,geburtsdatum||null,schule,klasse,faecher,sprachen,eltern_name,eltern_tel,eltern_email,adresse,but_status,but_zeitraum_von||null,but_zeitraum_bis||null,diagnose,notizen,req.params.id]
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
    res.json(result.rows);
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

module.exports = router;

const router = require('express').Router();
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Profil abrufen
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,name,email,role,stundensatz,profil_komplett,vorname,nachname,geschlecht,adresse,plz,ort,iban,steuernummer,geburtsdatum,telefon,sprachen,fuehrerschein FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profil speichern
router.put('/', auth, async (req, res) => {
  const { vorname, nachname, email, geschlecht, adresse, plz, ort, iban, steuernummer, geburtsdatum, telefon, sprachen, fuehrerschein, qualifikation, faecher } = req.body;
  try {
    const fullName = `${vorname || ''} ${nachname || ''}`.trim();
    const result = await pool.query(
      `UPDATE users SET 
        vorname=$1, nachname=$2, geschlecht=$3, adresse=$4, plz=$5, ort=$6,
        iban=$7, steuernummer=$8, geburtsdatum=$9, telefon=$10, sprachen=$11,
        profil_komplett=true, name=$12, fuehrerschein=$13, email=$14,
        qualifikation=$15, faecher=$16
       WHERE id=$17 RETURNING *`,
      [vorname, nachname, geschlecht, adresse, plz, ort, iban, steuernummer, geburtsdatum || null, telefon, sprachen, fullName, fuehrerschein || false, email, qualifikation || null, faecher || null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Passwort ändern
router.put('/passwort', auth, async (req, res) => {
  const { altes_passwort, neues_passwort } = req.body;
  try {
    const result = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(altes_passwort, result.rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Altes Passwort ist falsch' });
    if (neues_passwort.length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    const hash = await bcrypt.hash(neues_passwort, 10);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// EINMALIG: Admin Name fix
router.get('/fix-admin', async (req, res) => {
  const { pool } = require('../db');
  await pool.query(`UPDATE users SET name='Souad Meryem Jaber', telefon='0152 5635 2575' WHERE role='admin'`);
  res.json({ success: true });
});

module.exports = router;
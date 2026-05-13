const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
    if (!user.aktiv) return res.status(403).json({ error: 'Account noch nicht freigeschaltet. Bitte warte auf die Freischaltung durch die Verwaltung.' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Selbst-Registrierung (wartet auf Freischaltung)
router.post('/register-request', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!['honorarkraft', 'lehrkraft'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length > 0) return res.status(400).json({ error: 'E-Mail bereits registriert' });
    const hash = await bcrypt.hash(password, 10);
    const nameParts = name.trim().split(' ');
    const vorname = nameParts[0] || '';
    const nachname = nameParts.slice(1).join(' ') || '';
    await pool.query(
      'INSERT INTO users (name,email,password,role,aktiv,vorname,nachname) VALUES ($1,$2,$3,$4,false,$5,$6)',
      [name, email, hash, role, vorname, nachname]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ausstehende Anfragen (nur Admin)
router.get('/pending', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,name,email,role,created_at FROM users WHERE aktiv=false AND role!=\'admin\' AND (manuell_deaktiviert IS NULL OR manuell_deaktiviert=false) ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Freischalten (nur Admin)
router.patch('/freischalten/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE users SET aktiv=true WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ablehnen (nur Admin)
router.delete('/ablehnen/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1 AND aktiv=false', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Benutzer erstellen (nur Admin)
router.post('/register', auth, adminOnly, async (req, res) => {
  const { name, email, password, role, stundensatz } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name,email,password,role,stundensatz,aktiv) VALUES ($1,$2,$3,$4,$5,true) RETURNING id,name,email,role',
      [name, email, hash, role, stundensatz || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alle Benutzer (nur Admin)
router.get('/users/:id/profil', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,name,email,role,stundensatz,aktiv,vorname,nachname,geschlecht,adresse,plz,ort,iban,steuernummer,geburtsdatum,telefon,sprachen FROM users WHERE id=$1',
      [req.params.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT id,name,email,role,stundensatz,aktiv,created_at FROM users WHERE aktiv=true ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    if (req.body.stundensatz !== undefined) {
      await pool.query('UPDATE users SET stundensatz=$1 WHERE id=$2', [req.body.stundensatz, req.params.id]);
    } else {
      if (req.body.aktiv === false) {
        await pool.query('UPDATE users SET aktiv=false, manuell_deaktiviert=true WHERE id=$1', [req.params.id]);
      } else {
        await pool.query('UPDATE users SET aktiv=true, manuell_deaktiviert=false WHERE id=$1', [req.params.id]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id,name,email,role,stundensatz FROM users WHERE id=$1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


// Benutzer löschen (nur Admin)
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1 AND role!=\'admin\'', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

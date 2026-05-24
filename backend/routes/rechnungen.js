const router = require('express').Router();
const { pool } = require('../db');
const { auth } = require('../middleware/auth');

// Eigene Rechnungen abrufen (nur Honorarkräfte)
router.get('/meine', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, rechnungsnummer, monat, betrag, erstellt_am, pdf_data
       FROM rechnungen
       WHERE user_id = $1
       ORDER BY erstellt_am DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

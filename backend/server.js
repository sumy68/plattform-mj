require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' })); // groß wegen Unterschrift Base64

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schueler', require('./routes/schueler'));
app.use('/api/stunden', require('./routes/stunden'));
app.use("/api/abrechnung", require("./routes/abrechnung"));
app.use("/api/rechnungen", require("./routes/rechnungen"));
app.use('/api/profil/dokumente', require('./routes/profilDokumente'));
app.use('/api/profil', require('./routes/profil'));
app.use('/api/dokumente', require('./routes/dokumente'));
app.use('/api/but', require('./routes/but'));

app.use('/api/export', require('./routes/export'));
app.use('/api/but-public-upload', require('./routes/but-public-upload'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.get('/api/debug/schema', async (req, res) => {
  const { pool } = require('./db');
  const tables = ['users','schueler','stunden','but_antraege','abwesenheiten','notifications','dokumente','rechnungen','lehrkraft_schueler','abrechnungen'];
  const result = {};
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
      result[t] = r.rows.map(c => c.column_name);
    } catch(e) { result[t] = 'ERROR: '+e.message; }
  }
  res.json(result);
});

const PORT = process.env.PORT || 5000;

initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
}).catch(err => {
  console.error('❌ DB Fehler:', err);
  process.exit(1);
});
app.use('/api/abwesenheiten', require('./routes/abwesenheiten'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support', require('./routes/support'));

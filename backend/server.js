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
app.use('/api/abrechnung', require('./routes/abrechnung'));
app.use('/api/profil', require('./routes/profil'));
app.use('/api/dokumente', require('./routes/dokumente'));
app.use('/api/but', require('./routes/but'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

const PORT = process.env.PORT || 5000;

initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
}).catch(err => {
  console.error('❌ DB Fehler:', err);
  process.exit(1);
});
app.use('/api/abwesenheiten', require('./routes/abwesenheiten'));
app.use('/api/notifications', require('./routes/notifications'));

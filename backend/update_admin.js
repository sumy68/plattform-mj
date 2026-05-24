const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://mj_verwaltung_user:6GbwDKko6XOHLNa4LvINEyOTbnyvM1YW@dpg-d7ts0njeo5us73brs8d0-a.frankfurt-postgres.render.com/mj_verwaltung', ssl: { rejectUnauthorized: false } });

async function run() {
  await pool.query(`UPDATE users SET name='Souad Meryem Jaber', telefon='0152 5635 2575' WHERE rolle='admin'`);
  console.log('Done!');
  await pool.end();
}
run();

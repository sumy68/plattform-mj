const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const r = await pool.query(`
    SELECT st.id, st.datum, st.unterschrift_name, st.unterschrift_data IS NOT NULL as hat_unterschrift
    FROM stunden st
    JOIN schueler s ON st.schueler_id = s.id
    WHERE s.vorname ILIKE '%Ahmad%'
  `);
  console.log(r.rows);
  await pool.end();
}
run();

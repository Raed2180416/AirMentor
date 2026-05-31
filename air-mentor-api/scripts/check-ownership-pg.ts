import { Pool } from 'pg';
const pool = new Pool({ connectionString: 'postgresql://postgres:QFDTMYXmYujvHsMwQvrLQDebfhfCurCQ@yamanote.proxy.rlwy.net:36859/railway' });

async function check() {
  const res = await pool.query("SELECT * FROM faculty_offering_ownerships WHERE faculty_id = 'mnc_t2'");
  console.log('Ownerships for mnc_t2:', res.rows.length);
  console.log(res.rows);
  pool.end();
}
check().catch(console.error);

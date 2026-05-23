import { Client } from 'pg';

async function testConnection() {
  console.log("Testing with SSL...");
  const clientSSL = new Client({
    connectionString: "postgresql://postgres:QFDTMYXmYujvHsMwQvrLQDebfhfCurCQ@yamanote.proxy.rlwy.net:36859/railway",
    ssl: { rejectUnauthorized: false }
  });
  try {
    await clientSSL.connect();
    const res = await clientSSL.query('SELECT count(*) FROM simulation_stage_student_projections');
    console.log("SSL projections count:", res.rows[0]);
    await clientSSL.end();
    return;
  } catch (e) {
    console.error("SSL Error:", e.message);
  }

  console.log("Testing without SSL...");
  const clientNoSSL = new Client({
    connectionString: "postgresql://postgres:QFDTMYXmYujvHsMwQvrLQDebfhfCurCQ@yamanote.proxy.rlwy.net:36859/railway"
  });
  try {
    await clientNoSSL.connect();
    const res = await clientNoSSL.query('SELECT count(*) FROM simulation_stage_student_projections');
    console.log("No SSL projections count:", res.rows[0]);
    await clientNoSSL.end();
  } catch (e) {
    console.error("No SSL Error:", e.message);
  }
}

testConnection();

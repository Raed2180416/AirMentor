import { createPool, createDb } from '../src/db/client.js'
import { recomputeObservedOnlyRisk } from '../src/adapters/simulation/msruas-proof-control-plane.js'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'

async function run() {
  const connectionString = 'postgres://postgres:postgres@127.0.0.1:35471/postgres';
  const pool = createPool(connectionString);
  const db = createDb(pool);
  
  console.log("Triggering risk recomputation on port 35471...");
  await recomputeObservedOnlyRisk(db, {
    simulationRunId: 'sim_mnc_2023_first6_v1',
    policy: DEFAULT_POLICY,
    now: '2026-03-16T00:00:00.000Z'
  });
  console.log("Completed!");
  await pool.end();
}
run().catch(console.error);

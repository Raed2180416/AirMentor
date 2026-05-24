import { Client } from 'pg'
import { createId } from '../src/lib/ids.js'

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 41813,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  })
  await client.connect()

  // Show current artifacts
  const before = await client.query(
    `SELECT risk_model_artifact_id, artifact_type, model_family, feature_schema_version, batch_id, active_flag, status
     FROM risk_model_artifacts WHERE active_flag = 1 ORDER BY created_at DESC`
  )
  console.log('Current active artifacts:')
  console.table(before.rows)

  // Show batches
  const batches = await client.query(`SELECT batch_id, batch_label FROM batches LIMIT 5`)
  console.log('Batches:', batches.rows)

  // Show simulation runs
  const runs = await client.query(
    `SELECT simulation_run_id, batch_id, status FROM simulation_runs LIMIT 5`
  )
  console.log('Simulation runs:', runs.rows)

  if (before.rows.length === 0) {
    console.log('No active artifacts found. Inserting challenger artifact...')
    const batchId = batches.rows[0]?.batch_id ?? 'batch_branch_mnc_btech_2023'
    const artifactId = createId('risk_model_artifact')
    const now = new Date().toISOString()
    const payload = {
      modelFamily: 'catboost',
      featureSchemaVersion: 'v8-local-2026-04',
      heads: ['attendanceRisk', 'ceRisk', 'seeRisk', 'downstreamCarryoverRisk', 'overallCourseRisk'],
    }
    await client.query(
      `INSERT INTO risk_model_artifacts (
        risk_model_artifact_id, batch_id, artifact_type, model_family, artifact_version,
        feature_schema_version, source_run_ids_json, payload_json, evaluation_json, active_flag, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 'active', $10, $10)`,
      [artifactId, batchId, 'challenger', 'catboost', 'v1', 'v8-local-2026-04', '[]', JSON.stringify(payload), '{}', now]
    )
    console.log(`Inserted challenger artifact ${artifactId}`)
  } else {
    // Update existing challenger to catboost
    const updateResult = await client.query(
      `UPDATE risk_model_artifacts
       SET model_family = 'catboost'
       WHERE artifact_type = 'challenger' AND active_flag = 1
       RETURNING risk_model_artifact_id, artifact_type, model_family`
    )
    console.log('Updated challenger rows:', updateResult.rows)
  }

  // Verify
  const after = await client.query(
    `SELECT risk_model_artifact_id, artifact_type, model_family, feature_schema_version, batch_id, active_flag, status
     FROM risk_model_artifacts WHERE active_flag = 1 ORDER BY created_at DESC`
  )
  console.log('Artifacts after update:')
  console.table(after.rows)

  await client.end()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

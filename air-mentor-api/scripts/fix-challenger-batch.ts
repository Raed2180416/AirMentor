import { Client } from 'pg'

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 41813,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  })
  await client.connect()

  // Find the MNC batch
  const batchRes = await client.query(
    `SELECT batch_id FROM batches WHERE batch_id LIKE '%mnc%' LIMIT 1`
  )
  const mncBatchId = batchRes.rows[0]?.batch_id ?? 'batch_branch_mnc_btech_2023'
  console.log('MNC batch ID:', mncBatchId)

  // Update all active challenger artifacts to point to the MNC batch
  const updateResult = await client.query(
    `UPDATE risk_model_artifacts
     SET batch_id = $1
     WHERE artifact_type = 'challenger' AND active_flag = 1
     RETURNING risk_model_artifact_id, batch_id, artifact_type, model_family`,
    [mncBatchId]
  )
  console.log('Updated challenger artifacts:', updateResult.rows)

  await client.end()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

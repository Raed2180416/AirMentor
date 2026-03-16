import { createPool, createDb } from './db/client.js'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'

async function main() {
  const config = loadConfig()
  const pool = createPool(config.databaseUrl)
  const db = createDb(pool)
  const app = await buildApp({ config, db, pool })
  await app.listen({ port: config.port, host: config.host })
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

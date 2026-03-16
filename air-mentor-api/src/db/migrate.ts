import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool } from './client.js'
import { loadConfig } from '../config.js'

async function ensureMigrationsTable(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at text NOT NULL
    )
  `)
}

export async function runSqlMigrations(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows?: Array<{ filename: string }> }> }, migrationsDir: string) {
  await ensureMigrationsTable(client)
  const files = (await readdir(migrationsDir)).filter(file => file.endsWith('.sql')).sort()
  for (const filename of files) {
    const existing = await client.query('SELECT filename FROM schema_migrations WHERE filename = $1', [filename])
    if (existing.rows && existing.rows.length > 0) continue
    const sql = await readFile(path.join(migrationsDir, filename), 'utf8')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, $2)', [filename, new Date().toISOString()])
  }
}

export async function main() {
  const config = loadConfig()
  const pool = createPool(config.databaseUrl)
  try {
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
    await runSqlMigrations(pool, migrationsDir)
  } finally {
    await pool.end()
  }
}

const currentFilePath = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

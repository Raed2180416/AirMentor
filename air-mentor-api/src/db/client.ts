import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { allTables } from './schema.js'

export function createPool(connectionString: string) {
  return new Pool({ connectionString })
}

export function createDb(pool: Pool) {
  return drizzle(pool, { schema: allTables })
}

export type AppDb = ReturnType<typeof createDb>

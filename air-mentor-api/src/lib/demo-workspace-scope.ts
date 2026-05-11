import type { Pool } from 'pg'

export function buildDemoScopeName(demoWorkspaceId: string) {
  const normalized = demoWorkspaceId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return `demo_ws_${normalized || 'workspace'}`
}

export function assertSafeDemoScopeName(scopeName: string) {
  if (!/^demo_ws_[a-z0-9_]+$/.test(scopeName)) {
    throw new Error(`Unsafe demo scope name: ${scopeName}`)
  }
  return scopeName
}

export function quotePgIdentifier(identifier: string) {
  const safe = assertSafeDemoScopeName(identifier)
  return `"${safe.replace(/"/g, '""')}"`
}

export async function createDemoWorkspaceSchema(pool: Pick<Pool, 'query'>, scopeName: string) {
  const quoted = quotePgIdentifier(scopeName)
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoted}`)
  return { scopeName }
}

export async function dropDemoWorkspaceSchema(pool: Pick<Pool, 'query'>, scopeName: string) {
  const quoted = quotePgIdentifier(scopeName)
  await pool.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)
  return { scopeName }
}

export async function demoWorkspaceSchemaExists(pool: Pick<Pool, 'query'>, scopeName: string) {
  assertSafeDemoScopeName(scopeName)
  const result = await pool.query('SELECT 1 FROM pg_namespace WHERE nspname = $1 LIMIT 1', [scopeName])
  return (result.rows?.length ?? 0) > 0
}

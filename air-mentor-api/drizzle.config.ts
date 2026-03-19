import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'

const packageRoot = path.dirname(fileURLToPath(import.meta.url))

for (const envFile of ['.env', '.env.local']) {
  const envPath = path.join(packageRoot, envFile)
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath)
  }
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.RAILWAY_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/airmentor',
  },
})

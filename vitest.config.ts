import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const root = import.meta.dirname ?? process.cwd()

export default defineConfig({
  resolve: {
    alias: {
      '@kernel': resolve(root, 'kernel'),
      '@adapters': resolve(root, 'adapters'),
      '@web': resolve(root, 'adapters/web'),
      '@http': resolve(root, 'adapters/http'),
      '@persistence': resolve(root, 'adapters/persistence'),
      '@simulation': resolve(root, 'adapters/simulation'),
      '@universities': resolve(root, 'universities'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const root = import.meta.dirname ?? process.cwd()

// https://vite.dev/config/
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isUserSite = repoName.endsWith('.github.io')
const pagesBase = process.env.GITHUB_ACTIONS
  ? (isUserSite ? '/' : `/${repoName}/`)
  : '/'
const apiProxyTarget = process.env.AIRMENTOR_UI_PROXY_API_TARGET?.trim() || ''
const apiBaseUrl = process.env.VITE_AIRMENTOR_API_BASE_URL?.trim() || ''
const liveApiProxy = apiProxyTarget && apiBaseUrl === '/'
  ? {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    }
  : undefined
const devWatchIgnored = [
  '**/air-mentor-api/.venv/**',
  '**/air-mentor-api/.tabpfn-venv/**',
  '**/air-mentor-api/node_modules/**',
  '**/air-mentor-api/output/**',
  '**/air-mentor-api/scripts/__pycache__/**',
]

export default defineConfig({
  plugins: [react()],
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
  base: pagesBase,
  server: {
    ...(liveApiProxy ? { proxy: liveApiProxy } : {}),
    watch: {
      ignored: devWatchIgnored,
    },
  },
  preview: liveApiProxy
    ? {
        proxy: liveApiProxy,
      }
    : undefined,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-dom')) {
            return 'motion-vendor'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor'
          }
          if (
            id.includes('/adapters/web/simulation/fixtures.ts')
            || id.includes('/kernel/shared/domain.ts')
            || id.includes('/kernel/grading/assessment-weights.ts')
            || id.includes('/adapters/persistence/repositories/air-mentor-repositories.ts')
            || id.includes('/adapters/web/shared/state/calendar-utils.ts')
            || id.includes('/adapters/web/shared/state/page-utils.ts')
            || id.includes('/adapters/web/shared/ui/primitives.tsx')
          ) {
            return 'app-shared'
          }
          return undefined
        },
      },
    },
  },
})

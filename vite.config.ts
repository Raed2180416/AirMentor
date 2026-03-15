import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isUserSite = repoName.endsWith('.github.io')
const pagesBase = process.env.GITHUB_ACTIONS
  ? (isUserSite ? '/' : `/${repoName}/`)
  : '/'

export default defineConfig({
  plugins: [react()],
  base: pagesBase,
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
            id.includes('/src/data.ts')
            || id.includes('/src/domain.ts')
            || id.includes('/src/selectors.ts')
            || id.includes('/src/repositories.ts')
            || id.includes('/src/calendar-utils.ts')
            || id.includes('/src/page-utils.ts')
            || id.includes('/src/ui-primitives.tsx')
          ) {
            return 'app-shared'
          }
          return undefined
        },
      },
    },
  },
})

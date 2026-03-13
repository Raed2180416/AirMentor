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
})

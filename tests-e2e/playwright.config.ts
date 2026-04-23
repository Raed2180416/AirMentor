import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from './support/playwright-runtime'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(configDir, '..')
const artifactsDir = path.join(configDir, 'artifacts')
const frontendBaseUrl = process.env.AIRMENTOR_PW_FRONTEND_BASE_URL ?? 'http://127.0.0.1:5173'
const apiBaseUrl = process.env.AIRMENTOR_PW_API_BASE_URL ?? 'http://127.0.0.1:4000'
const deterministicSeedNow = '2026-03-16T00:00:00Z'
const reuseExistingServer = process.env.AIRMENTOR_PW_REUSE_SERVER === '1' && !process.env.CI
const skipWebServer = process.env.AIRMENTOR_PW_SKIP_WEBSERVER === '1'
const frontendUrl = new URL(frontendBaseUrl)
const apiUrl = new URL(apiBaseUrl)
const frontendPort = frontendUrl.port || (frontendUrl.protocol === 'https:' ? '443' : '80')
const frontendAltHost = frontendUrl.hostname === '127.0.0.1'
  ? 'localhost'
  : frontendUrl.hostname === 'localhost'
    ? '127.0.0.1'
    : frontendUrl.hostname
const frontendCorsAllowedOrigins = [frontendUrl.origin, `${frontendUrl.protocol}//${frontendAltHost}:${frontendPort}`]
  .filter((value, index, values) => values.indexOf(value) === index)
  .join(',')
const webServer = skipWebServer
  ? undefined
  : [
      {
        command: `cd ${JSON.stringify(repoRoot)} && AIRMENTOR_API_PORT=${JSON.stringify(apiUrl.port || '80')} HOST=${JSON.stringify(apiUrl.hostname)} CORS_ALLOWED_ORIGINS=${JSON.stringify(frontendCorsAllowedOrigins)} node --import tsx air-mentor-api/scripts/start-seeded-server.ts`,
        url: `${apiBaseUrl}/health`,
        timeout: 180_000,
        // Fresh stacks avoid stale seeded-server truth leaking across runs.
        reuseExistingServer,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
        env: {
          AIRMENTOR_STAGE_REALIZATION_V1: '1',
          AIRMENTOR_SEED_NOW: deterministicSeedNow,
          AIRMENTOR_API_PORT: apiUrl.port || '80',
          HOST: apiUrl.hostname,
        },
      },
      {
        command: `cd ${JSON.stringify(repoRoot)} && VITE_AIRMENTOR_API_BASE_URL=/ AIRMENTOR_UI_PROXY_API_TARGET=${JSON.stringify(apiUrl.origin)} node node_modules/vite/bin/vite.js --host ${JSON.stringify(frontendUrl.hostname)} --port ${JSON.stringify(frontendPort)} --strictPort`,
        url: frontendBaseUrl,
        timeout: 120_000,
        reuseExistingServer,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
        env: {
          AIRMENTOR_STAGE_REALIZATION_V1: '1',
          AIRMENTOR_SEED_NOW: deterministicSeedNow,
          VITE_AIRMENTOR_API_BASE_URL: '/',
          AIRMENTOR_UI_PROXY_API_TARGET: apiUrl.origin,
        },
      },
    ]

export default defineConfig({
  testDir: path.join(configDir, 'specs'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(artifactsDir, 'html-report') }],
  ],
  outputDir: path.join(artifactsDir, 'test-results'),
  use: {
    baseURL: frontendBaseUrl,
    browserName: (process.env.AIRMENTOR_PW_BROWSER as 'firefox' | 'chromium' | 'webkit') ?? 'firefox',
    headless: true,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // APIRequestContext does not auto-attach Origin. The API enforces
    // CORS allow-list on unsafe methods (§app.ts onRequest hook) so
    // without this header every POST returns 403 FORBIDDEN_ORIGIN.
    extraHTTPHeaders: {
      Origin: frontendBaseUrl,
    },
  },
  webServer,
})

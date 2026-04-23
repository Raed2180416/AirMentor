import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from './support/playwright-runtime'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const artifactsDir = path.join(configDir, 'artifacts')
const frontendBaseUrl = 'http://localhost:5173'
const apiBaseUrl = 'http://127.0.0.1:4000'
const deterministicSeedNow = '2026-03-16T00:00:00Z'

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
    browserName: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'AIRMENTOR_API_PORT=4000 HOST=127.0.0.1 CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173 node --import tsx ../air-mentor-api/scripts/start-seeded-server.ts',
      url: `${apiBaseUrl}/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        AIRMENTOR_STAGE_REALIZATION_V1: '1',
        AIRMENTOR_SEED_NOW: deterministicSeedNow,
        AIRMENTOR_API_PORT: '4000',
        HOST: '127.0.0.1',
      },
    },
    {
      command: 'VITE_AIRMENTOR_API_BASE_URL=/ AIRMENTOR_UI_PROXY_API_TARGET=http://127.0.0.1:4000 node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort',
      url: frontendBaseUrl,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        AIRMENTOR_STAGE_REALIZATION_V1: '1',
        AIRMENTOR_SEED_NOW: deterministicSeedNow,
        VITE_AIRMENTOR_API_BASE_URL: '/',
        AIRMENTOR_UI_PROXY_API_TARGET: apiBaseUrl,
      },
    },
  ],
})

import { defineConfig } from 'vitest/config'

const proofRcTimeoutMs = 420000

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: process.env.AIRMENTOR_PROOF_RC === '1' ? proofRcTimeoutMs : 180000,
    fileParallelism: false,
    coverage: {
      enabled: false,
    },
  },
})

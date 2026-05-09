import { describe, expect, it } from 'vitest'
import { normalizePlaywrightRuntimeModule } from '../tests-e2e/support/playwright-runtime'

describe('playwright runtime loader', () => {
  it('unwraps CommonJS default runtime modules from explicit imports', () => {
    const runtime = {
      defineConfig: () => ({ ok: true }),
      devices: { Desktop: {} },
      expect: () => undefined,
      test: () => undefined,
    }

    expect(normalizePlaywrightRuntimeModule({ default: runtime })).toBe(runtime)
  })

  it('keeps named-export runtime modules unchanged', () => {
    const runtime = {
      defineConfig: () => ({ ok: true }),
      devices: { Desktop: {} },
      expect: () => undefined,
      test: () => undefined,
    }

    expect(normalizePlaywrightRuntimeModule(runtime)).toBe(runtime)
  })

  it('unwraps callable CommonJS default runtime modules from Nix Playwright', () => {
    const runtime = Object.assign(() => undefined, {
      defineConfig: () => ({ ok: true }),
      devices: { Desktop: {} },
      expect: () => undefined,
      test: () => undefined,
    })

    expect(normalizePlaywrightRuntimeModule({ default: runtime })).toBe(runtime)
  })
})

import { pathToFileURL } from 'node:url'
import type { defineConfig as definePlaywrightConfig, devices as playwrightDevices, expect as playwrightExpect, test as playwrightTest } from '@playwright/test'

const explicitRuntimeImport = process.env.PLAYWRIGHT_TEST_IMPORT?.trim()

type PlaywrightRuntimeModule = {
  defineConfig: typeof definePlaywrightConfig
  devices: typeof playwrightDevices
  expect: typeof playwrightExpect
  test: typeof playwrightTest
}

function isPlaywrightRuntimeModule(value: unknown): value is PlaywrightRuntimeModule {
  return !!value
    && (typeof value === 'object' || typeof value === 'function')
    && typeof (value as PlaywrightRuntimeModule).defineConfig === 'function'
    && typeof (value as PlaywrightRuntimeModule).expect === 'function'
    && typeof (value as PlaywrightRuntimeModule).test === 'function'
}

export function normalizePlaywrightRuntimeModule(value: unknown): PlaywrightRuntimeModule {
  if (isPlaywrightRuntimeModule(value)) return value
  if (value && typeof value === 'object' && isPlaywrightRuntimeModule((value as { default?: unknown }).default)) {
    return (value as { default: PlaywrightRuntimeModule }).default
  }
  throw new Error('Playwright runtime import did not expose defineConfig, expect, and test')
}

async function loadPlaywrightRuntime() {
  if (explicitRuntimeImport) {
    return normalizePlaywrightRuntimeModule(await import(pathToFileURL(explicitRuntimeImport).href))
  }

  try {
    return normalizePlaywrightRuntimeModule(await import('@playwright/test'))
  } catch (primaryError) {
    try {
      return normalizePlaywrightRuntimeModule(await import('playwright/test'))
    } catch (secondaryError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError)
      const secondaryMessage = secondaryError instanceof Error ? secondaryError.message : String(secondaryError)
      throw new Error(
        `Playwright runtime unavailable. Install @playwright/test or set PLAYWRIGHT_TEST_IMPORT. `
        + `Primary lookup failed: ${primaryMessage}. Secondary lookup failed: ${secondaryMessage}.`,
      )
    }
  }
}

const runtime = await loadPlaywrightRuntime()

export const defineConfig = runtime.defineConfig
export const devices = runtime.devices
export const expect = runtime.expect
export const test = runtime.test

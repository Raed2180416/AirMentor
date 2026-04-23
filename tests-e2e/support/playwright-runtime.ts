import { pathToFileURL } from 'node:url'

const explicitRuntimeImport = process.env.PLAYWRIGHT_TEST_IMPORT?.trim()

async function loadPlaywrightRuntime() {
  if (explicitRuntimeImport) {
    return import(pathToFileURL(explicitRuntimeImport).href)
  }

  try {
    return await import('@playwright/test')
  } catch (primaryError) {
    try {
      return await import('playwright/test')
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

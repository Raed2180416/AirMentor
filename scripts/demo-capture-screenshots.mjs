#!/usr/bin/env node
// Minimal browser screenshot capture for the college demo.
// Driven via Playwright's bundled chromium inside nix develop. Requires
// the local backend + frontend to already be running.

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const outDir = process.env.AIRMENTOR_SHOTS_DIR ?? '/home/raed/projects/air-mentor-ui/docs/demo/screenshots-2026-04-27'
const appUrl = process.env.AIRMENTOR_APP_URL ?? 'http://127.0.0.1:5173/'
await mkdir(outDir, { recursive: true })

const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? process.env.PLAYWRIGHT_BROWSERS_CHROMIUM_PATH
  ?? '/nix/store/x5vl8zfrg4bn9r5qqy7vd1vx9q8ws6a1-playwright-chromium/chrome-linux64/chrome'

const browser = await chromium.launch({
  headless: true,
  executablePath: exe,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('console', msg => {
  if (msg.type() === 'error') console.log('[browser:error]', msg.text())
})

async function shot(name) {
  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log('[shot]', file)
}

await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1500)
await shot('01-landing')

// Try to find sysadmin portal entry button on the landing
try {
  const adminLink = page.getByRole('button', { name: /admin|sysadmin|operations|manage/i }).first()
  if (await adminLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await adminLink.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(1500)
    await shot('02-portal-after-admin-tile')
  }
} catch {}

// Try to login as sysadmin if a login form is visible
try {
  const idField = page.locator('input[placeholder="sysadmin"]').first()
  const pwField = page.locator('input[type="password"]').first()
  if (await idField.isVisible({ timeout: 4000 }).catch(() => false)) {
    await idField.fill('sysadmin')
    await pwField.fill('admin1234')
    await shot('03-login-form-filled')
    await page.getByRole('button', { name: /sign in|log in|login|continue/i }).first().click({ timeout: 4000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await shot('04-after-sysadmin-login')
  } else {
    console.log('[shot] login form not found via placeholder; capturing landing only')
  }
} catch (e) {
  console.log('[shot] login attempt failed:', e?.message)
}

// Click into proof rail item if available
try {
  const proofRail = page.getByRole('button', { name: /^proof$/i }).first()
  if (await proofRail.isVisible({ timeout: 2000 }).catch(() => false)) {
    await proofRail.click()
    await page.waitForTimeout(1500)
    await shot('05-system-admin-proof-rail')
  }
  const proofControl = page.getByRole('button', { name: /proof control/i }).first()
  if (await proofControl.isVisible({ timeout: 2000 }).catch(() => false)) {
    await proofControl.click()
    await page.waitForTimeout(2500)
    await shot('06-system-admin-proof-control')
  }
} catch (e) { console.log('[shot] proof nav failed:', e?.message) }

// Logout and try teacher login
try {
  const logoutButton = page.getByRole('button', { name: /^logout$/i }).first()
  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click()
    await page.waitForTimeout(1500)
    const teacherTile = page.getByRole('button', { name: /teaching|faculty|teacher/i }).first()
    if (await teacherTile.isVisible({ timeout: 2000 }).catch(() => false)) {
      await teacherTile.click()
      await page.waitForTimeout(1000)
      await shot('07-teacher-portal')
      const idField2 = page.locator('input[type="text"], input[type="email"], input[placeholder*="username" i], input[placeholder*="email" i]').first()
      const pwField2 = page.locator('input[type="password"]').first()
      if (await idField2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await idField2.fill('rohit.menon')
        await pwField2.fill('faculty1234')
        await page.getByRole('button', { name: /sign in|log in|login|continue/i }).first().click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(3000)
        await shot('08-teacher-after-login')
      }
    }
  }
} catch (e) { console.log('[shot] teacher nav failed:', e?.message) }

// Final
await shot('99-final-state')

await ctx.close()
await browser.close()
console.log('[shot] DONE')

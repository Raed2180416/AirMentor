import { expect } from '../support/playwright-runtime'
import { test } from '../fixtures/seeded-run-fixture'
import { loginAs } from '../helpers/login-as'
import fs from 'fs'

test('UI Mapping Script', async ({ page, request, seededRun }) => {
  console.log('Logging in...');
  await loginAs(page, 'course-leader')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })

  // Dashboard
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/raed/.gemini/antigravity/scratch/dashboard.png' });
  fs.writeFileSync('/home/raed/.gemini/antigravity/scratch/dashboard.html', await page.content());
  
  // Click first course
  const firstCourseCard = page.locator('div[data-surface="selected"][data-interactive="true"]').first()
  await firstCourseCard.click()
    await page.waitForTimeout(2000);
    
    // Course Hub
    await page.screenshot({ path: '/home/raed/.gemini/antigravity/scratch/course-hub.png' });
    fs.writeFileSync('/home/raed/.gemini/antigravity/scratch/course-hub.html', await page.content());

    // TT1
    await page.locator('button[data-tab="true"]:has-text("TT1")').click()
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/home/raed/.gemini/antigravity/scratch/tt1-builder.png' });
    fs.writeFileSync('/home/raed/.gemini/antigravity/scratch/tt1-builder.html', await page.content());

    // Proceed to Entry
    const proceedBtn = page.locator('text=Proceed to TT1 Entry')
    if (await proceedBtn.isVisible()) {
      await proceedBtn.click()
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/home/raed/.gemini/antigravity/scratch/tt1-entry.png', fullPage: true });
      fs.writeFileSync('/home/raed/.gemini/antigravity/scratch/tt1-entry.html', await page.content());
    }

  console.log('UI Mapping Complete!');
})

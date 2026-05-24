import { expect } from '../support/playwright-runtime'
import { test } from '../fixtures/seeded-run-fixture'
import { loginAs } from '../helpers/login-as'

test.describe('Role Parity and UI Audit', () => {

  test('Course Leader: Calendar, AllStudents, StudentHistory', async ({ page, seededRun }) => {
    // 1. Course Leader login
    await loginAs(page, 'course-leader')
    await page.goto((process.env.AIRMENTOR_PW_FRONTEND_BASE_URL || 'http://127.0.0.1:5173') + '/#/app', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Verify Dashboard loads
    await expect(page.locator('text=Course Leader Dashboard').first()).toBeVisible({ timeout: 10000 })

    // Click "Total Students" card to go to AllStudentsPage
    const totalStudentsCard = page.locator('text=Total Students').first()
    await totalStudentsCard.click()
    await page.waitForTimeout(1000)
    
    // Verify AllStudentsPage loads
    await expect(page.locator('text=All Students').first()).toBeVisible()

    // Test Filtering & Risk Sorting
    // Filter by High Risk
    await page.locator('select[aria-label="Filter by risk"]').selectOption('High')
    await page.waitForTimeout(500)

    // History button
    await page.locator('button:has-text("History")').first().click()
    await page.waitForTimeout(1000)

    // Verify StudentHistoryPage loads
    await expect(page.locator('text=Student History').first()).toBeVisible()
    
    // Navigate back to Dashboard to test Calendar
    // Click PageBackButton
    await page.locator('button[aria-label="Go back"]').first().click()
    await page.waitForTimeout(1000)
    
    // Actually we can just click Calendar / Timetable in the sidebar
    await page.locator('button', { hasText: 'Calendar / Timetable' }).first().click()
    await page.waitForTimeout(1000)

    // Verify Calendar loads
    await expect(page.locator('text=My Calendar').first()).toBeVisible()
  })

  test('Mentor: MentorView dashboard and MenteeDetailPage', async ({ page, seededRun }) => {
    await loginAs(page, 'mentor')
    await page.goto((process.env.AIRMENTOR_PW_FRONTEND_BASE_URL || 'http://127.0.0.1:5173') + '/#/app', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    
    // Verify MentorView dashboard loads
    await expect(page.locator('text=Mentor Dashboard').first()).toBeVisible({ timeout: 10000 })

    // Mentor Dashboard shows a list of mentees, test sorting by AVS
    // We need to click on a mentee to see MenteeDetailPage
    await page.locator('div', { hasText: 'Aggregate Vulnerability' }).first().click()
    await page.waitForTimeout(1000)

    // Verify MenteeDetailPage loads
    await expect(page.locator('text=Risk Explorer').first()).toBeVisible()
  })

  test('HoD: HodView Dashboard and Counterfactual Panel', async ({ page, seededRun }) => {
    await loginAs(page, 'hod')
    await page.goto((process.env.AIRMENTOR_PW_FRONTEND_BASE_URL || 'http://127.0.0.1:5173') + '/#/app', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    
    // Verify HoD Dashboard loads
    await expect(page.locator('text=Department Oversight').first()).toBeVisible({ timeout: 10000 })

    // Click on Counterfactual Impact tab
    await page.locator('button:has-text("Counterfactual Impact")').first().click()
    await page.waitForTimeout(1000)

    // Verify Counterfactual panel loads
    await expect(page.locator('text=Counterfactual Analysis').first()).toBeVisible()
  })
})

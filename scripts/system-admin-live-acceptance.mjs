import assert from 'node:assert/strict'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sanitizeArtifactPrefix } from './proof-risk-semester-walk.mjs'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'
const acceptanceArtifactPrefix = sanitizeArtifactPrefix((process.env.AIRMENTOR_ACCEPTANCE_ARTIFACT_PREFIX ?? '').trim())

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-live-acceptance.png')
const failureScreenshot = path.join(outputDir, 'system-admin-live-acceptance-failure.png')
const successReport = path.join(outputDir, 'system-admin-live-acceptance-report.json')
const failureReport = path.join(outputDir, 'system-admin-live-acceptance-failure.json')
const report = {
  generatedAt: new Date().toISOString(),
  appUrl,
  artifacts: {
    successScreenshot,
    successReport,
    failureScreenshot,
    failureReport,
    prefixedSuccessScreenshot: buildPrefixedArtifactPath(successScreenshot),
    prefixedSuccessReport: buildPrefixedArtifactPath(successReport),
    prefixedFailureScreenshot: buildPrefixedArtifactPath(failureScreenshot),
    prefixedFailureReport: buildPrefixedArtifactPath(failureReport),
  },
  checks: [],
}
const pageErrors = []
const consoleMessages = []
const deployedWorkspaceNeedles = [
  'Academic Bands',
  'Save Scope Governance',
  'Reset To Inherited Policy',
  'Resolved grade bands for',
]
const adminOverviewMarkers = [
  'Operations Dashboard',
  'MNC Proof Operations',
  'Sysadmin Control Plane',
]
const systemAdminCredentials = resolveSystemAdminLiveCredentials({
  scriptLabel: 'System admin live acceptance flow',
})

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })
page.on('pageerror', error => {
  pageErrors.push({ name: error.name, message: error.message })
  if (pageErrors.length > 20) pageErrors.shift()
})
page.on('console', message => {
  consoleMessages.push({ type: message.type(), text: message.text() })
  if (consoleMessages.length > 20) consoleMessages.shift()
})

function buildPrefixedArtifactPath(rawPath) {
  if (!acceptanceArtifactPrefix) return null
  return path.join(path.dirname(rawPath), `${acceptanceArtifactPrefix}-${path.basename(rawPath)}`)
}

async function copyPrefixedArtifact(rawPath) {
  const prefixedPath = buildPrefixedArtifactPath(rawPath)
  if (!prefixedPath) return null
  await copyFile(rawPath, prefixedPath)
  return prefixedPath
}

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: 20_000 })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function expectFlash(message) {
  await expectVisible(page.getByText(message, { exact: true }), `flash "${message}"`)
}

async function expectBodyText(text, description) {
  await page.waitForFunction((value) => {
    const normalize = source => String(source ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    return normalize(document.body.innerText).includes(normalize(value))
  }, text, { timeout: 20_000 })
  assert.ok(true, `${description} should be present`)
}

async function expectBodyTextOneOf(values, description) {
  await page.waitForFunction((candidates) => {
    const normalize = source => String(source ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    const bodyText = normalize(document.body.innerText)
    return candidates.some(value => bodyText.includes(normalize(value)))
  }, values, { timeout: 20_000 })
  assert.ok(true, `${description} should be present`)
}

function deriveCurrentYearLabel(currentSemester) {
  const semesterNumber = Number(currentSemester)
  if (!Number.isFinite(semesterNumber) || semesterNumber <= 0) return `Semester ${currentSemester}`
  const yearNumber = Math.ceil(semesterNumber / 2)
  if (yearNumber === 1) return '1st Year'
  if (yearNumber === 2) return '2nd Year'
  if (yearNumber === 3) return '3rd Year'
  return `${yearNumber}th Year`
}

async function resetWorkspaceIfVisible() {
  const resetButton = page.getByRole('button', { name: 'Reset workspace', exact: true })
  if (!await resetButton.isVisible().catch(() => false)) return false
  await resetButton.click()
  await page.waitForFunction(() => !document.body.innerText.includes('Faculties workspace restored'), { timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(300)
  return true
}

async function collectWorkspaceDiagnostics(tabName, expectedTexts) {
  return page.evaluate(({ activeTabName, texts }) => {
    const bodyText = document.body.innerText
    const activeTab = Array.from(document.querySelectorAll('[role="tab"]')).find(candidate => candidate.getAttribute('aria-selected') === 'true')
    return {
      activeTabName,
      activeTabLabel: activeTab?.textContent?.trim() ?? null,
      expectedTexts: texts,
      bodyContains: Object.fromEntries(texts.map(text => [text, bodyText.includes(text)])),
      hasPickAYear: bodyText.includes('Pick A Year'),
      hasAcademicBands: bodyText.includes('Academic Bands'),
      hasSaveScopeGovernance: bodyText.includes('Save Scope Governance'),
      hasResetToInheritedPolicy: bodyText.includes('Reset To Inherited Policy'),
      restoreNoticeVisible: bodyText.includes('Faculties workspace restored'),
      bodyPreview: bodyText.slice(0, 3000),
    }
  }, { activeTabName: tabName, texts: expectedTexts })
}

async function collectLoadedAssetStringCounts() {
  const scriptUrls = await page.evaluate(() => (
    Array.from(new Set(
      performance
        .getEntriesByType('resource')
        .map(entry => entry.name)
        .filter(name => /\.js(?:$|\?)/.test(name)),
    ))
  ))
  const assetCounts = []
  for (const scriptUrl of scriptUrls) {
    try {
      const response = await fetch(scriptUrl)
      const assetText = response.ok ? await response.text() : ''
      assetCounts.push({
        scriptUrl,
        counts: Object.fromEntries(deployedWorkspaceNeedles.map(needle => [needle, assetText.split(needle).length - 1])),
      })
    } catch (error) {
      assetCounts.push({
        scriptUrl,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return assetCounts
}

function toCheckName(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function expectWorkspaceTab(tabName, tabId, expectedTexts, reportName = `workspace-tab-${toCheckName(tabName)}`) {
  const tablist = page.getByRole('tablist', { name: 'Hierarchy workspace sections' })
  await expectVisible(tablist, 'workspace tabs')
  const tab = tablist.getByRole('tab', { name: tabName, exact: true }).first()
  await expectVisible(tab, `${tabName} tab`)
  await tab.scrollIntoViewIfNeeded().catch(() => {})
  await tab.click()
  await page.waitForFunction((expectedTabName) => {
    return Array.from(document.querySelectorAll('[role="tab"]')).some(candidate => {
      return candidate.textContent?.trim() === expectedTabName
        && candidate.getAttribute('aria-selected') === 'true'
    })
  }, tabName, { timeout: 40_000 })
  try {
    for (const expectedText of expectedTexts) {
      const textCandidates = Array.isArray(expectedText) ? expectedText : [expectedText]
      await expectBodyTextOneOf(textCandidates, `${tabName} panel text ${textCandidates.join(' / ')}`)
    }
  } catch (error) {
    const diagnostics = await collectWorkspaceDiagnostics(tabName, expectedTexts)
    const loadedAssets = await collectLoadedAssetStringCounts()
    report.checks.push({
      name: reportName,
      status: 'failed',
      tabName,
      tabId,
      expectedTexts,
      diagnostics,
      loadedAssets,
    })
    if (tabName === 'Bands') {
      const missingExtractedControls = loadedAssets.every(asset => {
        if (!asset.counts) return false
        return asset.counts['Save Scope Governance'] === 0 && asset.counts['Reset To Inherited Policy'] === 0
      })
      if (missingExtractedControls) {
        throw new Error('Live workspace parity drift: the deployed GitHub Pages bundle does not contain the extracted Bands controls (`Save Scope Governance` / `Reset To Inherited Policy`), so 02A live acceptance cannot complete against the current deployment.')
      }
    }
    throw error
  }
  if (reportName) {
    report.checks.push({ name: reportName, status: 'passed' })
  }
}

function getDialogLocator(dialogName) {
  return dialogName instanceof RegExp
    ? page.getByRole('dialog', { name: dialogName })
    : page.getByRole('dialog', { name: dialogName, exact: true })
}

async function openHierarchyDialog(buttonName, dialogName, description) {
  const trigger = page.getByRole('button', { name: buttonName, exact: true }).first()
  const dialog = getDialogLocator(dialogName)
  return { trigger, dialog }
}

async function openHierarchyDialogField(buttonName, dialogName, description, fieldLabel) {
  const { trigger, dialog } = await openHierarchyDialog(buttonName, dialogName, description)
  const field = dialog.getByLabel(fieldLabel, { exact: true }).last()
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await expectVisible(trigger, `${description} trigger`)
    await trigger.scrollIntoViewIfNeeded().catch(() => {})
    if (attempt === 1) {
      await trigger.click()
    } else {
      await trigger.evaluate(node => {
        if (node instanceof HTMLElement) node.click()
      })
    }
    const opened = await dialog.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)
    if (opened) {
      const fieldVisible = await field.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)
      if (fieldVisible) return { dialog, field }
      await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click().catch(() => {})
    }
    await page.waitForTimeout(250)
  }
  await dialog.waitFor({ state: 'visible', timeout: 20_000 })
  await expectVisible(field, `${description} field ${fieldLabel}`)
  return { dialog, field }
}

function getHierarchySelect(scopeLabel) {
  return page.locator(`xpath=//div[./div[normalize-space()="${scopeLabel}"] and ./select]/select`).first()
}

async function selectBatchByLabelSuffix(batchLabel) {
  const batchSelect = getHierarchySelect('Year')
  const deadline = Date.now() + 40_000
  let hasOption = false
  while (!hasOption && Date.now() < deadline) {
    hasOption = await batchSelect.evaluate((select, expectedLabel) => {
      if (!(select instanceof HTMLSelectElement)) return false
      return Array.from(select.options).some(option => {
        const text = option.textContent?.trim() ?? ''
        return option.value && (text === expectedLabel || text.endsWith(`· ${expectedLabel}`))
      })
    }, batchLabel)
    if (!hasOption) await page.waitForTimeout(250)
  }
  assert(hasOption, `Expected batch option ending with ${batchLabel}`)
  const optionValue = await batchSelect.evaluate((select, expectedLabel) => {
    if (!(select instanceof HTMLSelectElement)) return null
    const option = Array.from(select.options).find(candidate => {
      const text = candidate.textContent?.trim() ?? ''
      return candidate.value && (text === expectedLabel || text.endsWith(`· ${expectedLabel}`))
    })
    return option?.value ?? null
  }, batchLabel)
  assert(optionValue, `Expected batch option ending with ${batchLabel}`)
  await batchSelect.selectOption(String(optionValue))
}

async function selectExactHierarchyLabel(scopeLabel, label, description) {
  const select = getHierarchySelect(scopeLabel)
  const deadline = Date.now() + 40_000
  let hasOption = false
  while (!hasOption && Date.now() < deadline) {
    hasOption = await select.evaluate((candidate, expectedLabel) => {
      if (!(candidate instanceof HTMLSelectElement)) return false
      return Array.from(candidate.options).some(option => {
        const text = option.textContent?.trim() ?? ''
        return text === expectedLabel
          || text.endsWith(`· ${expectedLabel}`)
          || text.includes(expectedLabel)
      })
    }, label)
    if (!hasOption) await page.waitForTimeout(250)
  }
  assert(hasOption, `Expected ${scopeLabel} option ${label}`)
  const optionValue = await select.evaluate((candidate, expectedLabel) => {
    if (!(candidate instanceof HTMLSelectElement)) return null
    const option = Array.from(candidate.options).find(item => {
      const text = item.textContent?.trim() ?? ''
      return text === expectedLabel
        || text.endsWith(`· ${expectedLabel}`)
        || text.includes(expectedLabel)
    })
    return option?.value ?? null
  }, label)
  assert(optionValue, `Expected ${scopeLabel} option value for ${label}`)
  await select.selectOption(String(optionValue))
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  await expectBodyText(label, description)
}

async function findVisibleRequestAction() {
  for (const action of ['Take Review', 'Approve', 'Mark Implemented', 'Close']) {
    const button = page.getByRole('button', { name: action, exact: true })
    if (await button.isVisible().catch(() => false)) return { action, button }
  }
  return null
}

async function advanceRequestToClosed() {
  for (let step = 0; step < 6; step += 1) {
    const closedStatus = page.getByText(/^Closed$/).first()
    if (await closedStatus.isVisible().catch(() => false)) return

    const nextAction = await findVisibleRequestAction()
    assert(nextAction, 'Expected a visible request action button before closure')

    await nextAction.button.click()
    await expectFlash('Request advanced.')
    await page.waitForFunction((previousAction) => {
      const hasClosed = Array.from(document.querySelectorAll('*')).some(node => node.textContent?.trim() === 'Closed')
      if (hasClosed) return true
      return !Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === previousAction)
    }, nextAction.action)
  }

  await expectVisible(page.getByText(/^Closed$/).first(), 'closed request status')
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Live Mode/), 'live admin login')

  await page.getByPlaceholder('sysadmin', { exact: true }).fill(systemAdminCredentials.identifier)
  await page.getByPlaceholder('••••••••', { exact: true }).fill(systemAdminCredentials.password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await expectBodyTextOneOf(adminOverviewMarkers, 'live admin overview')
  report.checks.push({ name: 'system-admin-login', status: 'passed' })
  await expectVisible(page.getByRole('textbox', { name: 'Admin search' }), 'admin search')

  await page.goto(`${appUrl}#/admin/faculties`, { waitUntil: 'networkidle' })
  await expectVisible(page.getByText(/^Academic Faculties$/).last(), 'faculties workspace')

  await expectVisible(getHierarchySelect('Faculty'), 'faculty selector')
  await expectVisible(getHierarchySelect('Department'), 'department selector')
  await expectVisible(getHierarchySelect('Branch'), 'branch selector')
  await expectVisible(getHierarchySelect('Year'), 'year selector')
  report.checks.push({ name: 'hierarchy-selectors-visible', status: 'passed' })

  await expectVisible(page.getByRole('tablist', { name: 'Hierarchy workspace sections' }), 'workspace tabs')
  await expectBodyTextOneOf(['Batch Configuration', 'Curriculum Model Inputs'], 'overview workspace content after batch save')
  await expectVisible(page.getByText('Students View', { exact: true }).first(), 'student launch card')
  await expectVisible(page.getByText('Faculty View', { exact: true }).first(), 'faculty launch card')
  report.checks.push({ name: 'workspace-overview', status: 'passed' })

  await expectWorkspaceTab('Bands', 'bands', ['Academic Bands', 'Save Scope Governance'])
  await expectWorkspaceTab('CE / SEE', 'ce-see', ['CE / SEE Split', 'Working Calendar', 'Attendance And Eligibility'])
  await expectWorkspaceTab('CGPA Formula', 'cgpa', ['CGPA And Progression', 'Progression', 'Risk Thresholds'])
  await expectWorkspaceTab('Stage Gates', 'stage', ['Stage Policy', 'Save Stage Policy'])
  await expectWorkspaceTab('Courses', 'courses', ['Terms, Curriculum, And Course Leaders', 'Academic Terms', ['Curriculum Rows', 'Curriculum Import And Rows']])
  await expectWorkspaceTab('Provision', 'provision', ['Provisioning', 'Faculty In Scope', ['Run Provisioning', 'Run Batch Provisioning']])
  report.checks.push({ name: 'hierarchy-tabs', status: 'passed' })

  await page.goto(`${appUrl}#/admin/faculties`, { waitUntil: 'networkidle' })
  if (await resetWorkspaceIfVisible()) {
    report.checks.push({ name: 'workspace-reset-after-refresh', status: 'passed' })
  }
  await expectVisible(getHierarchySelect('Faculty'), 'restored faculty selector')
  await expectVisible(getHierarchySelect('Department'), 'restored department selector')
  await expectVisible(getHierarchySelect('Branch'), 'restored branch selector')
  await expectVisible(getHierarchySelect('Year'), 'restored year selector')
  await expectWorkspaceTab('Overview', 'overview', ['Batch Configuration', 'Curriculum Model Inputs'], 'workspace-overview-refresh')
  await expectWorkspaceTab('Bands', 'bands', ['Academic Bands', 'Save Scope Governance'])
  await expectWorkspaceTab('CE / SEE', 'ce-see', ['CE / SEE Split', 'Working Calendar', 'Attendance And Eligibility'])
  await expectWorkspaceTab('CGPA Formula', 'cgpa', ['CGPA And Progression', 'Progression', 'Risk Thresholds'])
  await expectWorkspaceTab('Stage Gates', 'stage', ['Stage Policy', 'Save Stage Policy'])
  await expectWorkspaceTab('Courses', 'courses', ['Terms, Curriculum, And Course Leaders', 'Academic Terms', ['Curriculum Rows', 'Curriculum Import And Rows']])
  await expectWorkspaceTab('Provision', 'provision', ['Provisioning', 'Faculty In Scope', ['Run Provisioning', 'Run Batch Provisioning']])
  report.checks.push({ name: 'hierarchy-refresh', status: 'passed' })

  await page.goto(`${appUrl}#/admin/overview`, { waitUntil: 'networkidle' })
  await expectBodyTextOneOf(adminOverviewMarkers, 'overview before global search')
  await expectVisible(page.getByRole('textbox', { name: 'Admin search' }), 'admin search on overview')
  report.checks.push({ name: 'overview-search-ready', status: 'passed' })

  await page.goto(`${appUrl}#/admin/requests`, { waitUntil: 'networkidle' })
  await page.getByRole('button').filter({ hasText: 'Grant additional mentor mapping coverage' }).first().click()
  await advanceRequestToClosed()
  report.checks.push({ name: 'request-closeout', status: 'passed', summary: 'Grant additional mentor mapping coverage' })

  await writeFile(successReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await page.screenshot({ path: successScreenshot, fullPage: true })
  const prefixedSuccessReport = await copyPrefixedArtifact(successReport)
  const prefixedSuccessScreenshot = await copyPrefixedArtifact(successScreenshot)
  console.log(`System admin live acceptance flow passed. Screenshot: ${successScreenshot}`)
  if (prefixedSuccessReport || prefixedSuccessScreenshot) {
    console.log('Prefixed acceptance artifacts:')
    if (prefixedSuccessReport) console.log(`- report: ${prefixedSuccessReport}`)
    if (prefixedSuccessScreenshot) console.log(`- screenshot: ${prefixedSuccessScreenshot}`)
  }
} catch (error) {
  try {
    await writeFile(failureReport, `${JSON.stringify({
      ...report,
      runtime: {
        pageErrors,
        consoleMessages,
      },
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    }, null, 2)}\n`, 'utf8')
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    const prefixedFailureReport = await copyPrefixedArtifact(failureReport).catch(() => null)
    const prefixedFailureScreenshot = await copyPrefixedArtifact(failureScreenshot).catch(() => null)
    console.error(`System admin live acceptance flow failed. Screenshot: ${failureScreenshot}`)
    if (prefixedFailureReport || prefixedFailureScreenshot) {
      console.error('Prefixed acceptance failure artifacts:')
      if (prefixedFailureReport) console.error(`- report: ${prefixedFailureReport}`)
      if (prefixedFailureScreenshot) console.error(`- screenshot: ${prefixedFailureScreenshot}`)
    }
  } catch {
    // Ignore screenshot failures so the original error is preserved.
  }
  throw error
} finally {
  await browser.close()
}

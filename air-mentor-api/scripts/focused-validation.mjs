#!/usr/bin/env node
/**
 * Focused API Validation — One Offering Pipeline Test
 * Validates: mark entry -> lock -> advance -> risk recomputation -> SHAP
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const API_BASE = process.env.AIRMENTOR_API_BASE_URL ?? 'http://127.0.0.1:46765'
const RUN_ID = 'simulation_run_85e480d9-02a4-4232-8538-8bc27383d665'
const OUT_DIR = path.join(process.cwd(), 'output', 'massive-validation-2026-06-02')

let sessionId = ''
let csrfToken = ''

async function apiCall(method, endpoint, body, timeoutMs = 30000) {
  const url = `${API_BASE}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
  }
  if (csrfToken) headers['X-AirMentor-CSRF'] = csrfToken
  if (sessionId) headers['Cookie'] = `airmentor_session=${sessionId}; airmentor_csrf=${csrfToken}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const init = { method, headers, signal: controller.signal }
    if (body != null) init.body = JSON.stringify(body)

    const res = await fetch(url, init)
    clearTimeout(timeout)

    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      const s = setCookie.match(/airmentor_session=([^;]+)/)
      const c = setCookie.match(/airmentor_csrf=([^;]+)/)
      if (s) sessionId = s[1]
      if (c) csrfToken = c[1]
    }

    const text = await res.text()
    if (!res.ok) {
      throw new Error(`${method} ${endpoint} failed ${res.status}: ${text.slice(0, 800)}`)
    }
    return text ? JSON.parse(text) : null
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

async function login(identifier, password) {
  const session = await apiCall('POST', '/api/session/login', { identifier, password })
  sessionId = session.sessionId
  csrfToken = session.csrfToken
  return session
}

const issues = []
const logs = []

function log(msg) {
  console.log(msg)
  logs.push(msg)
}

function issue(severity, phase, description, extra = '') {
  issues.push({ severity, phase, description, extra })
  log(`[${severity}] ${phase}: ${description}${extra ? ' ' + extra : ''}`)
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  ensureDir(OUT_DIR)

  log('═══════════════════════════════════════════════════════════')
  log('  FOCUSED VALIDATION: Offering mnc_s1_amc_s1_02_a')
  log('  Run: ' + RUN_ID)
  log('═══════════════════════════════════════════════════════════\n')

  // Login as sysadmin
  await login('sysadmin', 'admin1234')
  log('Logged in as sysadmin')

  // Read checkpoints
  const checkpoints = await apiCall('GET', `/api/admin/proof-runs/${encodeURIComponent(RUN_ID)}/checkpoints`, undefined, 30000)
  const preTt1 = checkpoints.items?.find(c => String(c.stageKey).toLowerCase() === 'pre-tt1')
  const postTt1 = checkpoints.items?.find(c => String(c.stageKey).toLowerCase() === 'post-tt1')
  if (!preTt1 || !postTt1) throw new Error('Missing checkpoints')
  log(`pre-TT1: ${preTt1.simulationStageCheckpointId}`)
  log(`post-TT1: ${postTt1.simulationStageCheckpointId}`)

  // Read bootstrap as CL to find offerings for this CL
  await login('rohit.menon', 'faculty1234')
  const bootstrap = await apiCall('GET', '/api/academic/bootstrap', undefined, 30000)
  const facultyRecord = (bootstrap.faculty || []).find(f => f.username === 'rohit.menon')
  const myOfferingIds = facultyRecord?.offeringIds || []
  const myOfferings = (bootstrap.offerings || []).filter(o => myOfferingIds.includes(o.offId))
  log(`My offerings: ${myOfferings.map(o => o.offId).join(', ')}`)

  const targetOffering = myOfferings[0]?.offId
  if (!targetOffering) throw new Error('No offering found for rohit.menon')
  log(`Target offering: ${targetOffering}`)

  // Get students in this offering from student roster (extract raw studentId from prefixed id)
  const studentsInOffering = (bootstrap.studentsByOffering?.[targetOffering] || []).map(s => {
    const rawId = String(s.id)
    return rawId.includes('::') ? rawId.split('::')[1] : rawId
  })
  log(`Students in offering: ${studentsInOffering.length}`)

  // Get TT1 components
  const tt1Nodes = bootstrap.questionPapersByOffering?.[targetOffering]?.tt1?.nodes ?? []
  const leaves = []
  function extractLeaves(nodes) {
    for (const n of nodes) {
      if (Array.isArray(n.children) && n.children.length > 0) extractLeaves(n.children)
      else leaves.push({ id: String(n.id), maxScore: Number(n.maxMarks ?? 5) })
    }
  }
  extractLeaves(tt1Nodes)
  if (leaves.length === 0) {
    leaves.push(
      { id: 'tt1-q1-p1', maxScore: 5 },
      { id: 'tt1-q1-p2', maxScore: 5 },
      { id: 'tt1-q2-p1', maxScore: 5 },
      { id: 'tt1-q2-p2', maxScore: 5 },
      { id: 'tt1-q3-p1', maxScore: 5 },
    )
  }
  log(`TT1 components: ${leaves.length}`)

  // Generate realistic marks: ~80 medium, ~20 high, ~20 low
  const entries = []
  let highCount = 0, mediumCount = 0, lowCount = 0
  for (const studentId of studentsInOffering) {
    const rand = Math.random()
    let mark
    if (rand < 0.167) { mark = Math.floor(Math.random() * 6) + 20; highCount++ }
    else if (rand < 0.833) { mark = Math.floor(Math.random() * 7) + 14; mediumCount++ }
    else { mark = Math.floor(Math.random() * 14); lowCount++ }

    const totalPct = mark / 25
    const components = leaves.map(leaf => ({
      componentCode: leaf.id,
      score: Math.round(leaf.maxScore * totalPct),
      maxScore: leaf.maxScore,
    }))
    entries.push({ studentId, components })
  }
  log(`Mark distribution: high=${highCount}, medium=${mediumCount}, low=${lowCount}`)

  // Clear lock as HOD first, then enter marks as course leader
  log('Clearing lock as sysadmin (HOD role)...')
  await login('sysadmin', 'admin1234')
  await apiCall('POST', `/api/academic/offerings/${targetOffering}/assessment-entries/tt1/clear-lock`, {}, 15000)
  log('Lock cleared')

  log(`Entering TT1 marks for ${targetOffering}...`)
  await login('rohit.menon', 'faculty1234')
  await apiCall('PUT', `/api/academic/offerings/${targetOffering}/assessment-entries/tt1`, {
    evaluatedAt: '2026-03-16T02:00:00.000Z',
    entries,
  }, 60000)
  log('TT1 marks entered')

  // Advance stage as sysadmin
  log('\n═ ADVANCE TO POST-TT1 ═')
  await login('sysadmin', 'admin1234')
  const advance = await apiCall('POST', `/api/admin/proof-runs/${encodeURIComponent(RUN_ID)}/advance`, { mode: 'stage' }, 120000)
  const newStage = advance.activeStageKey ?? advance.stageKey
  log(`Advanced to: sem=${advance.activeOperationalSemester}, stage=${newStage}`)

  if (String(newStage).toLowerCase() !== 'post-tt1') {
    issue('P0', 'advance', `Expected post-tt1 but got ${newStage}`)
  }

  // Verify post-TT1 risk for students in offering
  log('\n═ POST-TT1 RISK VERIFICATION ═')
  let riskChanged = 0
  let shapPopulated = 0
  let shapEmpty = 0
  const postProjections = []

  for (const studentId of studentsInOffering) {
    try {
      const detail = await apiCall('GET', `/api/admin/proof-runs/${encodeURIComponent(RUN_ID)}/checkpoints/${encodeURIComponent(postTt1.simulationStageCheckpointId)}/students/${encodeURIComponent(studentId)}`, undefined, 10000)
      const projection = (detail.projections || []).find(p => String(p.offeringId) === targetOffering)
      const riskProb = projection?.riskProbScaled ?? null
      const riskBand = projection?.riskBand ?? null
      postProjections.push({ studentId, riskProb, riskBand })

      // Compare with pre-TT1
      const preDetail = await apiCall('GET', `/api/admin/proof-runs/${encodeURIComponent(RUN_ID)}/checkpoints/${encodeURIComponent(preTt1.simulationStageCheckpointId)}/students/${encodeURIComponent(studentId)}`, undefined, 10000)
      const preProjection = (preDetail.projections || []).find(p => String(p.offeringId) === targetOffering)
      const preRiskProb = preProjection?.riskProbScaled ?? null
      if (preRiskProb != null && riskProb != null && Math.abs(riskProb - preRiskProb) >= 0.01) {
        riskChanged++
      }

      // Check SHAP
      try {
        const params = new URLSearchParams({ simulationRunId: RUN_ID, simulationStageCheckpointId: postTt1.simulationStageCheckpointId })
        const explorer = await apiCall('GET', `/api/academic/students/${encodeURIComponent(studentId)}/risk-explorer?${params.toString()}`, undefined, 10000)
        const drivers = Array.isArray(explorer?.topDrivers) ? explorer.topDrivers : []
        if (drivers.length > 0) shapPopulated++
        else {
          shapEmpty++
          if (riskBand === 'High' || riskBand === 'Medium') {
            issue('P1', 'shap', 'Student has risk but no SHAP drivers', studentId)
          }
        }
      } catch (e) {
        issue('P2', 'shap', `Risk explorer failed: ${e.message}`, studentId)
      }
    } catch (e) {
      issue('P1', 'post-tt1', `Failed to read projection: ${e.message}`, studentId)
    }
  }

  log(`Post-TT1 read: ${postProjections.length}/${studentsInOffering.length}`)
  log(`Risk changed: ${riskChanged}/${studentsInOffering.length}`)
  log(`SHAP populated: ${shapPopulated}`)
  log(`SHAP empty: ${shapEmpty}`)

  const postBands = { High: 0, Medium: 0, Low: 0, Unknown: 0 }
  for (const p of postProjections) {
    if (p.riskBand) postBands[p.riskBand]++
    else postBands.Unknown++
  }
  log(`Post-TT1 bands: High=${postBands.High}, Medium=${postBands.Medium}, Low=${postBands.Low}, Unknown=${postBands.Unknown}`)

  if (postBands.High + postBands.Medium === 0) {
    issue('P1', 'post-tt1', 'All students remain Low risk after TT1 — model may not be sensitive to mark variations')
  }

  // Report
  log('\n═══════════════════════════════════════════════════════════')
  log('  VALIDATION SUMMARY')
  log('═══════════════════════════════════════════════════════════')
  const p0 = issues.filter(i => i.severity === 'P0').length
  const p1 = issues.filter(i => i.severity === 'P1').length
  const p2 = issues.filter(i => i.severity === 'P2').length
  log(`Issues: P0=${p0}, P1=${p1}, P2=${p2}`)

  const report = {
    date: '2026-06-02',
    runId: RUN_ID,
    offering: targetOffering,
    verdict: p0 === 0 ? (p1 === 0 ? 'READY' : 'READY WITH CAVEATS') : 'NOT READY',
    issues,
    postBands,
    log: logs,
  }

  ensureDir(OUT_DIR)
  fs.writeFileSync(path.join(OUT_DIR, 'focused-validation-report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'focused-validation-log.txt'), logs.join('\n'))
  log(`Report written to: ${OUT_DIR}/`)
}

main().catch(err => {
  console.error('Validation crashed:', err)
  process.exit(1)
})

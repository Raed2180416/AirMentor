#!/usr/bin/env node
/**
 * Massive E2E Validation Script — API-Based Phase
 * Uses the already-active proof run to validate risk analysis.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const API_BASE = process.env.AIRMENTOR_API_BASE_URL ?? 'http://127.0.0.1:46765'
const BATCH_ID = 'batch_branch_mnc_btech_2023'
const RUN_ID = 'simulation_run_c0ea7219-c866-4e5b-935a-3a66880a5b9d'
const OUT_DIR = path.join(process.cwd(), 'output', 'massive-validation-2026-06-02')

const STUDENT_IDS = Array.from({ length: 120 }, (_, i) => 'mnc_student_' + String(i + 1).padStart(3, '0'))
const OFFERING_A = 'mnc_s1_amc_s1_02_a'
const OFFERING_B = 'mnc_s1_amc_s1_02_b'
const SPECIAL_STUDENT_IDS = [
  'mnc_student_007', 'mnc_student_023', 'mnc_student_045',
  'mnc_student_062', 'mnc_student_078', 'mnc_student_089',
  'mnc_student_095', 'mnc_student_104', 'mnc_student_111', 'mnc_student_118',
]

function offeringForStudent(studentId) {
  return Number(studentId.slice(-3)) <= 60 ? OFFERING_A : OFFERING_B
}

// ─── Cookie jar ───────────────────────────────────────────
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
      const sessionMatch = setCookie.match(/airmentor_session=([^;]+)/)
      const csrfMatch = setCookie.match(/airmentor_csrf=([^;]+)/)
      if (sessionMatch) sessionId = sessionMatch[1]
      if (csrfMatch) csrfToken = csrfMatch[1]
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

// ─── Issue tracking ──────────────────────────────────────
const issues = []
const logs = []

function log(msg) {
  console.log(msg)
  logs.push(msg)
}

function issue(severity, phase, description, studentId) {
  issues.push({ severity, phase, description, studentId })
  log(`[${severity}] ${phase}: ${description}${studentId ? ` (student: ${studentId})` : ''}`)
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ─── Mark generation ─────────────────────────────────────
function generateTtMark(studentId, kind) {
  const isSpecial = SPECIAL_STUDENT_IDS.includes(studentId)
  if (!isSpecial) {
    const rand = Math.random()
    if (rand < 0.167) return Math.floor(Math.random() * 6) + 20 // 20-25 (high)
    if (rand < 0.833) return Math.floor(Math.random() * 7) + 14 // 14-20 (medium)
    return Math.floor(Math.random() * 14) // 0-13 (low)
  }
  const caseNum = SPECIAL_STUDENT_IDS.indexOf(studentId) % 4 + 1
  switch (caseNum) {
    case 1: return Math.floor(Math.random() * 6) + 10 // 10-15 mediocre
    case 2: return kind === 'tt1' ? Math.floor(Math.random() * 6) + 20 : Math.floor(Math.random() * 5) + 12 // good TT1, mid TT2
    case 3: return kind === 'tt1' ? Math.floor(Math.random() * 6) + 20 : Math.floor(Math.random() * 6) + 5 // good TT1, bad TT2
    case 4: return kind === 'tt1' ? Math.floor(Math.random() * 6) + 5 : Math.floor(Math.random() * 6) + 20 // bad TT1, good TT2
  }
  return 15
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  ensureDir(OUT_DIR)

  log('═══════════════════════════════════════════════════════════')
  log('  AIRMENTOR MASSIVE E2E VALIDATION — API PHASE')
  log('  Run: ' + RUN_ID)
  log('═══════════════════════════════════════════════════════════\n')

  // ── Login ────────────────────────────────────────────────
  log('═ PHASE 0: LOGIN ═')
  await login('sysadmin', 'admin1234')
  log('Logged in as sysadmin')

  // ── Read active run checkpoints ────────────────────────
  log('\n═ PHASE 1: CHECKPOINTS ═')
  const checkpoints = await apiCall('GET', `/api/admin/proof-runs/${encodeURIComponent(RUN_ID)}/checkpoints`, undefined, 30000)
  log(`Total checkpoints: ${checkpoints.items?.length ?? 0}`)

  const preTt1 = checkpoints.items?.find(c => String(c.stageKey).toLowerCase() === 'pre-tt1')
  const postTt1 = checkpoints.items?.find(c => String(c.stageKey).toLowerCase() === 'post-tt1')
  if (!preTt1) throw new Error('Missing pre-tt1 checkpoint')
  if (!postTt1) throw new Error('Missing post-tt1 checkpoint')
  log(`pre-TT1: ${preTt1.simulationStageCheckpointId}`)
  log(`post-TT1: ${postTt1.simulationStageCheckpointId}`)

  // ── Baseline risk read (pre-TT1) ────────────────────────
  log('\n═ PHASE 2: BASELINE RISK (pre-TT1) ═')
  const baselineProjections = []
  let missingBaseline = 0

  for (const studentId of STUDENT_IDS) {
    try {
      const detail = await apiCall('GET', `/api/admin/proof-runs/${encodeURIComponent(RUN_ID)}/checkpoints/${encodeURIComponent(preTt1.simulationStageCheckpointId)}/students/${encodeURIComponent(studentId)}`, undefined, 10000)
      const offeringId = offeringForStudent(studentId)
      const projection = Array.isArray(detail.projections)
        ? detail.projections.find(p => String(p.offeringId ?? '') === offeringId)
        : null
      baselineProjections.push({
        studentId,
        riskProb: projection?.riskProbScaled ?? null,
        riskBand: projection?.riskBand ?? null,
      })
    } catch (e) {
      missingBaseline++
    }
  }
  log(`Baseline read: ${baselineProjections.length}/120, missing: ${missingBaseline}`)

  const baselineBands = { High: 0, Medium: 0, Low: 0, Unknown: 0 }
  for (const p of baselineProjections) {
    if (p.riskBand) baselineBands[p.riskBand]++
    else baselineBands.Unknown++
  }
  log(`Baseline bands: High=${baselineBands.High}, Medium=${baselineBands.Medium}, Low=${baselineBands.Low}, Unknown=${baselineBands.Unknown}`)

  if (baselineBands.Medium + baselineBands.High === 120) {
    issue('P1', 'baseline', 'All 120 students are Medium/High at pre-TT1 — static model limitation on this seed')
  }

  // ── Enter TT1 marks ─────────────────────────────────────
  log('\n═ PHASE 3: TT1 MARK ENTRY ═')

  // Get bootstrap as sysadmin to find components and course leaders
  await login('sysadmin', 'admin1234')
  const bootstrap = await apiCall('GET', '/api/academic/bootstrap', undefined, 30000)
  const offerings = bootstrap.offerings ?? []
  const offeringAInfo = offerings.find(o => o.offeringId === OFFERING_A)
  const offeringBInfo = offerings.find(o => o.offeringId === OFFERING_B)
  const clA = offeringAInfo?.courseLeader?.facultyId ?? 'rohit.menon'
  const clB = offeringBInfo?.courseLeader?.facultyId ?? 'rohit.menon'
  log(`Offering A CL: ${clA}, Offering B CL: ${clB}`)
  const tt1Nodes = bootstrap.questionPapersByOffering?.[OFFERING_A]?.tt1?.nodes ?? []

  const leaves = []
  function extractLeaves(nodes) {
    for (const n of nodes) {
      if (Array.isArray(n.children) && n.children.length > 0) extractLeaves(n.children)
      else leaves.push({ id: String(n.id), maxScore: Number(n.maxMarks ?? 5) })
    }
  }
  extractLeaves(tt1Nodes)

  if (leaves.length === 0) {
    log('No TT1 blueprint found, using default components')
    leaves.push(
      { id: 'tt1-q1-p1', maxScore: 5 },
      { id: 'tt1-q1-p2', maxScore: 5 },
      { id: 'tt1-q2-p1', maxScore: 5 },
      { id: 'tt1-q2-p2', maxScore: 5 },
      { id: 'tt1-q3-p1', maxScore: 5 },
    )
  }
  log(`TT1 components: ${leaves.length}`)

  // Generate marks
  const entries = []
  let highCount = 0, mediumCount = 0, lowCount = 0
  for (const studentId of STUDENT_IDS) {
    const mark = generateTtMark(studentId, 'tt1')
    if (mark >= 20) highCount++
    else if (mark >= 14) mediumCount++
    else lowCount++

    const totalPct = mark / 25
    const components = leaves.map(leaf => ({
      componentCode: leaf.id,
      score: Math.round(leaf.maxScore * totalPct),
      maxScore: leaf.maxScore,
    }))
    entries.push({ studentId, components })
  }
  log(`Mark distribution: high=${highCount}, medium=${mediumCount}, low=${lowCount}`)

  // Enter marks
  const entriesA = entries.filter(e => offeringForStudent(e.studentId) === OFFERING_A)
  const entriesB = entries.filter(e => offeringForStudent(e.studentId) === OFFERING_B)

  await login('rohit.menon', 'faculty1234')
  log(`Entering TT1 for offering A (${entriesA.length} students)...`)
  await apiCall('POST', `/api/academic/offerings/${OFFERING_A}/assessment-entries/tt1/clear-lock`, {}, 15000).catch(() => {})
  await apiCall('PUT', `/api/academic/offerings/${OFFERING_A}/assessment-entries/tt1`, {
    evaluatedAt: '2026-03-16T02:00:00.000Z',
    entries: entriesA,
  }, 60000)
  log('Offering A TT1 entered')

  log(`Entering TT1 for offering B (${entriesB.length} students)...`)
  await apiCall('POST', `/api/academic/offerings/${OFFERING_B}/assessment-entries/tt1/clear-lock`, {}, 15000).catch(() => {})
  await apiCall('PUT', `/api/academic/offerings/${OFFERING_B}/assessment-entries/tt1`, {
    evaluatedAt: '2026-03-16T02:00:00.000Z',
    entries: entriesB,
  }, 60000)
  log('Offering B TT1 entered')

  // ── Advance to post-TT1 ─────────────────────────────────
  log('\n═ PHASE 4: ADVANCE TO POST-TT1 ═')
  await login('sysadmin', 'admin1234')
  const advance = await apiCall('POST', `/api/admin/proof-runs/${encodeURIComponent(RUN_ID)}/advance`, { mode: 'stage' }, 120000)
  log(`Advanced to: sem=${advance.semesterNumber}, stage=${advance.stageKey}`)

  // ── Post-TT1 risk verification ──────────────────────────
  log('\n═ PHASE 5: POST-TT1 RISK VERIFICATION ═')
  const postTt1Projections = []
  let riskChanged = 0
  let shapPopulated = 0
  let shapEmpty = 0

  for (const studentId of STUDENT_IDS) {
    try {
      const detail = await apiCall('GET', `/api/admin/proof-runs/${encodeURIComponent(RUN_ID)}/checkpoints/${encodeURIComponent(postTt1.simulationStageCheckpointId)}/students/${encodeURIComponent(studentId)}`, undefined, 10000)
      const offeringId = offeringForStudent(studentId)
      const projection = Array.isArray(detail.projections)
        ? detail.projections.find(p => String(p.offeringId ?? '') === offeringId)
        : null

      const baseline = baselineProjections.find(p => p.studentId === studentId)
      const riskProb = projection?.riskProbScaled ?? null
      const riskBand = projection?.riskBand ?? null

      postTt1Projections.push({ studentId, riskProb, riskBand })

      if (baseline && baseline.riskProb != null && riskProb != null && Math.abs(riskProb - baseline.riskProb) >= 0.01) {
        riskChanged++
      }

      // Check SHAP for special students
      if (SPECIAL_STUDENT_IDS.includes(studentId)) {
        try {
          const params = new URLSearchParams({ simulationRunId: RUN_ID, simulationStageCheckpointId: postTt1.simulationStageCheckpointId })
          const explorer = await apiCall('GET', `/api/academic/students/${encodeURIComponent(studentId)}/risk-explorer?${params.toString()}`, undefined, 10000)
          const drivers = Array.isArray(explorer?.topDrivers) ? explorer.topDrivers : []
          if (drivers.length > 0) shapPopulated++
          else {
            shapEmpty++
            if (riskBand === 'High' || riskBand === 'Medium') {
              issue('P1', 'post-tt1-shap', 'Special student has risk but no SHAP drivers', studentId)
            }
          }
        } catch (e) {
          issue('P2', 'post-tt1-shap', `Risk explorer failed: ${e.message}`, studentId)
        }
      }
    } catch (e) {
      issue('P1', 'post-tt1', `Failed to read projection: ${e.message}`, studentId)
    }
  }

  log(`Post-TT1 read: ${postTt1Projections.length}/120`)
  log(`Risk changed: ${riskChanged}/120`)
  log(`SHAP populated for special: ${shapPopulated}/${SPECIAL_STUDENT_IDS.length}`)
  log(`SHAP empty for special: ${shapEmpty}/${SPECIAL_STUDENT_IDS.length}`)

  const postBands = { High: 0, Medium: 0, Low: 0, Unknown: 0 }
  for (const p of postTt1Projections) {
    if (p.riskBand) postBands[p.riskBand]++
    else postBands.Unknown++
  }
  log(`Post-TT1 bands: High=${postBands.High}, Medium=${postBands.Medium}, Low=${postBands.Low}, Unknown=${postBands.Unknown}`)

  // Verify special case directional correctness
  for (const studentId of SPECIAL_STUDENT_IDS) {
    const post = postTt1Projections.find(p => p.studentId === studentId)
    const caseNum = SPECIAL_STUDENT_IDS.indexOf(studentId) % 4 + 1
    if (!post) continue
    if (caseNum === 1 && post.riskBand === 'Low') {
      issue('P1', 'post-tt1-special', 'Case 1 (steady decliner) is Low after mediocre TT1', studentId)
    }
  }

  // ── Report ──────────────────────────────────────────────
  log('\n═══════════════════════════════════════════════════════════')
  log('  VALIDATION SUMMARY')
  log('═══════════════════════════════════════════════════════════')

  const p0Count = issues.filter(i => i.severity === 'P0').length
  const p1Count = issues.filter(i => i.severity === 'P1').length
  const p2Count = issues.filter(i => i.severity === 'P2').length
  const p3Count = issues.filter(i => i.severity === 'P3').length

  log(`Issues: P0=${p0Count}, P1=${p1Count}, P2=${p2Count}, P3=${p3Count}`)

  const report = {
    date: '2026-06-02',
    runId: RUN_ID,
    apiBase: API_BASE,
    verdict: p0Count === 0 ? (p1Count === 0 ? 'READY' : 'READY WITH CAVEATS') : 'NOT READY',
    issueSummary: { P0: p0Count, P1: p1Count, P2: p2Count, P3: p3Count },
    issues: issues.sort((a, b) => {
      const sevOrder = { P0: 0, P1: 1, P2: 2, P3: 3 }
      return sevOrder[a.severity] - sevOrder[b.severity]
    }),
    baselineBands,
    postTt1Bands,
    specialCases: SPECIAL_STUDENT_IDS.map(id => ({
      studentId: id,
      caseNum: SPECIAL_STUDENT_IDS.indexOf(id) % 4 + 1,
      baselineBand: baselineProjections.find(p => p.studentId === id)?.riskBand ?? null,
      postTt1Band: postTt1Projections.find(p => p.studentId === id)?.riskBand ?? null,
    })),
    log: logs,
  }

  ensureDir(OUT_DIR)
  fs.writeFileSync(path.join(OUT_DIR, 'api-validation-report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'api-validation-log.txt'), logs.join('\n'))

  log(`\nReport written to: ${OUT_DIR}/`)
}

main().catch(err => {
  console.error('Validation crashed:', err)
  process.exit(1)
})

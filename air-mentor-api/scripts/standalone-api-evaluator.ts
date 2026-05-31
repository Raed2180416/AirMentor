#!/usr/bin/env tsx
/**
 * Standalone API Evaluator — Direct fetch(), no Playwright
 * Uses verified endpoints from existing e2e test suite.
 * Handles cookies manually (Node fetch does not auto-persist).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const API_BASE = process.env.AIRMENTOR_API_BASE_URL ?? 'http://127.0.0.1:4000'
const FRONTEND_ORIGIN = process.env.AIRMENTOR_FRONTEND_BASE_URL ?? 'http://127.0.0.1:5173'
const BATCH_ID = 'batch_branch_mnc_btech_2023'
const CURRICULUM_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'
const DETERMINISTIC_RUN_SEED = 20260320
const OUT_DIR = path.join(process.cwd(), 'output', 'standalone-evaluation-2026-05-25')

const ROLES: Record<string, { identifier: string; password: string; roleCode: string }> = {
  'system-admin': { identifier: 'sysadmin', password: 'admin1234', roleCode: 'SYSTEM_ADMIN' },
  hod: { identifier: 'devika.shetty', password: 'faculty1234', roleCode: 'HOD' },
  'course-leader': { identifier: 'rohit.menon', password: 'faculty1234', roleCode: 'COURSE_LEADER' },
  mentor: { identifier: 'harish.bhat', password: 'faculty1234', roleCode: 'MENTOR' },
}

const DEMO_STUDENT_IDS = Array.from({ length: 120 }, (_, i) => `mnc_student_${String(i + 1).padStart(3, '0')}`)
const SPECIAL_STUDENT_IDS = DEMO_STUDENT_IDS.slice(0, 10)
const MANUAL_STUDENT_IDS = DEMO_STUDENT_IDS.slice(10, 20)
const OFFERING_A = 'mnc_s1_amc_s1_02_a'
const OFFERING_B = 'mnc_s1_amc_s1_02_b'

function offeringForStudent(studentId: string) {
  return Number(studentId.slice(-3)) <= 60 ? OFFERING_A : OFFERING_B
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ─── Cookie Jar ──────────────────────────────────────────────────

class CookieJar {
  private cookies: Map<string, string> = new Map()

  storeFromHeaders(headers: Headers) {
    // getSetCookie() returns each Set-Cookie as a separate string (Node 18.14+)
    const setCookies = (headers as any).getSetCookie?.() ?? [headers.get('set-cookie')].filter(Boolean)
    for (const raw of setCookies) {
      if (!raw) continue
      // Each raw cookie is like "name=value; Expires=...; Path=..."
      const main = raw.split(';')[0]?.trim()
      if (!main) continue
      const eqIdx = main.indexOf('=')
      if (eqIdx <= 0) continue
      const name = main.slice(0, eqIdx).trim()
      const value = main.slice(eqIdx + 1).trim()
      this.cookies.set(name, value)
    }
  }

  toHeader(): string {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ')
  }
}

// ─── API Client ──────────────────────────────────────────────────

class ApiClient {
  private jar = new CookieJar()
  private csrfToken: string | null = null

  async call(method: string, endpoint: string, body?: unknown): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Origin: FRONTEND_ORIGIN,
    }
    const cookieHeader = this.jar.toHeader()
    if (cookieHeader) headers['Cookie'] = cookieHeader
    if (this.csrfToken) headers['X-AirMentor-CSRF'] = this.csrfToken

    const init: RequestInit = { method, headers }
    if (body != null) init.body = JSON.stringify(body)

    const res = await fetch(url, init)
    this.jar.storeFromHeaders(res.headers)

    const text = await res.text()
    if (!res.ok) {
      throw new Error(`${method} ${endpoint} => ${res.status}: ${text.slice(0, 800)}`)
    }
    return text ? JSON.parse(text) : null
  }

  async login(role: string) {
    const actor = ROLES[role]
    if (!actor) throw new Error(`Unknown role: ${role}`)
    return this.loginByIdentifier(actor.identifier, actor.password, actor.roleCode)
  }

  async loginByIdentifier(identifier: string, password: string, targetRoleCode?: string) {
    const session = await this.call('POST', '/api/session/login', { identifier, password })
    this.csrfToken = session.csrfToken

    if (targetRoleCode && session.activeRoleGrant?.roleCode !== targetRoleCode) {
      const targetGrant = session.availableRoleGrants?.find((g: any) => g.roleCode === targetRoleCode)
      if (!targetGrant) throw new Error(`Role ${targetRoleCode} not available for ${identifier}`)
      const switched = await this.call('POST', '/api/session/role-context', { roleGrantId: targetGrant.grantId })
      this.csrfToken = switched.csrfToken
      return switched
    }
    return session
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function findCheckpoint(checkpoints: any[], semester: number, stageKey: string) {
  const cp = checkpoints.find((c: any) => c.semesterNumber === semester && String(c.stageKey).toLowerCase() === stageKey.toLowerCase())
  if (!cp) throw new Error(`Missing checkpoint sem=${semester} stage=${stageKey}`)
  return cp
}

function projEvidence(projection: any) {
  return projection?.projection?.currentEvidence ?? {}
}

function projStatus(projection: any) {
  return projection?.projection?.currentStatus ?? {}
}

async function readStudentProjection(client: ApiClient, runId: string, checkpointId: string, studentId: string) {
  const detail = await client.call('GET', `/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints/${encodeURIComponent(checkpointId)}/students/${encodeURIComponent(studentId)}`)
  const offeringId = offeringForStudent(studentId)
  const projection = Array.isArray(detail.projections)
    ? detail.projections.find((p: any) => String(p.offeringId ?? '') === offeringId)
    : null
  const evidence = projEvidence(projection)
  const status = projStatus(projection)
  return {
    studentId,
    offeringId,
    tt1Pct: evidence.tt1Pct == null ? null : Number(evidence.tt1Pct),
    tt2Pct: evidence.tt2Pct == null ? null : Number(evidence.tt2Pct),
    seePct: evidence.seePct == null ? null : Number(evidence.seePct),
    quizPct: evidence.quizPct == null ? null : Number(evidence.quizPct),
    assignmentPct: evidence.assignmentPct == null ? null : Number(evidence.assignmentPct),
    attendancePct: evidence.attendancePct == null ? null : Number(evidence.attendancePct),
    riskProbScaled: projection?.riskProbScaled == null ? null : Number(projection.riskProbScaled),
    riskBand: projection?.riskBand == null ? null : String(projection.riskBand),
    weakCoCount: evidence.weakCoCount == null ? null : Number(evidence.weakCoCount),
    coEvidenceMode: evidence.coEvidenceMode == null ? null : String(evidence.coEvidenceMode),
    recommendedAction: status.recommendedAction == null ? null : String(status.recommendedAction),
  }
}

async function readProjectionSnapshotSet(client: ApiClient, runId: string, checkpointId: string) {
  const rows: any[] = []
  for (const studentId of DEMO_STUDENT_IDS) {
    rows.push(await readStudentProjection(client, runId, checkpointId, studentId))
  }
  return rows
}

async function readRiskExplorer(client: ApiClient, studentId: string, runId: string, checkpointId: string) {
  const params = new URLSearchParams({ simulationRunId: runId, simulationStageCheckpointId: checkpointId })
  try {
    return await client.call('GET', `/api/academic/students/${encodeURIComponent(studentId)}/risk-explorer?${params.toString()}`)
  } catch {
    return null
  }
}

// ─── Main ────────────────────────────────────────────────────────

type Issue = { agent: string; severity: 'P0' | 'P1' | 'P2' | 'P3'; stage: string; description: string }

async function runEvaluation() {
  ensureDir(OUT_DIR)
  const issues: Issue[] = []
  const logEntries: string[] = []
  function log(msg: string) { console.log(msg); logEntries.push(msg) }

  log('═══════════════════════════════════════════════════════════')
  log('  STANDALONE API EVALUATOR — AirMentor Final Validation')
  log('  API: ' + API_BASE)
  log('═══════════════════════════════════════════════════════════\n')

  // ── A-1: Data Seeding Validator ───────────────────────────────
  log('═ AGENT A-1: DATA SEEDING VALIDATOR ═')

  const adminClient = new ApiClient()
  log('Logging in as system-admin...')
  await adminClient.login('system-admin')
  log('Admin logged in.')

  log('Rehydrating proof faculty credentials...')
  try {
    await adminClient.call('POST', '/api/admin/proof-sandbox/rehydrate-credentials', {})
    log('Credentials rehydrated.')
  } catch (e: any) {
    log('Rehydrate warning: ' + e.message)
  }

  log('Creating fresh proof run...')
  const createdRun = await adminClient.call('POST', `/api/admin/batches/${BATCH_ID}/proof-runs`, {
    curriculumImportVersionId: CURRICULUM_IMPORT_ID,
    seed: DETERMINISTIC_RUN_SEED,
    runLabel: `standalone-eval-${Date.now()}`,
    activate: false,
  })
  const runId = String(createdRun.simulationRunId)
  log(`Created run: ${runId}`)

  log('Waiting for materialization (up to 30 min)...')
  const materializationStart = Date.now()
  let dashboard: any = null
  while (Date.now() - materializationStart < 1_800_000) {
    dashboard = await adminClient.call('GET', `/api/admin/batches/${BATCH_ID}/proof-dashboard`)
    const runPreview = Array.isArray(dashboard.proofRuns)
      ? dashboard.proofRuns.find((c: any) => c.simulationRunId === runId)
      : null
    if (runPreview?.status === 'completed') {
      const checkpointsRes = await adminClient.call('GET', `/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints`)
      if (Array.isArray(checkpointsRes.items) && checkpointsRes.items.length > 0) {
        log(`Materialized in ${Math.round((Date.now() - materializationStart) / 1000)}s`)
        break
      }
    }
    if (runPreview?.status === 'failed') {
      issues.push({ agent: 'A-1', severity: 'P0', stage: 'setup', description: `Run ${runId} failed materialization` })
      throw new Error(`Run ${runId} failed`)
    }
    await new Promise(r => setTimeout(r, 2_500))
  }

  log('Activating run + semester 1...')
  await adminClient.call('POST', `/api/admin/proof-runs/${encodeURIComponent(runId)}/activate`, {})
  await adminClient.call('POST', `/api/admin/proof-runs/${encodeURIComponent(runId)}/activate-semester`, { semesterNumber: 1 })

  dashboard = await adminClient.call('GET', `/api/admin/batches/${BATCH_ID}/proof-dashboard`)
  const activeRun = dashboard.activeRunDetail
  const checkpoints = activeRun?.checkpoints ?? []
  log(`Active: sem=${activeRun.activeOperationalSemester}, stage=${activeRun.activeStageKey}, checkpoints=${checkpoints.length}`)

  const postTt1Checkpoint = findCheckpoint(checkpoints, 1, 'post-tt1')

  // Read baseline projections (before manual edits)
  log('Reading baseline post-TT1 projections (120 students)...')
  const baselineRows = await readProjectionSnapshotSet(adminClient, runId, postTt1Checkpoint.simulationStageCheckpointId)
  const baselineByStudentId = new Map(baselineRows.map(r => [r.studentId, r]))
  const missingBaseline = baselineRows.filter(r => r.tt1Pct == null || r.riskProbScaled == null)
  if (missingBaseline.length > 0) {
    issues.push({ agent: 'A-1', severity: 'P0', stage: 'post-tt1-baseline', description: `${missingBaseline.length} students missing baseline projection` })
  }
  log(`Baseline: ${baselineRows.length} students, ${missingBaseline.length} missing data`)

  // Manual mark entry via Course Leader
  // Dynamically discover which course leader is assigned to which offering
  const COURSE_LEADERS = ['rohit.menon', 'priya.raman', 'karan.naidu', 'sowmya.krishnan', 'abhinav.rao', 'neha.iyengar']
  let targetOfferingId: string | null = null
  let targetClClient: ApiClient | null = null
  let targetBootstrap: any = null

  for (const clIdentifier of COURSE_LEADERS) {
    const tempClient = new ApiClient()
    try {
      await tempClient.loginByIdentifier(clIdentifier, 'faculty1234', 'COURSE_LEADER')
      const bootstrap = await tempClient.call('GET', '/api/academic/bootstrap')
      const offerings = Array.isArray(bootstrap.offerings) ? bootstrap.offerings : []
      log(`  ${clIdentifier} sees ${offerings.length} offering(s): ${JSON.stringify(offerings.map((o: any) => ({ offId: o.offId ?? o.id, sem: o.sem, section: o.sectionCode ?? o.section })))}`)
      const offering = offerings.find((o: any) => o.sem === 1 && (String(o.sectionCode ?? o.section ?? '').toUpperCase() === 'A' || String(o.offId ?? o.id ?? '').includes('_a')))
      if (offering) {
        targetOfferingId = String(offering.offId ?? offering.id)
        targetClClient = tempClient
        targetBootstrap = bootstrap
        log(`Discovered offering ${targetOfferingId} for course-leader ${clIdentifier}`)
        break
      }
    } catch (e: any) {
      log(`  ${clIdentifier} probe error: ${e.message}`)
    }
  }

  if (!targetOfferingId || !targetClClient) {
    // Fallback: derive offering from student projection data
    const sampleStudent = baselineRows.find((r: any) => r.offeringId)
    if (sampleStudent?.offeringId) {
      targetOfferingId = sampleStudent.offeringId
      log(`FALLBACK: using offering ${targetOfferingId} from projection data`)
      // Try to find a CL that can access it
      for (const clIdentifier of COURSE_LEADERS) {
        const tempClient = new ApiClient()
        try {
          await tempClient.loginByIdentifier(clIdentifier, 'faculty1234', 'COURSE_LEADER')
          targetClClient = tempClient
          targetBootstrap = await tempClient.call('GET', '/api/academic/bootstrap')
          log(`FALLBACK: using course-leader ${clIdentifier}`)
          break
        } catch {}
      }
    }
    if (!targetClClient) {
      // All course leaders see empty offerings — try HOD (department-wide scope)
      log('WARNING: All course leaders see empty offerings. Trying HOD login for mark entry...')
      const hodClient = new ApiClient()
      try {
        await hodClient.login('hod')
        const hodBootstrap = await hodClient.call('GET', '/api/academic/bootstrap')
        const hodOfferings = Array.isArray(hodBootstrap.offerings) ? hodBootstrap.offerings : []
        log(`HOD sees ${hodOfferings.length} offerings: ${JSON.stringify(hodOfferings.map((o: any) => o.offId ?? o.id))}`)
        const sampleStudent = baselineRows.find((r: any) => r.offeringId)
        if (sampleStudent?.offeringId) {
          targetOfferingId = sampleStudent.offeringId
          targetClClient = hodClient
          targetBootstrap = hodBootstrap
          log(`HOD mark entry fallback: using ${targetOfferingId}`)
        }
      } catch (e: any) {
        log(`HOD fallback error: ${e.message}`)
      }
    }
    if (!targetClClient) {
      issues.push({ agent: 'A-1', severity: 'P0', stage: 'mark-entry', description: 'Could not find any course leader or HOD with Sem1 offering — mark entry blocked. All CL bootstraps returned empty offerings array.' })
      log('WARNING: Skipping mark entry — no valid faculty/offering pair found')
      targetOfferingId = null
    }
  }

  const clClient = targetClClient
  const bootstrap = targetBootstrap
  log('Course Leader logged in with valid offering.')

  const qpByOffering = bootstrap.questionPapersByOffering ?? {}
  const tt1Nodes = qpByOffering[targetOfferingId]?.tt1?.nodes ?? []
  const leaves: any[] = []
  function extractLeaves(nodes: any[]) {
    for (const n of nodes) {
      if (Array.isArray(n.children) && n.children.length > 0) extractLeaves(n.children)
      else leaves.push({ id: String(n.id), maxScore: Number(n.maxMarks ?? 5) })
    }
  }
  extractLeaves(tt1Nodes)
  if (leaves.length === 0) leaves.push({ id: 'tt1-q1-p1', maxScore: 5 }, { id: 'tt1-q1-p2', maxScore: 5 }, { id: 'tt1-q2-p1', maxScore: 5 })
  log(`Discovered ${leaves.length} TT1 leaf components for ${targetOfferingId}`)

  // Manual entries: 5 students at 20%, 5 at 100%
  const manualEntries = MANUAL_STUDENT_IDS.map((studentId, index) => {
    const pct = index < 5 ? 0.2 : 1.0
    return {
      studentId,
      components: leaves.map((leaf: any) => ({
        componentCode: leaf.id,
        score: Math.round(leaf.maxScore * pct),
        maxScore: leaf.maxScore,
      })),
    }
  })
  const expectedManualPctByStudentId = new Map(
    manualEntries.map((entry: any) => {
      const scored = entry.components.reduce((s: number, c: any) => s + c.score, 0)
      const maximum = entry.components.reduce((s: number, c: any) => s + c.maxScore, 0)
      return [entry.studentId, maximum > 0 ? Math.round((scored / maximum) * 10000) / 100 : 0]
    })
  )

  let afterRows: any[] = baselineRows
  let manualPreserved = 0, manualMismatches = 0
  let untouchedStable = 0, untouchedMismatch = 0
  let specialTouched = 0
  let manualRiskChanged = 0
  const untouchedIds = DEMO_STUDENT_IDS.filter(id => !MANUAL_STUDENT_IDS.includes(id))

  if (!targetOfferingId) {
    log('WARNING: No valid offering discovered — skipping mark entry test')
  } else {
  // Clear lock if exists, then enter marks
  try { await clClient.call('POST', `/api/academic/offerings/${targetOfferingId}/assessment-entries/tt1/clear-lock`, {}) } catch {}
  await clClient.call('PUT', `/api/academic/offerings/${targetOfferingId}/assessment-entries/tt1`, {
    evaluatedAt: '2026-03-16T02:00:00.000Z',
    entries: manualEntries,
  })
  log('Manual marks entered.')

  // Advance stage via API (simulates Proof Control Button)
  log('Advancing stage via admin API...')
  const advanceResult = await adminClient.call('POST', `/api/admin/proof-runs/${encodeURIComponent(runId)}/advance`, { mode: 'stage' })
  if (String(advanceResult.activeStageKey).toLowerCase() !== 'post-tt1') {
    issues.push({ agent: 'A-1', severity: 'P0', stage: 'advance', description: `Advance did not reach post-tt1, got ${advanceResult.activeStageKey}` })
  } else {
    log('Stage advanced to post-tt1.')
  }

  // Read post-advance projections
  log('Reading post-advance projections...')
  afterRows = await readProjectionSnapshotSet(adminClient, runId, postTt1Checkpoint.simulationStageCheckpointId)
  const afterByStudentId = new Map(afterRows.map(r => [r.studentId, r]))

  // Verify manual preservation
  manualPreserved = 0; manualMismatches = 0
  for (const [studentId, expectedPct] of Array.from(expectedManualPctByStudentId.entries())) {
    const after = afterByStudentId.get(studentId)
    if (!after) { manualMismatches++; continue }
    if (Math.abs(Number(after.tt1Pct) - expectedPct) <= 0.01) manualPreserved++
    else {
      manualMismatches++
      issues.push({ agent: 'A-1', severity: 'P0', stage: 'post-tt1', description: `Manual NOT preserved: ${studentId} expected ${expectedPct}%, got ${after.tt1Pct}%` })
    }
  }
  log(`Manual preservation: ${manualPreserved}/${MANUAL_STUDENT_IDS.length} preserved, ${manualMismatches} mismatches`)

  // Verify untouched stability
  untouchedStable = 0; untouchedMismatch = 0
  for (const studentId of untouchedIds) {
    const before = baselineByStudentId.get(studentId)
    const after = afterByStudentId.get(studentId)
    if (!before || !after) continue
    if (Math.abs(Number(after.tt1Pct) - Number(before.tt1Pct)) <= 0.01) untouchedStable++
    else {
      untouchedMismatch++
      if (untouchedMismatch <= 3) {
        issues.push({ agent: 'A-1', severity: 'P1', stage: 'post-tt1', description: `Untouched ${studentId} diverged: ${before.tt1Pct} -> ${after.tt1Pct}` })
      }
    }
  }
  log(`Untouched stability: ${untouchedStable}/${untouchedIds.length} stable, ${untouchedMismatch} mismatches`)

  // Verify special students untouched
  specialTouched = 0
  for (const studentId of SPECIAL_STUDENT_IDS) {
    const before = baselineByStudentId.get(studentId)
    const after = afterByStudentId.get(studentId)
    if (!before || !after) continue
    if (Math.abs(Number(after.tt1Pct) - Number(before.tt1Pct)) > 0.01) {
      specialTouched++
      issues.push({ agent: 'A-1', severity: 'P1', stage: 'post-tt1', description: `Special ${studentId} changed unexpectedly` })
    }
  }
  log(`Special touched: ${specialTouched}/${SPECIAL_STUDENT_IDS.length}`)

  // Verify risk recomputed for manual entries
  manualRiskChanged = 0
  for (const studentId of MANUAL_STUDENT_IDS) {
    const before = baselineByStudentId.get(studentId)
    const after = afterByStudentId.get(studentId)
    if (before?.riskProbScaled != null && after?.riskProbScaled != null) {
      if (Math.abs(after.riskProbScaled - before.riskProbScaled) >= 0.01) manualRiskChanged++
    }
  }
  log(`Manual entries with risk delta >= 1: ${manualRiskChanged}/${MANUAL_STUDENT_IDS.length}`)
  if (manualRiskChanged < 6) {
    issues.push({ agent: 'A-2', severity: 'P1', stage: 'post-tt1', description: `Only ${manualRiskChanged} manual entries showed risk movement (expected >= 6)` })
  }
  }

  // ── A-2: ML Risk Analyst ──────────────────────────────────────
  log('\n═ AGENT A-2: ML RISK ANALYST ═')
  log('Analyzing SHAP for 10 special-case students...')

  const shapEvidence: any[] = []
  let shapPopulated = 0
  for (const studentId of SPECIAL_STUDENT_IDS) {
    const explorer = await readRiskExplorer(adminClient, studentId, runId, postTt1Checkpoint.simulationStageCheckpointId)
    const topDrivers = Array.isArray(explorer?.topDrivers) ? explorer.topDrivers : []
    const currentEvidence = explorer?.currentEvidence ?? {}

    shapEvidence.push({
      studentId,
      driverCount: topDrivers.length,
      drivers: topDrivers.slice(0, 5),
      modelProvenance: explorer?.modelProvenance,
      trainedRiskHeads: explorer?.trainedRiskHeads,
      currentEvidence,
    })

    if (topDrivers.length > 0) shapPopulated++
    else {
      const hasRiskSignal = Number(currentEvidence.tt1Pct ?? 100) < 60 || Number(currentEvidence.attendancePct ?? 100) < 75 || Number(currentEvidence.weakCoCount ?? 0) > 0
      if (hasRiskSignal) {
        issues.push({ agent: 'A-2', severity: 'P1', stage: 'post-tt1', description: `${studentId} has risk signals but zero SHAP drivers` })
      }
    }
  }
  log(`SHAP populated: ${shapPopulated}/${SPECIAL_STUDENT_IDS.length}`)

  // Verify XGBoost provenance
  const xgboostProvenance = shapEvidence.filter(e =>
    e.modelProvenance?.overallCourseRisk?.modelFamily === 'xgboost' ||
    e.trainedRiskHeads?.overallCourseRisk?.modelFamily === 'xgboost'
  )
  log(`XGBoost provenance: ${xgboostProvenance.length}/${SPECIAL_STUDENT_IDS.length}`)
  if (xgboostProvenance.length === 0) {
    issues.push({ agent: 'A-2', severity: 'P0', stage: 'post-tt1', description: 'No XGBoost provenance found — silent fallback to logistic suspected' })
  }

  // ── A-3: Role-View Auditor ────────────────────────────────────
  log('\n═ AGENT A-3: ROLE-VIEW AUDITOR ═')

  const hodClient = new ApiClient()
  await hodClient.login('hod')
  const mentorClient = new ApiClient()
  await mentorClient.login('mentor')

  const sampleIds = [DEMO_STUDENT_IDS[0], DEMO_STUDENT_IDS[30], DEMO_STUDENT_IDS[60], DEMO_STUDENT_IDS[90], DEMO_STUDENT_IDS[119]]
  let roleParityPass = 0, roleParityFail = 0
  for (const studentId of sampleIds) {
    const adminDetail = await adminClient.call('GET', `/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints/${encodeURIComponent(postTt1Checkpoint.simulationStageCheckpointId)}/students/${encodeURIComponent(studentId)}`)
    const hodDetail = await hodClient.call('GET', `/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints/${encodeURIComponent(postTt1Checkpoint.simulationStageCheckpointId)}/students/${encodeURIComponent(studentId)}`)

    const adminProj = adminDetail.projections?.find((p: any) => String(p.offeringId ?? '') === offeringForStudent(studentId))
    const hodProj = hodDetail.projections?.find((p: any) => String(p.offeringId ?? '') === offeringForStudent(studentId))

    const aRisk = adminProj?.riskProbScaled ?? null
    const hRisk = hodProj?.riskProbScaled ?? null
    if (aRisk != null && hRisk != null && Math.abs(Number(aRisk) - Number(hRisk)) < 0.001) {
      roleParityPass++
    } else {
      roleParityFail++
      issues.push({ agent: 'A-3', severity: 'P0', stage: 'post-tt1', description: `Role parity fail ${studentId}: admin=${aRisk}, hod=${hRisk}` })
    }
  }
  log(`Role parity: ${roleParityPass}/${sampleIds.length} pass, ${roleParityFail} fail`)

  // ── A-4: Intervention & Queue ─────────────────────────────────
  log('\n═ AGENT A-4: INTERVENTION & QUEUE AUDITOR ═')
  const highRiskStudents = afterRows.filter((r: any) => r.riskBand === 'High')
  log(`High-risk students: ${highRiskStudents.length}`)
  if (highRiskStudents.length === 0) {
    issues.push({ agent: 'A-4', severity: 'P1', stage: 'post-tt1', description: 'Zero high-risk students — action queue would be empty' })
  }

  // ── Semester 3 Rollback ───────────────────────────────────────
  log('\n═ SEMESTER 3 ROLLBACK TEST ═')
  let currentDashboard = await adminClient.call('GET', `/api/admin/batches/${BATCH_ID}/proof-dashboard`)
  let attempts = 0
  while (attempts < 40) {
    const active = currentDashboard.activeRunDetail
    if (active?.activeOperationalSemester === 3 && String(active.activeStageKey).toLowerCase() === 'post-tt1') break
    await adminClient.call('POST', `/api/admin/proof-runs/${encodeURIComponent(runId)}/advance`, { mode: 'stage' })
    currentDashboard = await adminClient.call('GET', `/api/admin/batches/${BATCH_ID}/proof-dashboard`)
    attempts++
  }

  const sem3Active = currentDashboard.activeRunDetail
  const sem3RollbackStatus = sem3Active?.activeOperationalSemester === 3 && String(sem3Active.activeStageKey).toLowerCase() === 'post-tt1' ? 'PASS' : 'FAIL'
  log(`Sem3 rollback test: ${sem3RollbackStatus} (attempts=${attempts})`)
  if (sem3RollbackStatus === 'FAIL') {
    issues.push({ agent: 'A-1', severity: 'P0', stage: 'sem3-rollback', description: `Failed to reach Sem3 post-tt1: got sem=${sem3Active?.activeOperationalSemester} stage=${sem3Active?.activeStageKey}` })
  } else {
    const restoreResult = await adminClient.call('POST', `/api/admin/proof-runs/${encodeURIComponent(runId)}/restore-snapshot`, {})
    if (restoreResult?.simulationRunId) {
      log(`Restored to new run: ${restoreResult.simulationRunId}`)
      const restoredDashboard = await adminClient.call('GET', `/api/admin/batches/${BATCH_ID}/proof-dashboard`)
      if (restoredDashboard.activeRunDetail?.simulationRunId !== restoreResult.simulationRunId) {
        issues.push({ agent: 'A-1', severity: 'P1', stage: 'sem3-rollback', description: 'Restored run did not become active' })
      }
    } else {
      issues.push({ agent: 'A-1', severity: 'P0', stage: 'sem3-rollback', description: 'Snapshot restore returned no runId' })
    }
  }

  // ── Report ────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════════════════════')
  log('  EVALUATION COMPLETE')
  log('═══════════════════════════════════════════════════════════')

  const p0 = issues.filter(i => i.severity === 'P0').length
  const p1 = issues.filter(i => i.severity === 'P1').length
  const p2 = issues.filter(i => i.severity === 'P2').length
  const p3 = issues.filter(i => i.severity === 'P3').length
  log(`Issues: P0=${p0}, P1=${p1}, P2=${p2}, P3=${p3}`)

  const report = {
    date: '2026-05-25',
    runId,
    verdict: p0 === 0 ? (p1 === 0 ? 'READY' : 'READY WITH CAVEATS') : 'NOT READY',
    issueSummary: { P0: p0, P1: p1, P2: p2, P3: p3 },
    issues: issues.sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2, P3: 3 }
      return order[a.severity] - order[b.severity]
    }),
    metrics: {
      totalStudents: 120,
      manualPreserved: `${manualPreserved}/${MANUAL_STUDENT_IDS.length}`,
      untouchedStable: `${untouchedStable}/${untouchedIds.length}`,
      specialTouched: `${specialTouched}/${SPECIAL_STUDENT_IDS.length}`,
      manualRiskChanged: `${manualRiskChanged}/${MANUAL_STUDENT_IDS.length}`,
      shapPopulated: `${shapPopulated}/${SPECIAL_STUDENT_IDS.length}`,
      xgboostProvenance: `${xgboostProvenance.length}/${SPECIAL_STUDENT_IDS.length}`,
      roleParityPass: `${roleParityPass}/${sampleIds.length}`,
      highRiskCount: highRiskStudents.length,
      sem3Rollback: sem3RollbackStatus,
    },
    shapEvidence,
    baselineDistribution: {
      high: baselineRows.filter((r: any) => r.riskBand === 'High').length,
      medium: baselineRows.filter((r: any) => r.riskBand === 'Medium').length,
      low: baselineRows.filter((r: any) => r.riskBand === 'Low').length,
      unknown: baselineRows.filter((r: any) => !r.riskBand).length,
    },
    afterDistribution: {
      high: afterRows.filter((r: any) => r.riskBand === 'High').length,
      medium: afterRows.filter((r: any) => r.riskBand === 'Medium').length,
      low: afterRows.filter((r: any) => r.riskBand === 'Low').length,
      unknown: afterRows.filter((r: any) => !r.riskBand).length,
    },
    log: logEntries,
  }

  ensureDir(OUT_DIR)
  fs.writeFileSync(path.join(OUT_DIR, 'standalone-evaluation-report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'standalone-evaluation-log.txt'), logEntries.join('\n'))

  log(`\nReport: ${OUT_DIR}/`)
  if (p0 > 0) { log('\nP0 ISSUES — NOT READY'); process.exit(1) }
  if (p1 > 0) { log('\nP1 ISSUES — READY WITH CAVEATS') }
  else { log('\nALL CLEAR — READY') }
}

runEvaluation().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})

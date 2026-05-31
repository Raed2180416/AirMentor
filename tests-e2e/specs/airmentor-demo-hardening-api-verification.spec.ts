import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { expect } from '../support/playwright-runtime'
import { test } from '../fixtures/seeded-run-fixture'
import { apiPath } from '../helpers/api-url'
import { loginWithApiContext } from '../helpers/login-as'
import {
  csrfHeaders,
  advanceProofRunStage,
  findCheckpoint,
  readProofDashboard,
  readProofCheckpointStudentDetail,
} from '../helpers/proof-run-api'
import {
  DEMO_STUDENT_IDS,
  assertDemoTrajectoryContract,
  buildDemoTrajectoryMap,
  percentFromEntry,
  type DemoComponent,
  type DemoMarkEntry,
} from '../helpers/demo-seeding-contract'

type RequestContext = {
  get(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean; status(): number }>
  post(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean; status(): number }>
  put(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean; status(): number }>
}

type ProjectionSnapshot = {
  studentId: string
  offeringId: string
  tt1Pct: number | null
  riskProbScaled: number | null
  riskBand: string | null
  weakCoCount: number | null
  coEvidenceMode: string | null
  recommendedAction: string | null
}

const EVIDENCE_ROOT = process.env.AIRMENTOR_DEMO_HARDENING_EVIDENCE_DIR
  ?? path.join(process.cwd(), 'output/playwright/airmentor-demo-hardening-api-verification')
const JSON_DIR = path.join(EVIDENCE_ROOT, 'json')
const CSV_DIR = path.join(EVIDENCE_ROOT, 'csv')
const OFFERING_A = 'mnc_s1_amc_s1_02_a'
const OFFERING_B = 'mnc_s1_amc_s1_02_b'
const MANUAL_STUDENT_IDS = DEMO_STUDENT_IDS.slice(10, 20)
const SPECIAL_STUDENT_IDS = DEMO_STUDENT_IDS.slice(0, 10)

function responseOk(response: { ok: boolean | (() => boolean) }) {
  return typeof response.ok === 'function' ? response.ok() : response.ok
}

function jsonHeaders(csrfToken: string) {
  return {
    ...csrfHeaders(csrfToken),
    'Content-Type': 'application/json',
  }
}

function offeringForStudent(studentId: string) {
  const numeric = Number(studentId.slice(-3))
  return numeric <= 60 ? OFFERING_A : OFFERING_B
}

async function readJsonResponse(response: { text(): Promise<string>; ok: boolean | (() => boolean); status: number | (() => number) }, label: string) {
  const text = await response.text()
  if (!responseOk(response)) {
    const status = typeof response.status === 'function' ? response.status() : response.status
    throw new Error(`${label} failed with ${status}: ${text.slice(0, 800)}`)
  }
  return text ? JSON.parse(text) : null
}

async function writeJson(fileName: string, payload: unknown) {
  await fs.mkdir(JSON_DIR, { recursive: true })
  await fs.writeFile(path.join(JSON_DIR, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function writeCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  await fs.mkdir(CSV_DIR, { recursive: true })
  const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row))))
  const escape = (value: unknown) => {
    if (value == null) return ''
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n\r]/.test(text) ? `"${text.split('"').join('""')}"` : text
  }
  await fs.writeFile(path.join(CSV_DIR, fileName), `${[keys.join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\n')}\n`, 'utf8')
}

function collectBlueprintLeaves(nodes: unknown[], leaves: DemoComponent[]) {
  for (const node of nodes) {
    const record = node as Record<string, unknown>
    if (Array.isArray(record.children) && record.children.length > 0) {
      collectBlueprintLeaves(record.children, leaves)
    } else {
      leaves.push({ id: String(record.id), maxScore: Number(record.maxMarks ?? 5) })
    }
  }
}

async function getAcademicBootstrap(request: RequestContext, csrfToken: string) {
  const response = await request.get(apiPath('/api/academic/bootstrap'), {
    headers: jsonHeaders(csrfToken),
  })
  return readJsonResponse(response, 'Read academic bootstrap')
}

function discoverTt1ComponentsFromBootstrap(bootstrap: Record<string, unknown>, offeringId: string): DemoComponent[] {
  const questionPapersByOffering = bootstrap.questionPapersByOffering as Record<string, Record<string, { nodes?: unknown[] }>> | undefined
  const nodes = questionPapersByOffering?.[offeringId]?.tt1?.nodes
  if (Array.isArray(nodes)) {
    const leaves: DemoComponent[] = []
    collectBlueprintLeaves(nodes, leaves)
    if (leaves.length > 0) return leaves
  }
  return [
    { id: 'tt1-q1-p1', maxScore: 4 },
    { id: 'tt1-q1-p2', maxScore: 3 },
    { id: 'tt1-q2-p1', maxScore: 6 },
    { id: 'tt1-q3-p1', maxScore: 6 },
    { id: 'tt1-q4-p1', maxScore: 6 },
  ]
}

function projectionEvidence(projection: Record<string, unknown> | undefined) {
  const payload = projection?.projection && typeof projection.projection === 'object'
    ? projection.projection as Record<string, unknown>
    : {}
  return payload.currentEvidence && typeof payload.currentEvidence === 'object'
    ? payload.currentEvidence as Record<string, unknown>
    : {}
}

function projectionStatus(projection: Record<string, unknown> | undefined) {
  const payload = projection?.projection && typeof projection.projection === 'object'
    ? projection.projection as Record<string, unknown>
    : {}
  return payload.currentStatus && typeof payload.currentStatus === 'object'
    ? payload.currentStatus as Record<string, unknown>
    : {}
}

async function readStudentProjection(request: RequestContext, runId: string, checkpointId: string, studentId: string, csrfToken: string): Promise<ProjectionSnapshot> {
  const detail = await readProofCheckpointStudentDetail(request, runId, checkpointId, studentId, csrfToken)
  const offeringId = offeringForStudent(studentId)
  const projection = Array.isArray(detail.projections)
    ? detail.projections.find((item: Record<string, unknown>) => String(item.offeringId ?? '') === offeringId)
    : undefined
  const evidence = projectionEvidence(projection)
  const status = projectionStatus(projection)
  return {
    studentId,
    offeringId,
    tt1Pct: evidence.tt1Pct == null ? null : Number(evidence.tt1Pct),
    riskProbScaled: projection?.riskProbScaled == null ? null : Number(projection.riskProbScaled),
    riskBand: projection?.riskBand == null ? null : String(projection.riskBand),
    weakCoCount: evidence.weakCoCount == null ? null : Number(evidence.weakCoCount),
    coEvidenceMode: evidence.coEvidenceMode == null ? null : String(evidence.coEvidenceMode),
    recommendedAction: status.recommendedAction == null ? null : String(status.recommendedAction),
  }
}

async function readProjectionSnapshotSet(request: RequestContext, runId: string, checkpointId: string, csrfToken: string) {
  const rows: ProjectionSnapshot[] = []
  for (const studentId of DEMO_STUDENT_IDS) {
    rows.push(await readStudentProjection(request, runId, checkpointId, studentId, csrfToken))
  }
  return rows
}

function makeManualEntries(components: DemoComponent[]): DemoMarkEntry[] {
  return MANUAL_STUDENT_IDS.map((studentId, index) => {
    const pct = index < 5 ? 0.2 : 1
    return {
      studentId,
      components: components.map(component => ({
        componentCode: component.id,
        score: Math.round(component.maxScore * pct),
        maxScore: component.maxScore,
      })),
    }
  })
}

async function readRiskExplorer(request: RequestContext, csrfToken: string, runId: string, checkpointId: string, studentId: string) {
  const params = new URLSearchParams({ simulationRunId: runId, simulationStageCheckpointId: checkpointId })
  const response = await request.get(apiPath(`/api/academic/students/${encodeURIComponent(studentId)}/risk-explorer?${params.toString()}`), {
    headers: jsonHeaders(csrfToken),
  })
  return readJsonResponse(response, `Risk explorer ${studentId}`)
}

test.describe('AirMentor demo hardening API verification', () => {
  test.describe.configure({ timeout: 900_000 })

  test('P0 advance endpoint preserves manual TT1 marks, leaves untouched seeded rows stable, and recomputes risk', async ({ request, seededRun }) => {
    const trajectoryMap = buildDemoTrajectoryMap()
    const trajectorySummary = assertDemoTrajectoryContract(trajectoryMap)
    const { session: adminSession } = await loginWithApiContext(request, 'system-admin')
    const dashboardBefore = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
    const checkpoints = dashboardBefore.activeRunDetail?.checkpoints ?? []
    const postTt1Checkpoint = findCheckpoint(checkpoints, 1, 'post-tt1')
    expect(dashboardBefore.activeRunDetail?.activeOperationalSemester).toBe(1)
    expect(dashboardBefore.activeRunDetail?.activeStageKey).toBe('pre-tt1')

    const baselineRows = await readProjectionSnapshotSet(request, seededRun.runId, postTt1Checkpoint.simulationStageCheckpointId, adminSession.csrfToken)
    const baselineByStudentId = new Map(baselineRows.map(row => [row.studentId, row]))
    const missingBaseline = baselineRows.filter(row => row.tt1Pct == null || row.riskProbScaled == null)
    expect(missingBaseline, `Missing baseline post-TT1 projection rows: ${JSON.stringify(missingBaseline.slice(0, 5))}`).toEqual([])

    const { session: courseLeaderSession } = await loginWithApiContext(request, 'course-leader')
    const bootstrap = await getAcademicBootstrap(request, courseLeaderSession.csrfToken)
    const tt1Components = discoverTt1ComponentsFromBootstrap(bootstrap, OFFERING_A)
    const manualEntries = makeManualEntries(tt1Components)
    const expectedManualPctByStudentId = new Map(manualEntries.map(entry => [entry.studentId, percentFromEntry(entry)]))
    const marksResponse = await request.put(apiPath(`/api/academic/offerings/${OFFERING_A}/assessment-entries/tt1`), {
      headers: jsonHeaders(courseLeaderSession.csrfToken),
      data: {
        evaluatedAt: '2026-03-16T02:00:00.000Z',
        entries: manualEntries,
      },
    })
    await readJsonResponse(marksResponse, 'Manual TT1 entry')

    const { session: postEditAdminSession } = await loginWithApiContext(request, 'system-admin')
    const advanceResult = await advanceProofRunStage(request, seededRun.runId, postEditAdminSession.csrfToken)
    expect(advanceResult.activeStageKey).toBe('post-tt1')

    const afterRows = await readProjectionSnapshotSet(request, seededRun.runId, postTt1Checkpoint.simulationStageCheckpointId, postEditAdminSession.csrfToken)
    const afterByStudentId = new Map(afterRows.map(row => [row.studentId, row]))
    const comparisonRows = DEMO_STUDENT_IDS.map(studentId => {
      const before = baselineByStudentId.get(studentId)!
      const after = afterByStudentId.get(studentId)!
      const expectedManualPct = expectedManualPctByStudentId.get(studentId) ?? null
      return {
        studentId,
        offeringId: after.offeringId,
        manual: expectedManualPct != null,
        special: SPECIAL_STUDENT_IDS.includes(studentId),
        baselineTt1Pct: before.tt1Pct,
        afterTt1Pct: after.tt1Pct,
        expectedManualPct,
        baselineRiskProbScaled: before.riskProbScaled,
        afterRiskProbScaled: after.riskProbScaled,
        riskDelta: before.riskProbScaled != null && after.riskProbScaled != null ? after.riskProbScaled - before.riskProbScaled : null,
        baselineRiskBand: before.riskBand,
        afterRiskBand: after.riskBand,
        weakCoCount: after.weakCoCount,
        coEvidenceMode: after.coEvidenceMode,
        recommendedAction: after.recommendedAction,
      }
    })

    const manualMismatches = comparisonRows.filter(row => row.manual && Math.abs(Number(row.afterTt1Pct) - Number(row.expectedManualPct)) > 0.01)
    const untouchedMismatches = comparisonRows.filter(row => !row.manual && Math.abs(Number(row.afterTt1Pct) - Number(row.baselineTt1Pct)) > 0.01)
    const specialTouched = comparisonRows.filter(row => row.special && Math.abs(Number(row.afterTt1Pct) - Number(row.baselineTt1Pct)) > 0.01)
    const manualRiskChangedCount = comparisonRows.filter(row => row.manual && Number.isFinite(Number(row.riskDelta)) && Math.abs(Number(row.riskDelta)) >= 1).length
    const missingCoEvidence = comparisonRows.filter(row => row.weakCoCount == null || row.coEvidenceMode == null)

    const shapEvidence = []
    for (const studentId of SPECIAL_STUDENT_IDS) {
      const explorer = await readRiskExplorer(request, postEditAdminSession.csrfToken, seededRun.runId, postTt1Checkpoint.simulationStageCheckpointId, studentId)
      const topDrivers = Array.isArray(explorer.topDrivers) ? explorer.topDrivers : []
      const currentEvidence = explorer.currentEvidence && typeof explorer.currentEvidence === 'object'
        ? explorer.currentEvidence as Record<string, unknown>
        : {}
      shapEvidence.push({
        studentId,
        driverCount: topDrivers.length,
        drivers: topDrivers.slice(0, 5),
        modelProvenance: explorer.modelProvenance,
        trainedRiskHeads: explorer.trainedRiskHeads,
        currentEvidence,
      })
    }
    const missingExpectedDrivers = shapEvidence.filter(row => {
      const evidence = row.currentEvidence as Record<string, unknown>
      const isHighRisk = (row.trainedRiskHeads as Record<string, unknown>).currentRiskBand === 'High'
      return isHighRisk && row.driverCount === 0 && (
        Number(evidence.tt1Pct ?? 100) < 60
        || Number(evidence.attendancePct ?? 100) < 75
        || Number(evidence.weakCoCount ?? 0) > 0
      )
    })

    await writeJson('00-canonical-trajectory-contract.json', {
      runId: seededRun.runId,
      trajectorySummary,
      specialStudents: SPECIAL_STUDENT_IDS.map(studentId => trajectoryMap.get(studentId)),
      manualStudents: MANUAL_STUDENT_IDS.map(studentId => trajectoryMap.get(studentId)),
    })
    await writeJson('01-p0-api-seeding-alignment.json', {
      runId: seededRun.runId,
      checkpointId: postTt1Checkpoint.simulationStageCheckpointId,
      trajectorySummary,
      tt1Components,
      manualEntries,
      manualMismatches,
      untouchedMismatches,
      specialTouched,
      manualRiskChangedCount,
      missingCoEvidence,
      shapEvidence,
      missingExpectedDrivers,
      comparisonRows,
    })
    await writeCsv('01-p0-api-seeding-alignment.csv', comparisonRows)
    await writeJson('02-special-student-shap-risk-drivers.json', shapEvidence)

    expect(manualMismatches, `Manual TT1 entries were not preserved: ${JSON.stringify(manualMismatches.slice(0, 5))}`).toEqual([])
    expect(untouchedMismatches, `Untouched seeded students diverged after Next Stage: ${JSON.stringify(untouchedMismatches.slice(0, 5))}`).toEqual([])
    expect(specialTouched, `Special archetype students changed unexpectedly: ${JSON.stringify(specialTouched.slice(0, 5))}`).toEqual([])
    expect(manualRiskChangedCount, `Manual entries did not trigger enough visible risk movement: ${manualRiskChangedCount}`).toBeGreaterThanOrEqual(6)
    expect(missingCoEvidence, `CO evidence missing after stage advance: ${JSON.stringify(missingCoEvidence.slice(0, 5))}`).toEqual([])
    expect(missingExpectedDrivers, `Missing SHAP/driver rows where evidence has risk signals: ${JSON.stringify(missingExpectedDrivers)}`).toEqual([])
  })
})

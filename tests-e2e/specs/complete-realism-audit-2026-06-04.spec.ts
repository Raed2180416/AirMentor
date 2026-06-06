import fs from 'node:fs/promises'
import path from 'node:path'
import { test } from '../fixtures/seeded-run-fixture'
import { expect } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { pinProofPlaybackCheckpoint } from '../helpers/proof-playback'
import {
  csrfHeaders,
  findCheckpoint,
  readJson,
  readProofCheckpointDetail,
  readProofCheckpointStudentDetail,
  readProofDashboard,
} from '../helpers/proof-run-api'
import {
  getAcademicBootstrap,
  getHodBundle,
  getRiskExplorer,
  SCHEME_CONFIGS,
  setOfferingScheme,
} from '../helpers/automation-flow'

const OUTPUT_ROOT = path.join(process.cwd(), 'output/playwright/complete-realism-audit-2026-06-04')
const JSON_DIR = path.join(OUTPUT_ROOT, 'json')
const SCREENSHOT_DIR = path.join(OUTPUT_ROOT, 'screenshots')

type AnyRecord = Record<string, unknown>

type CheckpointSummary = {
  semesterNumber: number
  stageKey: string
  simulationStageCheckpointId: string
  totalStudentProjectionCount?: number
  studentCount?: number
  highRiskCount?: number
  mediumRiskCount?: number
  lowRiskCount?: number
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}
}

async function writeJson(fileName: string, payload: unknown) {
  await fs.mkdir(JSON_DIR, { recursive: true })
  await fs.writeFile(path.join(JSON_DIR, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function capture(page: { screenshot(options: { path: string; fullPage?: boolean }): Promise<Buffer> }, fileName: string, fullPage = true) {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fileName), fullPage })
}

function projectionStudentId(row: AnyRecord) {
  return String(row.studentId ?? row.student_id ?? asRecord(row.student).studentId ?? '')
}

function uniqueProjectionStudentCount(rows: AnyRecord[]) {
  return new Set(rows.map(projectionStudentId).filter(Boolean)).size
}

function projectionSemester(row: AnyRecord, fallback: number) {
  return Number(row.semesterNumber ?? row.semester_number ?? fallback)
}

function projectionStage(row: AnyRecord, fallback: string) {
  return String(row.stageKey ?? row.stage_key ?? fallback)
}

function projectionRiskBand(row: AnyRecord) {
  return String(row.currentRiskBand ?? row.riskBand ?? row.risk_band ?? asRecord(row.currentStatus).riskBand ?? '')
}

function projectionQueueState(row: AnyRecord) {
  return String(row.currentQueueState ?? row.queueState ?? row.queue_state ?? asRecord(row.currentStatus).queueState ?? '')
}

function projectionDrivers(row: AnyRecord) {
  const status = asRecord(row.currentStatus)
  const nestedProjection = asRecord(row.projection)
  const nestedStatus = asRecord(nestedProjection.currentStatus)
  return [
    ...asArray(status.observableDrivers),
    ...asArray(nestedStatus.observableDrivers),
    ...asArray(row.observableDrivers),
    ...asArray(row.topDrivers),
    ...asArray(row.drivers),
  ]
}

function selectRiskTailCheckpoint(checkpoints: CheckpointSummary[]) {
  return checkpoints
    .filter(checkpoint => Number(checkpoint.highRiskCount ?? 0) + Number(checkpoint.mediumRiskCount ?? 0) > 0)
    .sort((left, right) =>
      Number(right.highRiskCount ?? 0) - Number(left.highRiskCount ?? 0)
      || Number(right.mediumRiskCount ?? 0) - Number(left.mediumRiskCount ?? 0)
      || left.semesterNumber - right.semesterNumber
      || left.stageKey.localeCompare(right.stageKey),
    )[0] ?? null
}

function summarizeStudentTrajectories(
  checkpointRows: CheckpointSummary[],
  projectionsByCheckpoint: Map<string, AnyRecord[]>,
) {
  const byStudent = new Map<string, {
    studentId: string
    semesters: Map<number, {
      semesterNumber: number
      stages: Set<string>
      offerings: Set<string>
      riskBands: Set<string>
      queueStates: Set<string>
    }>
  }>()

  for (const checkpoint of checkpointRows) {
    const rows = projectionsByCheckpoint.get(checkpoint.simulationStageCheckpointId) ?? []
    for (const row of rows) {
      const studentId = projectionStudentId(row)
      if (!studentId) continue
      const semesterNumber = projectionSemester(row, checkpoint.semesterNumber)
      const stageKey = projectionStage(row, checkpoint.stageKey)
      const current = byStudent.get(studentId) ?? { studentId, semesters: new Map() }
      const semester = current.semesters.get(semesterNumber) ?? {
        semesterNumber,
        stages: new Set<string>(),
        offerings: new Set<string>(),
        riskBands: new Set<string>(),
        queueStates: new Set<string>(),
      }
      semester.stages.add(stageKey)
      const offeringId = String(row.offeringId ?? row.offering_id ?? '')
      if (offeringId) semester.offerings.add(offeringId)
      const riskBand = projectionRiskBand(row)
      if (riskBand) semester.riskBands.add(riskBand)
      const queueState = projectionQueueState(row)
      if (queueState) semester.queueStates.add(queueState)
      current.semesters.set(semesterNumber, semester)
      byStudent.set(studentId, current)
    }
  }

  const studentSummaries = Array.from(byStudent.values())
    .sort((left, right) => left.studentId.localeCompare(right.studentId))
    .map(student => ({
      studentId: student.studentId,
      semesterCount: student.semesters.size,
      semesters: Array.from(student.semesters.values())
        .sort((left, right) => left.semesterNumber - right.semesterNumber)
        .map(semester => ({
          semesterNumber: semester.semesterNumber,
          stageCount: semester.stages.size,
          stages: Array.from(semester.stages).sort(),
          offeringCount: semester.offerings.size,
          riskBands: Array.from(semester.riskBands).sort(),
          queueStates: Array.from(semester.queueStates).sort(),
        })),
    }))

  const missing = studentSummaries.filter(student =>
    student.semesterCount !== 6
    || student.semesters.some(semester => semester.stageCount !== 5),
  )

  return {
    studentCount: studentSummaries.length,
    expectedStudentCount: 120,
    expectedSemesterCount: 6,
    expectedStageCountPerSemester: 5,
    missingCompleteSemStageCoverage: missing,
    students: studentSummaries,
  }
}

function riskTupleFromStatus(status: AnyRecord) {
  return {
    riskBand: status.riskBand ?? null,
    riskProbScaled: status.riskProbScaled ?? null,
    queueState: status.queueState ?? null,
    recommendedAction: status.recommendedAction ?? null,
  }
}

async function readStudentAgentCard(
  request: {
    get(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok: boolean | (() => boolean); status: number | (() => number) }>
  },
  csrfToken: string,
  studentId: string,
  runId: string | null,
  checkpointId: string,
) {
  const params = new URLSearchParams()
  if (runId) params.set('simulationRunId', runId)
  params.set('simulationStageCheckpointId', checkpointId)
  const response = await request.get(apiPath(`/api/academic/student-shell/students/${encodeURIComponent(studentId)}/card?${params.toString()}`), {
    headers: csrfHeaders(csrfToken),
  })
  return readJson(response, `Read student-agent card for ${studentId}`)
}

test('complete realism audit: backend coverage, coursework variants, role surfaces, and student-card parity', async ({ browserName, page, request, seededRun }) => {
  test.setTimeout(900_000)
  expect(browserName, 'Complete realism browser proof must run in Firefox unless explicitly relabeled.').toBe('firefox')
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true })
  await fs.mkdir(JSON_DIR, { recursive: true })
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true })

  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const { session: adminSession } = await loginWithApiContext(request, 'system-admin')
  const dashboard = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
  expect(dashboard.activeRunDetail?.simulationRunId).toBe(seededRun.runId)
  const checkpoints = asArray<CheckpointSummary>(dashboard.activeRunDetail?.checkpoints)
  expect(checkpoints.length).toBe(30)

  const projectionsByCheckpoint = new Map<string, AnyRecord[]>()
  const coverageRows: AnyRecord[] = []
  let totalProjectionRows = 0
  let totalDriverlessHighRows = 0
  for (const checkpoint of checkpoints) {
    const detail = await readProofCheckpointDetail(
      request,
      seededRun.runId,
      checkpoint.simulationStageCheckpointId,
      adminSession.csrfToken,
    )
    const checkpointProjectionRows = asArray<AnyRecord>(detail.projections)
    if (checkpointProjectionRows.length > 0) {
      projectionsByCheckpoint.set(checkpoint.simulationStageCheckpointId, checkpointProjectionRows)
    }
    const studentCount = Number(checkpoint.studentCount ?? 0)
    const projectionRowCount = Number(checkpoint.totalStudentProjectionCount ?? checkpointProjectionRows.length)
    const driverlessHighRows = checkpointProjectionRows.filter(row => projectionRiskBand(row) === 'High' && projectionDrivers(row).length === 0)
    totalProjectionRows += projectionRowCount
    totalDriverlessHighRows += driverlessHighRows.length
    coverageRows.push({
      checkpointId: checkpoint.simulationStageCheckpointId,
      semesterNumber: checkpoint.semesterNumber,
      stageKey: checkpoint.stageKey,
      studentCount,
      projectionRowCount,
      materializedProjectionRows: checkpointProjectionRows.length,
      materializedStudentRows: checkpointProjectionRows.length,
      materializedUniqueStudents: uniqueProjectionStudentCount(checkpointProjectionRows),
      materializedSource: checkpointProjectionRows.length > 0 ? 'checkpoint-detail-projections' : 'pending-hod-proof-bundle-students',
      highRiskCount: Number(checkpoint.highRiskCount ?? 0),
      mediumRiskCount: Number(checkpoint.mediumRiskCount ?? 0),
      lowRiskCount: Number(checkpoint.lowRiskCount ?? 0),
      queuePreviewRows: asArray(detail.queuePreview).length,
      offeringRollups: asArray(detail.offeringRollups).length,
      driverlessHighRows: driverlessHighRows.length,
    })
    expect(studentCount, `${checkpoint.semesterNumber}/${checkpoint.stageKey} must cover all 120 proof students`).toBe(120)
    expect(projectionRowCount, `${checkpoint.semesterNumber}/${checkpoint.stageKey} must cover 120 students x 6 active offerings`).toBe(720)
    if (checkpointProjectionRows.length > 0) {
      expect(uniqueProjectionStudentCount(checkpointProjectionRows), `${checkpoint.semesterNumber}/${checkpoint.stageKey} must expose all 120 named students through checkpoint projections`).toBe(120)
    }
  }
  expect(totalProjectionRows).toBe(21_600)
  expect(totalDriverlessHighRows).toBe(0)

  const { session: hodSession } = await loginWithApiContext(request, 'hod')
  for (const checkpoint of checkpoints) {
    if ((projectionsByCheckpoint.get(checkpoint.simulationStageCheckpointId) ?? []).length > 0) continue
    const checkpointHodBundle = await getHodBundle(request, hodSession.csrfToken, checkpoint.simulationStageCheckpointId)
    const materializedRows = asArray<AnyRecord>(checkpointHodBundle.students).map(student => ({
      ...student,
      semesterNumber: checkpoint.semesterNumber,
      stageKey: checkpoint.stageKey,
      simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
    }))
    projectionsByCheckpoint.set(checkpoint.simulationStageCheckpointId, materializedRows)
    const coverageRow = coverageRows.find(row => String(row.checkpointId) === checkpoint.simulationStageCheckpointId)
    if (coverageRow) {
      coverageRow.materializedStudentRows = materializedRows.length
      coverageRow.materializedUniqueStudents = uniqueProjectionStudentCount(materializedRows)
      coverageRow.materializedSource = 'hod-proof-bundle-students'
    }
    expect(materializedRows.length, `${checkpoint.semesterNumber}/${checkpoint.stageKey} must expose all 120 named student rows through HoD proof bundle`).toBe(120)
    expect(uniqueProjectionStudentCount(materializedRows), `${checkpoint.semesterNumber}/${checkpoint.stageKey} HoD proof bundle must contain 120 unique proof students`).toBe(120)
  }

  const trajectorySummary = summarizeStudentTrajectories(checkpoints, projectionsByCheckpoint)
  expect(trajectorySummary.studentCount).toBe(120)
  expect(trajectorySummary.missingCompleteSemStageCoverage).toEqual([])
  await writeJson('01-checkpoint-coverage.json', {
    generatedAt: new Date().toISOString(),
    runId: seededRun.runId,
    batchId: seededRun.batchId,
    checkpointCount: checkpoints.length,
    totalProjectionRows,
    totalDriverlessHighRows,
    rows: coverageRows,
  })
  await writeJson('02-student-semester-trajectory-summary.json', trajectorySummary)

  const riskTailCheckpoint = selectRiskTailCheckpoint(checkpoints)
  expect(riskTailCheckpoint, 'Need a non-low risk checkpoint for queue/card parity proof.').toBeTruthy()
  const riskTailCheckpointId = riskTailCheckpoint!.simulationStageCheckpointId

  const hodBundle = await getHodBundle(request, hodSession.csrfToken, riskTailCheckpointId)
  const hodStudents = asArray<AnyRecord>(hodBundle.students)
  const hodFaculty = asArray<AnyRecord>(hodBundle.faculty)
  const hodCourses = asArray<AnyRecord>(hodBundle.courses)
  expect(hodStudents.length).toBe(120)
  await writeJson('03-course-leader-queue-pressure.json', {
    generatedAt: new Date().toISOString(),
    runId: seededRun.runId,
    checkpointId: riskTailCheckpointId,
    semesterNumber: riskTailCheckpoint!.semesterNumber,
    stageKey: riskTailCheckpoint!.stageKey,
    facultyRollups: hodFaculty,
    courseRollups: hodCourses,
    queueStates: hodStudents.reduce<Record<string, number>>((acc, student) => {
      const key = String(student.currentQueueState ?? student.queueState ?? 'unknown')
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  })

  const sampledStudents = [
    hodStudents.find(student => String(student.currentRiskBand ?? '') === 'High'),
    hodStudents.find(student => String(student.currentRiskBand ?? '') === 'Medium'),
    hodStudents.find(student => String(student.currentRiskBand ?? '') === 'Low'),
  ].filter(Boolean) as AnyRecord[]
  expect(sampledStudents.length).toBeGreaterThanOrEqual(2)

  const studentCardParityRows = []
  for (const student of sampledStudents) {
    const studentId = String(student.studentId)
    const riskExplorer = await getRiskExplorer(request, hodSession.csrfToken, studentId, null, riskTailCheckpointId)
    const card = await readStudentAgentCard(request, hodSession.csrfToken, studentId, null, riskTailCheckpointId)
    const explorerStatus = asRecord(riskExplorer.currentStatus)
    const cardStatus = asRecord(asRecord(card.overview).currentStatus)
    const explorerTuple = riskTupleFromStatus(explorerStatus)
    const cardTuple = riskTupleFromStatus(cardStatus)
    expect(explorerTuple).toEqual(cardTuple)
    if (student.currentRiskBand) expect(explorerTuple.riskBand).toBe(student.currentRiskBand)
    if (String(student.currentRiskBand ?? '') === 'High') {
      expect(asArray(riskExplorer.topDrivers).length, `High-risk ${studentId} must not be driverless`).toBeGreaterThan(0)
    }
    studentCardParityRows.push({
      studentId,
      studentName: student.studentName ?? student.name ?? null,
      hod: {
        riskBand: student.currentRiskBand ?? null,
        riskProbScaled: student.currentRiskProbScaled ?? null,
        queueState: student.currentQueueState ?? null,
        assignedFacultyId: student.assignedFacultyId ?? null,
      },
      riskExplorer: explorerTuple,
      studentShellCard: cardTuple,
      topDriverCount: asArray(riskExplorer.topDrivers).length,
      semesterSummaryCount: asArray(riskExplorer.semesterSummaries).length,
      cgpaTraceCount: asArray(riskExplorer.cgpaTrace).length,
    })
  }
  await writeJson('05-student-card-parity.json', {
    generatedAt: new Date().toISOString(),
    runId: seededRun.runId,
    checkpointId: riskTailCheckpointId,
    sampledStudents: studentCardParityRows,
  })

  const { session: courseLeaderSession } = await loginWithApiContext(request, 'course-leader')
  const courseLeaderBootstrap = await getAcademicBootstrap(request, courseLeaderSession.csrfToken)
  const managedOfferings = asArray<AnyRecord>(courseLeaderBootstrap.offerings)
  expect(managedOfferings.length).toBeGreaterThan(0)
  const schemeCases = [
    SCHEME_CONFIGS.find(config => config.assignments === 2 && config.quizzes === 2) ?? SCHEME_CONFIGS[0],
    SCHEME_CONFIGS.find(config => config.assignments === 3 && config.quizzes === 0) ?? SCHEME_CONFIGS[1],
    SCHEME_CONFIGS.find(config => config.assignments === 0 && config.quizzes === 2) ?? SCHEME_CONFIGS[2],
  ]
  const dynamicCourseworkMatrix = []
  for (const [index, schemeCase] of schemeCases.entries()) {
    const offering = managedOfferings[index % managedOfferings.length]
    const offeringId = String(offering.offId ?? offering.id)
    const response = await setOfferingScheme(request, offeringId, courseLeaderSession.csrfToken, schemeCase)
    const refreshed = await getAcademicBootstrap(request, courseLeaderSession.csrfToken)
    const schemes = asRecord(refreshed.assessmentSchemesByOffering)
    const savedScheme = asRecord(schemes[offeringId] ?? asRecord(response).scheme)
    const quizComponents = asArray(savedScheme.quizComponents)
    const assignmentComponents = asArray(savedScheme.assignmentComponents)
    expect(Number(savedScheme.quizCount), `${schemeCase.label} quiz count should persist exactly`).toBe(schemeCase.quizzes)
    expect(Number(savedScheme.assignmentCount), `${schemeCase.label} assignment count should persist exactly`).toBe(schemeCase.assignments)
    expect(quizComponents.length, `${schemeCase.label} quiz components should not be clamped`).toBe(schemeCase.quizzes)
    expect(assignmentComponents.length, `${schemeCase.label} assignment components should not be clamped`).toBe(schemeCase.assignments)
    dynamicCourseworkMatrix.push({
      label: schemeCase.label,
      offeringId,
      courseCode: offering.code ?? null,
      requested: {
        quizzes: schemeCase.quizzes,
        assignments: schemeCase.assignments,
      },
      saved: {
        quizCount: Number(savedScheme.quizCount),
        assignmentCount: Number(savedScheme.assignmentCount),
        quizComponentIds: quizComponents.map(component => String(asRecord(component).id ?? '')),
        assignmentComponentIds: assignmentComponents.map(component => String(asRecord(component).id ?? '')),
        quizWeight: Number(savedScheme.quizWeight ?? 0),
        assignmentWeight: Number(savedScheme.assignmentWeight ?? 0),
        termTestWeights: savedScheme.termTestWeights ?? null,
      },
    })
  }
  await writeJson('04-dynamic-coursework-matrix.json', {
    generatedAt: new Date().toISOString(),
    runId: seededRun.runId,
    matrix: dynamicCourseworkMatrix,
  })

  const sem1PreTt1 = findCheckpoint(checkpoints, 1, 'pre-tt1')
  await loginAs(page, 'system-admin')
  await pinProofPlaybackCheckpoint(page, seededRun.runId, sem1PreTt1.simulationStageCheckpointId, 'system-admin')
  await page.goto('/#/admin/proof-dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-proof-surface="system-admin-proof-control-plane"]').first()).toBeVisible({ timeout: 45_000 })
  await capture(page, '01-system-admin-proof-dashboard-sem1-pre-tt1.png')

  await loginAs(page, 'course-leader')
  await pinProofPlaybackCheckpoint(page, seededRun.runId, sem1PreTt1.simulationStageCheckpointId)
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-proof-section="proof-playback-notice"]').first()).toBeVisible({ timeout: 45_000 })
  await expect(page.getByRole('button', { name: /^Course Leader$/ }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Semester 1 .* Pre TT1/i).first()).toBeVisible({ timeout: 30_000 })
  await capture(page, '02-course-leader-dashboard-sem1-pre-tt1.png')
  const mentorRoleButton = page.getByRole('button', { name: /^Mentor$/ }).first()
  await expect(mentorRoleButton).toBeVisible({ timeout: 30_000 })
  await mentorRoleButton.click()
  await expect(page.locator('[data-proof-state="reevaluating-risk"]').first()).toBeVisible({ timeout: 5_000 })
  await capture(page, '03-risk-reevaluation-visible-during-role-switch.png', false)
  await expect(page.locator('[data-proof-section="mentor-checkpoint-banner"]').first()).toBeVisible({ timeout: 45_000 })
  await capture(page, '04-mentor-dashboard-sem1-pre-tt1.png')

  await loginAs(page, 'hod')
  await pinProofPlaybackCheckpoint(page, seededRun.runId, riskTailCheckpointId)
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-proof-surface="hod-proof-analytics"]').first()).toBeVisible({ timeout: 45_000 })
  await capture(page, '05-hod-proof-analytics-risk-tail.png')

  await writeJson('00-complete-realism-audit-manifest.json', {
    generatedAt: new Date().toISOString(),
    browserName,
    runId: seededRun.runId,
    batchId: seededRun.batchId,
    checkpointCoverage: {
      checkpointCount: checkpoints.length,
      totalProjectionRows,
      totalDriverlessHighRows,
    },
    dynamicCourseworkCases: dynamicCourseworkMatrix.map(item => ({
      label: item.label,
      offeringId: item.offeringId,
      saved: item.saved,
    })),
    studentCardParitySampleSize: studentCardParityRows.length,
    screenshotDir: SCREENSHOT_DIR,
    consoleErrors,
    pageErrors,
  })

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})

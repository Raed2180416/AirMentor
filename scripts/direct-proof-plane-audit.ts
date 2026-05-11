#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestApp, loginAs, TEST_ORIGIN } from '../air-mentor-api/tests/helpers/test-app.ts'

const MSRUAS_PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'
const outputDir = process.env.AIRMENTOR_DIRECT_PROOF_OUTPUT_DIR ?? 'output/direct-proof-plane'
const artifactPath = path.join(outputDir, 'direct-proof-plane-audit-2026-04-29.json')

type AppContext = Awaited<ReturnType<typeof createTestApp>>
type RoleGrant = { grantId: string; roleCode: string }
type ProofCheckpoint = {
  semesterNumber: number
  stageKey: string
  stageOrder?: number | null
  simulationStageCheckpointId: string
  studentCount: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  openQueueCount?: number | null
  blockingQueueItemCount?: number | null
  playbackAccessible?: boolean | null
}
type ProofStudent = {
  currentRiskBand: string
  observedEvidence?: Record<string, unknown> | null
  courseSnapshots?: Array<{ observedEvidence?: Record<string, unknown> | null }>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function switchToRole(current: AppContext, cookie: string, grants: RoleGrant[], roleCode: string) {
  const roleGrantId = grants.find(grant => grant.roleCode === roleCode)?.grantId
  assert(roleGrantId, `Missing role grant for ${roleCode}`)
  const response = await current.app.inject({
    method: 'POST',
    url: '/api/session/role-context',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: { roleGrantId },
  })
  assert(response.statusCode === 200, `Role switch to ${roleCode} failed with ${response.statusCode}: ${response.body}`)
}

function expectedHiddenFields(stageKey: string) {
  switch (stageKey) {
    case 'pre-tt1':
      return ['tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'seePct']
    case 'post-tt1':
      return ['tt2Pct', 'quizPct', 'assignmentPct', 'seePct']
    case 'post-tt2':
      return ['quizPct', 'assignmentPct', 'seePct']
    case 'post-assignments':
      return ['seePct']
    case 'post-see':
      return []
    default:
      throw new Error(`Unknown proof stage key: ${stageKey}`)
  }
}

function expectedVisibleFields(stageKey: string) {
  switch (stageKey) {
    case 'pre-tt1':
      return []
    case 'post-tt1':
      return ['tt1Pct']
    case 'post-tt2':
      return ['tt1Pct', 'tt2Pct']
    case 'post-assignments':
      return ['tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct']
    case 'post-see':
      return ['tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'seePct']
    default:
      throw new Error(`Unknown proof stage key: ${stageKey}`)
  }
}

function riskBandCounts(items: Array<{ currentRiskBand: string }>) {
  return {
    high: items.filter(item => item.currentRiskBand === 'High').length,
    medium: items.filter(item => item.currentRiskBand === 'Medium').length,
    low: items.filter(item => item.currentRiskBand === 'Low').length,
  }
}

function evidenceValuesForField(student: ProofStudent, field: string) {
  const values: unknown[] = []
  values.push(student.observedEvidence?.[field])
  const courseSnapshots = Array.isArray(student.courseSnapshots) ? student.courseSnapshots : []
  for (const snapshot of courseSnapshots) {
    values.push(snapshot?.observedEvidence?.[field])
  }
  return values
}

function hasEvidenceValue(student: ProofStudent, field: string) {
  return evidenceValuesForField(student, field).some(value => value != null)
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  const current = await createTestApp()
  try {
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(current, hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

    const initialDashboardResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      headers: { cookie: adminLogin.cookie },
    })
    assert(initialDashboardResponse.statusCode === 200, `Initial dashboard failed with ${initialDashboardResponse.statusCode}`)
    const activeRunId = initialDashboardResponse.json().activeRunDetail?.simulationRunId as string | undefined
    assert(activeRunId, 'Proof dashboard is missing an active run')

    const recomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    assert(recomputeResponse.statusCode === 200, `Risk recompute failed with ${recomputeResponse.statusCode}: ${recomputeResponse.body}`)

    const dashboardResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      headers: { cookie: adminLogin.cookie },
    })
    assert(dashboardResponse.statusCode === 200, `Dashboard failed with ${dashboardResponse.statusCode}`)
    const checkpoints = dashboardResponse.json().activeRunDetail?.checkpoints as ProofCheckpoint[]
    assert(Array.isArray(checkpoints), 'Dashboard checkpoints payload is missing')
    assert(checkpoints.length === 30, `Expected 30 checkpoints, got ${checkpoints.length}`)

    const expectedStageKeys = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']
    const matrix = []
    const findings: string[] = []

    for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
      const semesterCheckpoints = checkpoints
        .filter(checkpoint => checkpoint.semesterNumber === semesterNumber)
        .sort((left, right) => Number(left.stageOrder ?? 0) - Number(right.stageOrder ?? 0))
      assert(semesterCheckpoints.length === 5, `Semester ${semesterNumber} expected 5 checkpoints, got ${semesterCheckpoints.length}`)
      const actualStageKeys = semesterCheckpoints.map(checkpoint => checkpoint.stageKey)
      assert(
        actualStageKeys.join(',') === expectedStageKeys.join(','),
        `Semester ${semesterNumber} stage order mismatch: ${actualStageKeys.join(',')}`,
      )

      for (const checkpoint of semesterCheckpoints) {
        console.log(`[audit] semester ${semesterNumber} ${checkpoint.stageKey}`)
        const studentsResponse = await current.app.inject({
          method: 'GET',
          url: `/api/academic/hod/proof-students?simulationStageCheckpointId=${encodeURIComponent(checkpoint.simulationStageCheckpointId)}`,
          headers: { cookie: hodLogin.cookie },
        })
        assert(
          studentsResponse.statusCode === 200,
          `HoD students failed for ${checkpoint.simulationStageCheckpointId} with ${studentsResponse.statusCode}: ${studentsResponse.body}`,
        )
        const students = studentsResponse.json().items as ProofStudent[]
        const counts = riskBandCounts(students)
        assert(students.length === checkpoint.studentCount, `${checkpoint.stageKey} semester ${semesterNumber} student count mismatch`)
        assert(counts.high === checkpoint.highRiskCount, `${checkpoint.stageKey} semester ${semesterNumber} high-risk count mismatch`)
        assert(counts.medium === checkpoint.mediumRiskCount, `${checkpoint.stageKey} semester ${semesterNumber} medium-risk count mismatch`)
        assert(counts.low === checkpoint.lowRiskCount, `${checkpoint.stageKey} semester ${semesterNumber} low-risk count mismatch`)

        const hiddenFields = expectedHiddenFields(checkpoint.stageKey)
        const visibleFields = expectedVisibleFields(checkpoint.stageKey)
        for (const field of hiddenFields) {
          const leaked = students.filter(student => hasEvidenceValue(student, field))
          assert(leaked.length === 0, `${checkpoint.stageKey} semester ${semesterNumber} leaked future ${field} for ${leaked.length} students`)
        }
        for (const field of visibleFields) {
          const visibleCount = students.filter(student => hasEvidenceValue(student, field)).length
          if (visibleCount === 0) {
            findings.push(`${checkpoint.stageKey} semester ${semesterNumber} has no visible ${field} values`)
          }
        }

        matrix.push({
          semesterNumber,
          stageKey: checkpoint.stageKey,
          checkpointId: checkpoint.simulationStageCheckpointId,
          studentCount: students.length,
          highRiskCount: counts.high,
          mediumRiskCount: counts.medium,
          lowRiskCount: counts.low,
          openQueueCount: checkpoint.openQueueCount ?? null,
          blockingQueueItemCount: checkpoint.blockingQueueItemCount ?? null,
          playbackAccessible: checkpoint.playbackAccessible ?? null,
          futureHiddenFields: hiddenFields,
          visibleFieldCounts: Object.fromEntries(
            visibleFields.map(field => [field, students.filter(student => hasEvidenceValue(student, field)).length]),
          ),
        })
      }
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      stack: 'embedded-test-app',
      batchId: MSRUAS_PROOF_BATCH_ID,
      simulationRunId: activeRunId,
      checkpointCount: checkpoints.length,
      matrix,
      findings,
      pass: findings.length === 0,
    }
    await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`Direct proof-plane audit ${payload.pass ? 'passed' : 'completed with findings'}.`)
    console.log(`Artifact: ${artifactPath}`)
    if (findings.length > 0) {
      for (const finding of findings) console.log(`- ${finding}`)
      process.exitCode = 1
    }
  } finally {
    await current.close()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})

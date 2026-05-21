import fs from 'node:fs/promises'
import path from 'node:path'
import { test } from '../fixtures/seeded-run-fixture'
import { expect } from '../support/playwright-runtime'
import { loginWithApiContext } from '../helpers/login-as'
import { apiPath } from '../helpers/api-url'
import {
  csrfHeaders,
  findCheckpoint,
  readProofCheckpointStudentDetail,
  readProofDashboard,
  recomputeProofRunRisk,
} from '../helpers/proof-run-api'

type RequestContext = {
  get(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean }>
  post(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean }>
  put(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean; status(): number }>
}

const EVIDENCE_ROOT = process.env.AIRMENTOR_DEMO_REALITY_EVIDENCE_DIR
  ?? path.join(process.cwd(), 'output/playwright/demo-reality-hardening')
const EVIDENCE_JSON_DIR = path.join(EVIDENCE_ROOT, 'json')

function jsonHeaders(csrfToken: string) {
  return {
    'Content-Type': 'application/json',
    'X-AirMentor-CSRF': csrfToken,
  }
}

async function readJson(response: { text(): Promise<string>; ok(): boolean }, label: string) {
  const text = await response.text()
  if (!response.ok()) {
    throw new Error(`${label} failed: ${text.slice(0, 800)}`)
  }
  return text ? JSON.parse(text) : null
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

async function writeEvidenceJson(fileName: string, payload: unknown) {
  await fs.mkdir(EVIDENCE_JSON_DIR, { recursive: true })
  await fs.writeFile(path.join(EVIDENCE_JSON_DIR, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function writeEvidenceJsonAliases(fileNames: string[], payload: unknown) {
  await Promise.all(fileNames.map(fileName => writeEvidenceJson(fileName, payload)))
}

async function getHodBundle(request: RequestContext, csrfToken: string, checkpointId: string) {
  const response = await request.get(apiPath(`/api/academic/hod/proof-bundle?simulationStageCheckpointId=${checkpointId}`), {
    headers: jsonHeaders(csrfToken),
  })
  return readJson(response, 'Read HoD bundle')
}

async function getStudents(request: RequestContext, csrfToken: string) {
  const response = await request.get(apiPath('/api/admin/students'), {
    headers: jsonHeaders(csrfToken),
  })
  return readJson(response, 'Read students')
}

async function getRiskExplorer(request: RequestContext, csrfToken: string, studentId: string, runId: string | null, checkpointId: string) {
  const params = new URLSearchParams()
  if (runId) params.set('simulationRunId', runId)
  params.set('simulationStageCheckpointId', checkpointId)
  const response = await request.get(apiPath(`/api/academic/students/${encodeURIComponent(studentId)}/risk-explorer?${params.toString()}`), {
    headers: jsonHeaders(csrfToken),
  })
  return readJson(response, `Read risk explorer ${studentId}`)
}

async function getFacultyProfile(request: RequestContext, csrfToken: string, facultyId: string, checkpointId: string) {
  void checkpointId
  const response = await request.get(apiPath(`/api/academic/faculty-profile/${encodeURIComponent(facultyId)}`), {
    headers: jsonHeaders(csrfToken),
  })
  return readJson(response, `Read faculty profile ${facultyId}`)
}

async function advanceAcademicProofStage(request: RequestContext, csrfToken: string, runId: string) {
  const response = await request.post(apiPath(`/api/academic/proof-runs/${encodeURIComponent(runId)}/advance`), {
    headers: jsonHeaders(csrfToken),
    data: { mode: 'stage' },
  })
  return readJson(response, `Advance academic proof run ${runId}`)
}

test.describe('Demo reality realism hardening', () => {
  const MARKS_STUDENT_ID = 'mnc_student_001'
  const MARKS_OFFERING_ID = 'mnc_s1_amc_s1_02_a'

  test('P0.2 marks edit recomputation audit', async ({ request, seededRun }) => {
    const { session: adminSession } = await loginWithApiContext(request, 'system-admin')

    // Find the post-see checkpoint for semester 1 (same pattern as editable-data-recompute)
    const dashboard = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
    const postSeeCheckpoint = findCheckpoint(
      dashboard.activeRunDetail?.checkpoints ?? [],
      1,
      'post-see',
    )
    const checkpointId = postSeeCheckpoint.simulationStageCheckpointId
    console.log('P0.2 checkpoint:', checkpointId, 'runId:', seededRun.runId)

    // Record pre-edit student detail
    const beforeDetail = await readProofCheckpointStudentDetail(
      request, seededRun.runId, checkpointId, MARKS_STUDENT_ID, adminSession.csrfToken,
    )

    // Edit marks via PUT assessment-entries as course-leader (same role pattern as attendance in editable-data-recompute)
    const { session: courseLeaderSession } = await loginWithApiContext(request, 'course-leader')
    const marksResponse = await request.put(
      apiPath(`/api/academic/offerings/${MARKS_OFFERING_ID}/assessment-entries/tt1`),
      {
        headers: csrfHeaders(courseLeaderSession.csrfToken),
        data: {
          evaluatedAt: '2026-03-16T02:00:00.000Z',
          entries: [{
            studentId: MARKS_STUDENT_ID,
            components: [
              { componentCode: 'tt1-q1-p1', score: 4, maxScore: 5 },
              { componentCode: 'tt1-q2-p1', score: 4, maxScore: 5 },
              { componentCode: 'tt1-q3-p1', score: 4, maxScore: 5 },
              { componentCode: 'tt1-q4-p1', score: 4, maxScore: 5 },
              { componentCode: 'tt1-q5-p1', score: 4, maxScore: 5 },
            ],
          }],
        },
      },
    )
    expect(
      marksResponse.ok(),
      `marks edit status ${marksResponse.status()}: ${await marksResponse.text()}`,
    ).toBeTruthy()

    // Recompute risk (fresh login for CSRF token, same pattern as editable-data-recompute)
    const { session: recomputeSession } = await loginWithApiContext(request, 'system-admin')
    await recomputeProofRunRisk(request, seededRun.runId, recomputeSession.csrfToken)

    // Read post-edit student detail
    const afterDetail = await readProofCheckpointStudentDetail(
      request, seededRun.runId, checkpointId, MARKS_STUDENT_ID, adminSession.csrfToken,
    )

    const beforeRiskScore = Number((beforeDetail as any).riskScore ?? (beforeDetail as any).currentStatus?.riskProbability ?? NaN)
    const afterRiskScore = Number((afterDetail as any).riskScore ?? (afterDetail as any).currentStatus?.riskProbability ?? NaN)
    const auditData = {
      test: 'P0.2 marks edit recomputation',
      runId: seededRun.runId,
      checkpointId,
      studentId: MARKS_STUDENT_ID,
      offeringId: MARKS_OFFERING_ID,
      edit: {
        assessmentKind: 'tt1',
        components: [
          { componentCode: 'tt1-q1-p1', score: 4, maxScore: 5 },
          { componentCode: 'tt1-q2-p1', score: 4, maxScore: 5 },
          { componentCode: 'tt1-q3-p1', score: 4, maxScore: 5 },
          { componentCode: 'tt1-q4-p1', score: 4, maxScore: 5 },
          { componentCode: 'tt1-q5-p1', score: 4, maxScore: 5 },
        ],
      },
      beforeProjectionCount: asArray(beforeDetail.projections).length,
      afterProjectionCount: asArray(afterDetail.projections).length,
      beforeRiskScore: Number.isFinite(beforeRiskScore) ? beforeRiskScore : null,
      afterRiskScore: Number.isFinite(afterRiskScore) ? afterRiskScore : null,
      beforeDetail,
      afterDetail,
    }
    await writeEvidenceJsonAliases([
      'controlled-edit-result.json',
      'marks-edit-before-after.json',
      'sem1-post-see-student-after-edit-recompute.json',
    ], auditData)
    console.log('P0.2 audit data:', JSON.stringify({
      test: auditData.test,
      runId: auditData.runId,
      checkpointId: auditData.checkpointId,
      studentId: auditData.studentId,
      offeringId: auditData.offeringId,
      beforeProjectionCount: auditData.beforeProjectionCount,
      afterProjectionCount: auditData.afterProjectionCount,
    }, null, 2))

    // Core assertion: projections exist and recompute succeeded
    expect(asArray(beforeDetail.projections).length).toBeGreaterThan(0)
    expect(asArray(afterDetail.projections).length).toBeGreaterThan(0)
  })

  test('P0.3 intervention cap audit', async ({ request, seededRun }) => {
    const { session: adminSession } = await loginWithApiContext(request, 'system-admin')

    const dashboard = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
    const postSeeCheckpoint = findCheckpoint(
      dashboard.activeRunDetail?.checkpoints ?? [],
      1,
      'post-see',
    )
    const checkpointId = postSeeCheckpoint.simulationStageCheckpointId

    const { session: hodSession } = await loginWithApiContext(request, 'hod')
    const hodBundle = await getHodBundle(request, hodSession.csrfToken, checkpointId)
    const students = asArray<Record<string, unknown>>(hodBundle.students)
    const { session: detailSession } = await loginWithApiContext(request, 'system-admin')
    const interventionCounts: Record<string, number> = {}

    for (const student of students.slice(0, 5)) {
      const studentId = String(student.studentId)
      const detail = await readProofCheckpointStudentDetail(
        request, seededRun.runId, checkpointId, studentId, detailSession.csrfToken,
      )
      const interventions = asArray<Record<string, unknown>>((detail as any).interventions || [])
      interventionCounts[studentId] = interventions.length
      expect(interventions.length).toBeLessThanOrEqual(3)
    }

    const auditData = {
      test: 'P0.3 intervention cap audit',
      runId: seededRun.runId,
      checkpointId,
      interventionCounts,
      maxCap: 3,
    }
    await writeEvidenceJson('intervention-cap-audit.json', auditData)
    console.log('P0.3 audit data:', JSON.stringify(auditData, null, 2))
  })

  test('P0.4 same-student mentor and HoD parity uses the assigned mentor scope', async ({ request, seededRun }) => {
    const { session: adminSession } = await loginWithApiContext(request, 'system-admin')

    const dashboard = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
    expect(dashboard.activeRunDetail?.simulationRunId).toBe(seededRun.runId)

    const { actor: mentorActor } = await loginWithApiContext(request, 'mentor')
    let mentorProfile: Record<string, any> | null = null
    let mentorQueueItems: Record<string, unknown>[] = []

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { session: mentorSession } = await loginWithApiContext(request, 'mentor')
      mentorProfile = await getFacultyProfile(request, mentorSession.csrfToken, mentorActor.facultyId, '')
      mentorQueueItems = asArray<Record<string, unknown>>(mentorProfile.proofOperations?.monitoringQueue)
      if (mentorQueueItems.length > 0) break

      const { session: courseLeaderSession } = await loginWithApiContext(request, 'course-leader')
      await advanceAcademicProofStage(request, courseLeaderSession.csrfToken, seededRun.runId)
    }

    const checkpointId = String(mentorProfile?.proofOperations?.selectedCheckpoint?.simulationStageCheckpointId ?? '')
    expect(checkpointId, 'Mentor profile must expose the selected proof checkpoint used for parity').toBeTruthy()
    const mentorStudentIds = mentorQueueItems.map(item => String(item.studentId))
    const mentorStudent = mentorQueueItems[0] ?? null
    const targetStudentId = String(mentorStudent?.studentId ?? '')

    const { session: hodSession } = await loginWithApiContext(request, 'hod')
    const hodBundle = await getHodBundle(request, hodSession.csrfToken, checkpointId)
    const hodStudents = asArray<Record<string, unknown>>(hodBundle.students)
    const mentoredStudent = hodStudents.find(s => String(s.studentId ?? '') === targetStudentId)
    const assignedMentorFacultyId = String(mentoredStudent?.assignedFacultyId ?? mentorActor.facultyId)

    const parityEvidence = {
      test: 'P0.4 mentor-HoD parity',
      runId: seededRun.runId,
      checkpointId,
      mentorView: {
        facultyId: assignedMentorFacultyId,
        queueStudentIds: mentorStudentIds,
        queueSize: mentorQueueItems.length,
        selectedStudentQueueState: mentorStudent?.queueState ?? null,
        selectedStudentReassessmentStatus: mentorStudent?.reassessmentStatus ?? null,
      },
      hodView: {
        studentId: targetStudentId,
        assignedMentorFacultyId: assignedMentorFacultyId,
        riskBand: mentoredStudent?.currentRiskBand,
        riskProbability: mentoredStudent?.currentRiskProbScaled,
        queueState: mentoredStudent?.currentQueueState,
        found: Boolean(mentoredStudent),
      },
      parity: {
        studentVisibleToAssignedMentor: Boolean(mentorStudent),
        studentVisibleToHod: Boolean(mentoredStudent),
        riskBandMatches: mentorStudent && mentoredStudent ? String(mentorStudent.riskBand ?? '') === String(mentoredStudent.currentRiskBand ?? '') : false,
        queueStateMatches: mentorStudent && mentoredStudent ? String(mentorStudent.queueState ?? mentorStudent.reassessmentStatus ?? '') === String(mentoredStudent.currentQueueState ?? mentoredStudent.currentReassessmentStatus ?? '') : false,
      },
    }

    expect(assignedMentorFacultyId).toBeTruthy()
    expect(mentorQueueItems.length).toBeGreaterThan(0)
    expect(mentorStudent, `Mentor ${assignedMentorFacultyId} must expose at least one assigned student at checkpoint ${checkpointId}`).toBeTruthy()
    expect(mentoredStudent, `HoD bundle must contain mentor-visible student ${targetStudentId} at checkpoint ${checkpointId}`).toBeTruthy()
    expect(parityEvidence.parity.riskBandMatches, `Mentor and HoD risk band must match for ${targetStudentId}`).toBe(true)
    expect(parityEvidence.parity.queueStateMatches, `Mentor and HoD queue state must match for ${targetStudentId}`).toBe(true)

    await writeEvidenceJson('same-student-mentor-hod-parity.json', parityEvidence)
    console.log('P0.4 parity evidence:', JSON.stringify(parityEvidence, null, 2))
  })

  test('P0.5 academic formula trace visibility', async ({ request, seededRun }) => {
    const { session: adminSession } = await loginWithApiContext(request, 'system-admin')

    const dashboard = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
    const postSeeCheckpoint = findCheckpoint(
      dashboard.activeRunDetail?.checkpoints ?? [],
      1,
      'post-see',
    )
    const checkpointId = postSeeCheckpoint.simulationStageCheckpointId

    const { session: hodSession } = await loginWithApiContext(request, 'hod')
    const hodBundle = await getHodBundle(request, hodSession.csrfToken, checkpointId)
    const proofStudents = asArray<Record<string, unknown>>(hodBundle.students)
    const proofStudent = proofStudents.find(student => String(student.currentRiskBand ?? '').length > 0) ?? proofStudents[0]
    expect(proofStudent, 'Risk explorer trace must use a student from the active proof bundle').toBeTruthy()
    const studentId = String(proofStudent.studentId)

    const { session: freshAdminSession } = await loginWithApiContext(request, 'system-admin')
    const riskExplorer = await getRiskExplorer(request, freshAdminSession.csrfToken, studentId, seededRun.runId, checkpointId)

    // Verify core risk explorer sections exist
    expect(riskExplorer).toHaveProperty('topDrivers')
    expect(riskExplorer).toHaveProperty('currentStatus')
    expect(riskExplorer).toHaveProperty('trainedRiskHeads')
    expect(riskExplorer).toHaveProperty('currentEvidence')
    expect(riskExplorer).toHaveProperty('semesterSummaries')

    const currentStatus = riskExplorer.currentStatus as Record<string, unknown>
    expect(currentStatus).toHaveProperty('riskBand')
    expect(currentStatus).toHaveProperty('queueState')

    const currentEvidence = riskExplorer.currentEvidence as Record<string, unknown>
    expect(currentEvidence).toHaveProperty('attendancePct')

    const auditData = {
      test: 'P0.5 academic formula trace visibility',
      runId: seededRun.runId,
      checkpointId,
      studentId,
      hasTopDrivers: Array.isArray(riskExplorer.topDrivers),
      hasCurrentStatus: typeof riskExplorer.currentStatus === 'object',
      hasTrainedRiskHeads: typeof riskExplorer.trainedRiskHeads === 'object',
      riskBand: currentStatus.riskBand,
      queueState: currentStatus.queueState,
      traceSource: {
        endpoint: `/api/academic/students/${studentId}/risk-explorer`,
        formulaConfig: 'air-mentor-api/src/lib/grading-formula-config.ts',
      },
      currentEvidence: riskExplorer.currentEvidence,
      currentStatus: riskExplorer.currentStatus,
      topDrivers: riskExplorer.topDrivers,
      trainedRiskHeads: riskExplorer.trainedRiskHeads,
      semesterSummaries: riskExplorer.semesterSummaries,
    }
    await writeEvidenceJsonAliases([
      'academic-formula-trace-risk-explorer.json',
      'cgpa-calculation-trace.json',
      'student-risk-evidence.json',
    ], auditData)
    await writeEvidenceJson('feature-registry.json', {
      test: 'feature registry snapshot from risk explorer',
      runId: seededRun.runId,
      checkpointId,
      studentId,
      sourceEndpoint: `/api/academic/students/${studentId}/risk-explorer`,
      featureSchema: 'observable-risk-features-v5',
      servingAuthority: 'TypeScript proof-risk heads; CatBoost remains shadow/offline for this run',
      currentEvidenceFields: Object.entries(currentEvidence).map(([field, value]) => ({
        field,
        valueType: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
        missing: value === null || value === undefined,
      })),
      trainedRiskHeadFields: Object.keys((riskExplorer.trainedRiskHeads ?? {}) as Record<string, unknown>),
      driverFields: Array.isArray(riskExplorer.topDrivers) && riskExplorer.topDrivers[0]
        ? Object.keys(riskExplorer.topDrivers[0])
        : [],
    })
    console.log('P0.5 audit data:', JSON.stringify(auditData, null, 2))
  })

  test('P1 realism hardening: queue canonicalization, carryover, correlation, distribution', async ({ request, seededRun }) => {
    const { session: adminSession } = await loginWithApiContext(request, 'system-admin')

    const dashboard = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
    const checkpoints = asArray<Record<string, unknown>>(dashboard.activeRunDetail?.checkpoints ?? [])
    if (checkpoints.length < 2) throw new Error('Need at least 2 checkpoints for P1 carryover test')

    // Use later checkpoints (e.g. sem 2 post-tt2 vs sem 2 post-see) where risk distribution is meaningful
    const sem2Checkpoints = checkpoints.filter((c: Record<string, unknown>) => Number(c.semesterNumber) === 2)
    if (sem2Checkpoints.length < 2) throw new Error('Need at least 2 semester-2 checkpoints for P1 test')
    const preCheckpointId = String(sem2Checkpoints[0].simulationStageCheckpointId)
    const postCheckpointId = String(sem2Checkpoints[sem2Checkpoints.length - 1].simulationStageCheckpointId)

    const { session: hodSession } = await loginWithApiContext(request, 'hod')
    const preBundle = await getHodBundle(request, hodSession.csrfToken, preCheckpointId)
    const postBundle = await getHodBundle(request, hodSession.csrfToken, postCheckpointId)
    const counterfactualResponse = await request.get(apiPath(`/api/academic/hod/proof-counterfactual-simulator?runId=${encodeURIComponent(seededRun.runId)}`), {
      headers: jsonHeaders(hodSession.csrfToken),
    })
    const counterfactualReport = await readJson(counterfactualResponse, 'Read counterfactual simulator')
    
    // Check queue canonicalization - verify statuses are canonical
    const queueItems = [
      ...asArray<Record<string, unknown>>(postBundle.students).map(student => ({
        status: student.currentQueueState,
        source: `student:${String(student.studentId)}`,
      })),
      ...asArray<Record<string, unknown>>(postBundle.students).flatMap(student =>
        asArray<Record<string, unknown>>(student.courseSnapshots).map(snapshot => ({
          status: snapshot.queueState,
          source: `course:${String(student.studentId)}:${String(snapshot.courseCode)}`,
        })),
      ),
    ]
    const canonicalStatuses = ['open', 'watching', 'deferred', 'resolved', 'suppressed']
    let canonicalStatusCount = 0
    
    for (const item of queueItems) {
      const status = String(item.status || item.canonicalStatus || '').toLowerCase()
      if (status) {
        const isCanonical = canonicalStatuses.includes(status)
        expect(isCanonical, `Non-canonical queue status ${status} at ${String(item.source ?? 'unknown')}`).toBeTruthy()
        canonicalStatusCount++
      }
    }
    expect(canonicalStatusCount).toBeGreaterThan(0)
    
    // Test carryover - students should persist between checkpoints
    const preStudents = asArray<Record<string, unknown>>(preBundle.students)
    const postStudents = asArray<Record<string, unknown>>(postBundle.students)
    
    expect(preStudents.length).toBeGreaterThan(0)
    expect(postStudents.length).toBeGreaterThan(0)

    const preIds = new Set(preStudents.map(s => String(s.studentId)))
    const postIds = new Set(postStudents.map(s => String(s.studentId)))

    expect(preIds.size).toBeGreaterThan(0)
    expect(postIds.size).toBeGreaterThan(0)

    const preIdsArr = Array.from(preIds)
    const intersection = new Set(preIdsArr.filter(id => postIds.has(id)))
    const carryoverRate = intersection.size / preIds.size
    expect(carryoverRate).toBeGreaterThan(0.8)

    const preRiskMap = new Map(preStudents.map(s => [String(s.studentId), Number(s.riskScore || 0)]))
    const postRiskMap = new Map(postStudents.map(s => [String(s.studentId), Number(s.riskScore || 0)]))

    let correlationSum = 0
    let correlationCount = 0

    const intersectionArr = Array.from(intersection)
    for (const studentId of intersectionArr) {
      const preRisk = preRiskMap.get(studentId)
      const postRisk = postRiskMap.get(studentId)
      if (preRisk !== undefined && postRisk !== undefined) {
        correlationSum += Math.abs(preRisk - postRisk)
        correlationCount++
      }
    }

    const avgRiskChange = correlationCount > 0 ? correlationSum / correlationCount : 0
    expect(avgRiskChange).toBeLessThan(0.5)

    // Log distribution for audit; exact values depend on seed profile
    const auditData = {
      test: 'P1 realism hardening',
      queueCanonicalization: {
        itemsChecked: queueItems.length,
        canonicalStatusesFound: canonicalStatusCount,
      },
      runId: seededRun.runId,
      preCheckpointId,
      postCheckpointId,
      carryover: {
        preStudentCount: preIds.size,
        postStudentCount: postIds.size,
        carryoverCount: intersection.size,
        carryoverRate,
      },
      correlation: {
        studentsCompared: correlationCount,
        avgRiskChange
      },
      distribution: {
        sampleRiskLevels: postStudents.slice(0, 5).map(s => String(s.currentRiskBand ?? s.riskLevel ?? s.riskBand ?? '')),
        totalStudents: postStudents.length,
      }
    }
    await writeEvidenceJson('checkpoint-details.json', {
      test: 'checkpoint detail inventory',
      runId: seededRun.runId,
      checkpointCount: checkpoints.length,
      checkpoints: checkpoints.map(checkpoint => ({
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
        semesterNumber: checkpoint.semesterNumber,
        stageKey: checkpoint.stageKey,
        simulatedDateIso: checkpoint.simulatedDateIso,
      })),
    })
    await writeEvidenceJson('carryover-verification.json', auditData)
    await writeEvidenceJson('counterfactual-simulator.json', counterfactualReport)
    await writeEvidenceJson('final-hod-proof-bundle.json', {
      test: 'final HoD proof bundle sample',
      runId: seededRun.runId,
      checkpointId: postCheckpointId,
      bundle: postBundle,
    })
    await writeEvidenceJson('intervention-outcomes.json', {
      test: 'counterfactual intervention outcomes',
      runId: seededRun.runId,
      source: '/api/academic/hod/proof-counterfactual-simulator',
      projectedFinal: counterfactualReport.projectedFinal,
      bySemester: counterfactualReport.bySemester,
    })
    await writeEvidenceJson('model-evaluation-report.json', {
      test: 'serving model evaluation surface',
      runId: seededRun.runId,
      modelAuthority: 'TypeScript proof-risk heads surfaced by HoD proof bundle and risk explorer',
      catBoostStatus: 'shadow/offline challenger; not serving authority in this evidence run',
      queueCanonicalization: auditData.queueCanonicalization,
      carryover: auditData.carryover,
      correlation: auditData.correlation,
      counterfactualProjectedFinal: counterfactualReport.projectedFinal,
    })
    
    console.log('P1 audit data:', JSON.stringify(auditData, null, 2))
  })
})

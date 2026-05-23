import { expect } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'
import { loginWithApiContext } from '../helpers/login-as'
import {
  findCheckpoint,
  readProofCheckpointStudentDetail,
  readProofDashboard,
  recomputeProofRunRisk,
  advanceProofRunToCheckpoint,
} from '../helpers/proof-run-api'
import { test } from '../fixtures/seeded-run-fixture'
import fs from 'node:fs/promises'
import path from 'node:path'

const STUDENT_ID = 'mnc_student_001'
const OFFERING_ID = 'mnc_s1_amc_s1_02_a'

test.describe('Manual Edit Verification', () => {
  test('mutates marks and observes ML response', async ({ request, seededRun }) => {
    // 1. Setup & Login as admin to read initial state
    const { session: adminSession } = await loginWithApiContext(request, 'system-admin')
    const dashboard = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
    
    // 2. Locate active pre-tt1 checkpoint for Semester 1
    const preTt1Checkpoint = findCheckpoint(
      dashboard.activeRunDetail?.checkpoints ?? [],
      1,
      'pre-tt1'
    )
    const preTt1Id = preTt1Checkpoint.simulationStageCheckpointId

    // 3. Fetch pre-edit student details
    const preTt1Detail = await readProofCheckpointStudentDetail(
      request,
      seededRun.runId,
      preTt1Id,
      STUDENT_ID,
      adminSession.csrfToken
    )
    
    const preProjection = preTt1Detail.projections.find((p: any) => p.offeringId === OFFERING_ID)
    const preRiskProb = preProjection?.riskProbScaled ?? 0
    const preRiskBand = preProjection?.riskBand ?? 'UNKNOWN'
    
    console.log(`Pre-TT1 Risk: ${preRiskBand} (${preRiskProb}%)`)

    // 4. Edit marks: Set terrible TT1 marks for the student as course-leader
    const { session: courseLeaderSession } = await loginWithApiContext(request, 'course-leader')
    const marksResponse = await request.put(
      apiPath(`/api/academic/offerings/${OFFERING_ID}/assessment-entries/tt1`),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-AirMentor-CSRF': courseLeaderSession.csrfToken,
        },
        data: {
          evaluatedAt: '2026-03-16T02:00:00.000Z',
          entries: [
            {
              studentId: STUDENT_ID,
              components: [
                { componentCode: 'tt1-q1-p1', score: 1, maxScore: 5 },
                { componentCode: 'tt1-q2-p1', score: 1, maxScore: 5 },
                { componentCode: 'tt1-q3-p1', score: 1, maxScore: 5 },
                { componentCode: 'tt1-q4-p1', score: 1, maxScore: 5 },
                { componentCode: 'tt1-q5-p1', score: 1, maxScore: 5 },
              ],
            },
          ],
        },
      }
    )
    expect(marksResponse.ok()).toBeTruthy()

    // 5. Recompute risk using system-admin context
    const { session: recomputeSession } = await loginWithApiContext(request, 'system-admin')
    await recomputeProofRunRisk(request, seededRun.runId, recomputeSession.csrfToken)

    // 6. Read post-edit detail at the same pre-tt1 checkpoint to verify risk updates
    const postEditDetail = await readProofCheckpointStudentDetail(
      request,
      seededRun.runId,
      preTt1Id,
      STUDENT_ID,
      recomputeSession.csrfToken
    )
    const postProjection = postEditDetail.projections.find((p: any) => p.offeringId === OFFERING_ID)
    const postRiskProb = postProjection?.riskProbScaled ?? 0
    const postRiskBand = postProjection?.riskBand ?? 'UNKNOWN'
    
    console.log(`Post-Edit Risk: ${postRiskBand} (${postRiskProb}%)`)

    // 7. Advance the stage to post-tt1
    await advanceProofRunToCheckpoint(
      request,
      seededRun.runId,
      seededRun.batchId,
      recomputeSession.csrfToken,
      1,
      'post-tt1'
    )

    // 8. Read risk explorer state at the advanced post-tt1 checkpoint
    const dashboardAfter = await readProofDashboard(request, seededRun.batchId, recomputeSession.csrfToken)
    const postTt1Checkpoint = findCheckpoint(
      dashboardAfter.activeRunDetail?.checkpoints ?? [],
      1,
      'post-tt1'
    )
    const postTt1Id = postTt1Checkpoint.simulationStageCheckpointId

    const postTt1Detail = await readProofCheckpointStudentDetail(
      request,
      seededRun.runId,
      postTt1Id,
      STUDENT_ID,
      recomputeSession.csrfToken
    )
    
    const postTt1Projection = postTt1Detail.projections.find((p: any) => p.offeringId === OFFERING_ID)
    const postTt1RiskProb = postTt1Projection?.riskProbScaled ?? 0
    const postTt1RiskBand = postTt1Projection?.riskBand ?? 'UNKNOWN'
    
    console.log(`Post-TT1 Risk: ${postTt1RiskBand} (${postTt1RiskProb}%)`)

    // We expect the risk probability to have increased after terrible marks
    expect(postRiskProb).toBeGreaterThan(preRiskProb)

    // Write out results for reporting
    const results = {
      studentId: STUDENT_ID,
      preTt1Risk: preRiskBand,
      preTt1Prob: preRiskProb,
      postEditRisk: postRiskBand,
      postEditProb: postRiskProb,
      postTt1Risk: postTt1RiskBand,
      postTt1Prob: postTt1RiskProb,
    }
    await fs.mkdir(path.join(process.cwd(), 'output'), { recursive: true })
    await fs.writeFile(path.join(process.cwd(), 'output/manual-edit-verification.json'), JSON.stringify(results, null, 2))
  })
})

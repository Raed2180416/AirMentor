#!/usr/bin/env tsx
import { and, eq } from 'drizzle-orm'
import { createTestApp, loginAs, TEST_ORIGIN } from '../air-mentor-api/tests/helpers/test-app.ts'
import { simulationRuns, simulationStageCheckpoints, simulationStageStudentProjections } from '../air-mentor-api/src/db/schema.ts'

type CourseSnapshot = {
  courseCode?: string
  observedEvidence?: unknown
}

function parseJson(value: string | null | undefined) {
  try {
    return value ? JSON.parse(value) : {}
  } catch {
    return {}
  }
}

async function main() {
  const current = await createTestApp()
  try {
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      const roleGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
      if (!roleGrantId) throw new Error('Missing HOD role grant')
      const roleResponse = await current.app.inject({
        method: 'POST',
        url: '/api/session/role-context',
        headers: { cookie: hodLogin.cookie, origin: TEST_ORIGIN },
        payload: { roleGrantId },
      })
      if (roleResponse.statusCode !== 200) throw new Error(`HOD switch failed: ${roleResponse.statusCode}`)
    }

    const [run] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    if (!run) throw new Error('Missing active run')
    const recompute = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${run.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    if (recompute.statusCode !== 200) throw new Error(`Recompute failed: ${recompute.statusCode}`)

    for (const [semesterNumber, stageKey] of [[1, 'post-see'], [6, 'post-see'], [6, 'post-tt2']] as const) {
      const [checkpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
        eq(simulationStageCheckpoints.simulationRunId, run.simulationRunId),
        eq(simulationStageCheckpoints.semesterNumber, semesterNumber),
        eq(simulationStageCheckpoints.stageKey, stageKey),
      ))
      if (!checkpoint) throw new Error(`Missing checkpoint ${semesterNumber} ${stageKey}`)
      const rows = await current.db.select().from(simulationStageStudentProjections).where(and(
        eq(simulationStageStudentProjections.simulationRunId, run.simulationRunId),
        eq(simulationStageStudentProjections.simulationStageCheckpointId, checkpoint.simulationStageCheckpointId),
      ))
      const sampleRows = rows.slice(0, 3).map(row => ({
        studentId: row.studentId,
        courseCode: row.courseCode,
        evidence: parseJson(row.projectionJson).currentEvidence,
      }))
      const response = await current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-students?simulationStageCheckpointId=${encodeURIComponent(checkpoint.simulationStageCheckpointId)}`,
        headers: { cookie: hodLogin.cookie },
      })
      const firstStudent = response.json().items?.[0]
      console.log(JSON.stringify({
        semesterNumber,
        stageKey,
        projectionRowCount: rows.length,
        sampleRows,
        hodStatus: response.statusCode,
        hodFirstStudent: firstStudent
          ? {
              studentId: firstStudent.studentId,
              observedEvidence: firstStudent.observedEvidence,
              courseSnapshotCount: Array.isArray(firstStudent.courseSnapshots) ? firstStudent.courseSnapshots.length : 0,
              courseSnapshotEvidence: Array.isArray(firstStudent.courseSnapshots)
                ? (firstStudent.courseSnapshots as CourseSnapshot[]).slice(0, 3).map(item => ({ courseCode: item.courseCode, evidence: item.observedEvidence }))
                : [],
            }
          : null,
      }, null, 2))
    }
  } finally {
    await current.close()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})

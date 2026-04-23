import { test as base } from '../support/playwright-runtime'
import { loginWithApiContext } from '../helpers/login-as'

const PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'
const PROOF_CURRICULUM_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'
const DETERMINISTIC_SEED_NOW = '2026-03-16T00:00:00Z'
const DETERMINISTIC_RUN_SEED = 20260316
const RUN_READY_TIMEOUT_MS = 240_000
const RUN_POLL_INTERVAL_MS = 2_500

function csrfHeaders(csrfToken: string) {
  return {
    'X-AirMentor-CSRF': csrfToken,
  }
}

async function readJson(response: Response, label: string) {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${text.slice(0, 800)}`)
  }
  return text ? JSON.parse(text) : null
}

async function readProofDashboard(requestContext: { get: Function }, csrfToken: string) {
  const response = await requestContext.get(`/api/admin/batches/${PROOF_BATCH_ID}/proof-dashboard`, {
    headers: csrfHeaders(csrfToken),
  })
  return readJson(response, `Read proof dashboard for ${PROOF_BATCH_ID}`)
}

async function waitForActivatedRun(requestContext: { get: Function }, csrfToken: string, runId: string) {
  const deadline = Date.now() + RUN_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const dashboard = await readProofDashboard(requestContext, csrfToken)
    const activeRun = dashboard.activeRunDetail ?? null
    const checkpointCount = activeRun?.simulationRunId === runId
      ? Number(activeRun.checkpoints?.length ?? 0)
      : 0
    if (activeRun?.simulationRunId === runId && checkpointCount > 0) {
      return dashboard
    }
    const runPreview = Array.isArray(dashboard.proofRuns)
      ? dashboard.proofRuns.find((candidate: { simulationRunId: string }) => candidate.simulationRunId === runId) ?? null
      : null
    if (runPreview?.status === 'failed') {
      throw new Error(`Proof run ${runId} failed while waiting for checkpoint materialization.`)
    }
    await new Promise(resolve => setTimeout(resolve, RUN_POLL_INTERVAL_MS))
  }
  throw new Error(`Timed out waiting for proof run ${runId} to become the active checkpoint-bearing run.`)
}

export const test = base.extend({
  seededRun: async ({ request }, use, testInfo) => {
    const { session } = await loginWithApiContext(request, 'system-admin')
    const runLabel = `playwright-smoke:${testInfo.title}:${Date.now()}`

    const createResponse = await request.post(`/api/admin/batches/${PROOF_BATCH_ID}/proof-runs`, {
      headers: csrfHeaders(session.csrfToken),
      data: {
        curriculumImportVersionId: PROOF_CURRICULUM_IMPORT_ID,
        seed: DETERMINISTIC_RUN_SEED,
        runLabel,
        activate: false,
      },
    })
    const createdRun = await readJson(createResponse, 'Create seeded proof run')
    const runId = String(createdRun.simulationRunId)

    const activateResponse = await request.post(`/api/admin/proof-runs/${encodeURIComponent(runId)}/activate`, {
      headers: csrfHeaders(session.csrfToken),
      data: {},
    })
    await readJson(activateResponse, `Activate proof run ${runId}`)

    await waitForActivatedRun(request, session.csrfToken, runId)

    const activateSemesterResponse = await request.post(`/api/admin/proof-runs/${encodeURIComponent(runId)}/activate-semester`, {
      headers: csrfHeaders(session.csrfToken),
      data: {
        semesterNumber: 1,
      },
    })
    await readJson(activateSemesterResponse, `Activate semester 1 for ${runId}`)

    const activatedDashboard = await readProofDashboard(request, session.csrfToken)
    const activeRun = activatedDashboard.activeRunDetail ?? null
    if (!activeRun || activeRun.simulationRunId !== runId) {
      throw new Error(`Expected fresh run ${runId} to become active before the smoke test.`)
    }
    if (activeRun.activeOperationalSemester !== 1) {
      throw new Error(`Expected run ${runId} to activate semester 1, got ${String(activeRun.activeOperationalSemester)}.`)
    }

    const semesterOneEntry = Array.isArray(activeRun.checkpoints)
      ? activeRun.checkpoints.find((checkpoint: { semesterNumber: number; stageKey: string }) =>
          checkpoint.semesterNumber === 1 && String(checkpoint.stageKey).toLowerCase() === 'pre-tt1',
        )
      : null
    if (!semesterOneEntry) {
      throw new Error(`Run ${runId} does not expose the Semester 1 / pre-tt1 checkpoint required for the smoke harness.`)
    }

    await use({
      runId,
      batchId: PROOF_BATCH_ID,
      simulatedDateIso: activeRun.simulatedDateIso ?? DETERMINISTIC_SEED_NOW,
    })

    // Cleanup is best-effort: archive the throwaway run so later e2e flows do not inherit it,
    // but do not fail the completed smoke if archival itself flakes.
    try {
      const archiveResponse = await request.post(`/api/admin/proof-runs/${encodeURIComponent(runId)}/archive`, {
        headers: csrfHeaders(session.csrfToken),
        data: {},
      })
      await readJson(archiveResponse, `Archive proof run ${runId}`)
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error)
      await testInfo.attach('seeded-run-cleanup-warning', {
        body: Buffer.from(`${message}\n`, 'utf8'),
        contentType: 'text/plain',
      })
    }
  },
})

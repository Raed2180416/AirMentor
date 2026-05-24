import { test as base } from '../support/playwright-runtime'
import { loginWithApiContext } from '../helpers/login-as'
import { apiPath } from '../helpers/api-url'

const PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'
const PROOF_CURRICULUM_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'
const DETERMINISTIC_SEED_NOW = '2026-03-16T00:00:00Z'
const DETERMINISTIC_RUN_SEED = 20260320
const RUN_READY_TIMEOUT_MS = 1_800_000
const RUN_POLL_INTERVAL_MS = 2_500

type SeededRunFixture = {
  runId: string
  batchId: string
  simulatedDateIso: string
}

function csrfHeaders(csrfToken: string) {
  return {
    'X-AirMentor-CSRF': csrfToken,
    'Origin': process.env.AIRMENTOR_PW_FRONTEND_BASE_URL || 'http://127.0.0.1:5173',
  }
}

type AnyHttpResponse = {
  text(): Promise<string>
  ok: boolean | (() => boolean)
  status: number | (() => number)
}

async function readJson(response: AnyHttpResponse, label: string) {
  const text = await response.text()
  const ok = typeof response.ok === 'function' ? response.ok() : response.ok
  const status = typeof response.status === 'function' ? response.status() : response.status
  if (!ok) {
    throw new Error(`${label} failed with ${String(status)}: ${text.slice(0, 800)}`)
  }
  return text ? JSON.parse(text) : null
}

type GetContext = { get(url: string, options?: Record<string, unknown>): Promise<AnyHttpResponse> }

async function readProofDashboard(requestContext: GetContext, csrfToken: string) {
  const response = await requestContext.get(apiPath(`/api/admin/batches/${PROOF_BATCH_ID}/proof-dashboard`), {
    headers: csrfHeaders(csrfToken),
  })
  return readJson(response, `Read proof dashboard for ${PROOF_BATCH_ID}`)
}

async function readProofRunCheckpoints(requestContext: GetContext, csrfToken: string, runId: string) {
  const response = await requestContext.get(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints`), {
    headers: csrfHeaders(csrfToken),
  })
  return readJson(response, `Read proof checkpoints for ${runId}`)
}

async function waitForMaterializedRun(requestContext: GetContext, csrfToken: string, runId: string) {
  const deadline = Date.now() + RUN_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const dashboard = await readProofDashboard(requestContext, csrfToken)
    const runPreview = Array.isArray(dashboard.proofRuns)
      ? dashboard.proofRuns.find((candidate: { simulationRunId: string }) => candidate.simulationRunId === runId) ?? null
      : null
    if (runPreview?.status === 'failed') {
      throw new Error(`Proof run ${runId} failed while waiting for background materialization.`)
    }

    const checkpoints = await readProofRunCheckpoints(requestContext, csrfToken, runId)
    const checkpointCount = Array.isArray(checkpoints.items) ? checkpoints.items.length : 0
    if (runPreview?.status === 'completed' && checkpointCount > 0) {
      return dashboard
    }

    await new Promise(resolve => setTimeout(resolve, RUN_POLL_INTERVAL_MS))
  }
  throw new Error(`Timed out waiting for proof run ${runId} to finish background materialization.`)
}

async function waitForActivatedRun(requestContext: GetContext, csrfToken: string, runId: string) {
  const deadline = Date.now() + RUN_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const dashboard = await readProofDashboard(requestContext, csrfToken)
    const activeRun = dashboard.activeRunDetail ?? null
    const checkpointCount = activeRun?.simulationRunId === runId
      ? Number(activeRun.checkpoints?.length ?? 0)
      : 0
    const runPreview = Array.isArray(dashboard.proofRuns)
      ? dashboard.proofRuns.find((candidate: { simulationRunId: string }) => candidate.simulationRunId === runId) ?? null
      : null
    if (activeRun?.simulationRunId === runId && (runPreview?.status === 'completed' || runPreview?.status === 'active') && checkpointCount > 0) {
      return dashboard
    }
    if (runPreview?.status === 'failed') {
      throw new Error(`Proof run ${runId} failed while waiting for checkpoint materialization.`)
    }
    await new Promise(resolve => setTimeout(resolve, RUN_POLL_INTERVAL_MS))
  }
  throw new Error(`Timed out waiting for proof run ${runId} to become the active checkpoint-bearing run.`)
}

export const test = base.extend<{ seededRun: SeededRunFixture }>({
  seededRun: async ({ request }, use, testInfo) => {
    const { session } = await loginWithApiContext(request, 'system-admin')

    // Test isolation: the flow-11 stop spec deletes proof faculty credentials
    // by design (§L.11 + §O.3). Since Playwright specs run in the same worker
    // and share the seeded backend process, subsequent tests would fail to
    // log in as HOD / course-leader / mentor. Rehydrate credentials idempot-
    // ently before every test. No-op when creds already exist.
    const rehydrateResp = await request.post(apiPath('/api/admin/proof-sandbox/rehydrate-credentials'), {
      headers: csrfHeaders(session.csrfToken),
      data: {},
      failOnStatusCode: false,
    })
    if (!rehydrateResp.ok) {
      // If the endpoint isn't available yet (old server), surface but don't
      // hard-fail — the subsequent tests will fail loudly if creds actually
      // are missing.
      const body = await rehydrateResp.text()
      await testInfo.attach('rehydrate-credentials-warning', {
        body: Buffer.from(`rehydrate endpoint status ${rehydrateResp.status}: ${body}\n`, 'utf8'),
        contentType: 'text/plain',
      })
    }

    const runLabel = `playwright-smoke:${testInfo.title}:${Date.now()}`

    const createResponse = await request.post(apiPath(`/api/admin/batches/${PROOF_BATCH_ID}/proof-runs`), {
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

    // Fresh proof runs materialize in the background worker. Activating too
    // early can race that worker and hang the control-plane call.
    await waitForMaterializedRun(request, session.csrfToken, runId)

    const activateResponse = await request.post(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/activate`), {
      headers: csrfHeaders(session.csrfToken),
      data: {},
    })
    await readJson(activateResponse, `Activate proof run ${runId}`)

    await waitForActivatedRun(request, session.csrfToken, runId)

    const activateSemesterResponse = await request.post(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/activate-semester`), {
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

    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use({
      runId,
      batchId: PROOF_BATCH_ID,
      simulatedDateIso: activeRun.simulatedDateIso ?? DETERMINISTIC_SEED_NOW,
    })

    // Cleanup is best-effort: archive the throwaway run so later e2e flows do not inherit it,
    // but do not fail the completed smoke if archival itself flakes.
    try {
      const { session: cleanupSession } = await loginWithApiContext(request, 'system-admin')
      const archiveResponse = await request.post(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/archive`), {
        headers: csrfHeaders(cleanupSession.csrfToken),
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

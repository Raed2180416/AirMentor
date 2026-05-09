import { apiPath } from './api-url'

export function csrfHeaders(csrfToken: string) {
  return {
    'X-AirMentor-CSRF': csrfToken,
  }
}

type AnyHttpResponse = {
  text(): Promise<string>
  ok: boolean | (() => boolean)
  status: number | (() => number)
}

type RequestContext = {
  get(url: string, options?: Record<string, unknown>): Promise<AnyHttpResponse>
  post(url: string, options?: Record<string, unknown>): Promise<AnyHttpResponse>
}

export async function readJson(response: AnyHttpResponse, label: string) {
  const text = await response.text()
  const ok = typeof response.ok === 'function' ? response.ok() : response.ok
  const status = typeof response.status === 'function' ? response.status() : response.status
  if (!ok) {
    throw new Error(`${label} failed with ${String(status)}: ${text.slice(0, 800)}`)
  }
  return text ? JSON.parse(text) : null
}

export async function readProofDashboard(requestContext: RequestContext, batchId: string, csrfToken: string) {
  const response = await requestContext.get(apiPath(`/api/admin/batches/${encodeURIComponent(batchId)}/proof-dashboard`), {
    headers: csrfHeaders(csrfToken),
  })
  return readJson(response, `Read proof dashboard for ${batchId}`)
}

export async function readProofRunCheckpoints(requestContext: RequestContext, runId: string, csrfToken: string) {
  const response = await requestContext.get(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints`), {
    headers: csrfHeaders(csrfToken),
  })
  return readJson(response, `Read proof checkpoints for ${runId}`)
}

export async function readProofCheckpointDetail(requestContext: RequestContext, runId: string, checkpointId: string, csrfToken: string) {
  const response = await requestContext.get(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints/${encodeURIComponent(checkpointId)}`), {
    headers: csrfHeaders(csrfToken),
  })
  return readJson(response, `Read proof checkpoint ${checkpointId}`)
}

export async function readProofCheckpointStudentDetail(requestContext: RequestContext, runId: string, checkpointId: string, studentId: string, csrfToken: string) {
  const response = await requestContext.get(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints/${encodeURIComponent(checkpointId)}/students/${encodeURIComponent(studentId)}`), {
    headers: csrfHeaders(csrfToken),
  })
  return readJson(response, `Read proof checkpoint ${checkpointId} student ${studentId}`)
}

export async function advanceProofRunStage(requestContext: RequestContext, runId: string, csrfToken: string) {
  const response = await requestContext.post(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/advance`), {
    headers: csrfHeaders(csrfToken),
    data: { mode: 'stage' },
  })
  return readJson(response, `Advance proof run ${runId} by stage`)
}

export async function createStudentIntervention(requestContext: RequestContext, csrfToken: string, payload: Record<string, unknown>) {
  const response = await requestContext.post(apiPath('/api/admin/student-interventions'), {
    headers: csrfHeaders(csrfToken),
    data: payload,
  })
  return readJson(response, 'Create student intervention')
}

export function findCheckpoint(checkpoints: Array<{ semesterNumber: number; stageKey: string; simulationStageCheckpointId: string }>, semesterNumber: number, stageKey: string) {
  const checkpoint = checkpoints.find(item => item.semesterNumber === semesterNumber && item.stageKey === stageKey)
  if (!checkpoint) {
    throw new Error(`Missing checkpoint semester=${semesterNumber} stage=${stageKey}`)
  }
  return checkpoint
}

// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import { AirMentorApiError } from './errors'
import type { ActiveDemoWorkspacePointer } from '@web/simulation/demo-workspace-pointer'

type FetchLike = typeof fetch
const DEFAULT_API_REQUEST_TIMEOUT_MS = 30_000
type DemoWorkspacePointerProvider = () => ActiveDemoWorkspacePointer | null

function getDefaultFetch(): FetchLike {
  return globalThis.fetch.bind(globalThis) as FetchLike
}

function isMutatingRequestMethod(method: string | undefined) {
  const normalizedMethod = (method ?? 'GET').toUpperCase()
  return normalizedMethod === 'POST' || normalizedMethod === 'PUT' || normalizedMethod === 'PATCH' || normalizedMethod === 'DELETE'
}

function toHeaderRecord(headers?: HeadersInit) {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}

export type ApiAdminDirectoryScopeFilter = {
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  sectionCode?: string
}

export function buildAdminDirectoryScopeQuery(filter?: ApiAdminDirectoryScopeFilter) {
  const searchParams = new URLSearchParams()
  if (filter?.academicFacultyId) searchParams.set('academicFacultyId', filter.academicFacultyId)
  if (filter?.departmentId) searchParams.set('departmentId', filter.departmentId)
  if (filter?.branchId) searchParams.set('branchId', filter.branchId)
  if (filter?.batchId) searchParams.set('batchId', filter.batchId)
  if (filter?.sectionCode) searchParams.set('sectionCode', filter.sectionCode)
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export class AirMentorApiTransport {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike
  private readonly demoWorkspacePointerProvider?: DemoWorkspacePointerProvider
  private readonly requestTimeoutMs: number
  protected csrfToken: string | null = null

  constructor(
    baseUrl: string,
    fetchImpl?: FetchLike,
    demoWorkspacePointerProvider?: DemoWorkspacePointerProvider,
    requestTimeoutMs = DEFAULT_API_REQUEST_TIMEOUT_MS,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fetchImpl = fetchImpl ?? getDefaultFetch()
    this.demoWorkspacePointerProvider = demoWorkspacePointerProvider
    this.requestTimeoutMs = Math.max(1, requestTimeoutMs)
  }

  protected async request<T>(path: string, init?: RequestInit) {
    const hasBody = init?.body !== undefined
    const method = (init?.method ?? 'GET').toUpperCase()
    const cacheMode = init?.cache ?? (isMutatingRequestMethod(method) ? undefined : 'no-store')
    const demoWorkspacePointer = this.demoWorkspacePointerProvider?.() ?? null
    const resolvedHeaders = {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...toHeaderRecord(init?.headers),
      ...(demoWorkspacePointer ? { 'X-AirMentor-Demo-Workspace': demoWorkspacePointer.demoWorkspaceId } : {}),
      ...(isMutatingRequestMethod(method) && this.csrfToken ? { 'X-AirMentor-CSRF': this.csrfToken } : {}),
    }
    const abortController = new AbortController()
    const callerSignal = init?.signal ?? null
    const abortFromCaller = () => abortController.abort(callerSignal?.reason)
    if (callerSignal?.aborted) abortFromCaller()
    else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = setTimeout(() => abortController.abort(new Error('API request timed out')), this.requestTimeoutMs)
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        credentials: 'include',
        ...init,
        cache: cacheMode,
        headers: resolvedHeaders,
        method,
        signal: abortController.signal,
      })
    } catch (error) {
      if (abortController.signal.aborted && callerSignal?.aborted !== true) {
        throw new AirMentorApiError(0, `API request timed out after ${this.requestTimeoutMs}ms`, {
          path,
          timeoutMs: this.requestTimeoutMs,
        })
      }
      throw error
    } finally {
      clearTimeout(timeout)
      callerSignal?.removeEventListener('abort', abortFromCaller)
    }

    if (response.status === 204) {
      return undefined as T
    }

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      if (response.status === 401) {
        this.csrfToken = null
      }
      const message = typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : response.statusText || 'API request failed'
      throw new AirMentorApiError(response.status, message, payload)
    }

    if (payload && typeof payload === 'object' && 'csrfToken' in payload && typeof payload.csrfToken === 'string') {
      this.csrfToken = payload.csrfToken
    }

    return payload as T
  }
}

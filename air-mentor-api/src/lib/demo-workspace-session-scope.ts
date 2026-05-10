import { eq } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import type { RouteContext } from '../app.js'
import { demoWorkspaces } from '../db/schema.js'
import { badRequest, unauthorized } from './http-errors.js'
import { assertSafeDemoScopeName } from './demo-workspace-scope.js'

export const DEMO_WORKSPACE_HEADER = 'x-airmentor-demo-workspace'

function readSingleHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

export function readDemoWorkspaceHeader(request: FastifyRequest) {
  const value = readSingleHeaderValue(request.headers[DEMO_WORKSPACE_HEADER])
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export async function resolveActiveDemoWorkspaceForRequest(
  context: RouteContext,
  request: FastifyRequest,
) {
  const demoWorkspaceId = readDemoWorkspaceHeader(request)
  if (!demoWorkspaceId) return null

  const [workspace] = await context.db
    .select()
    .from(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))

  if (!workspace) throw unauthorized('Demo workspace is not available')
  if (workspace.status !== 'active') throw unauthorized('Demo workspace is not active')
  if (workspace.scopeKind !== 'schema' || !workspace.scopeName) {
    throw badRequest('Demo workspace is not schema scoped')
  }
  assertSafeDemoScopeName(workspace.scopeName)

  return workspace
}

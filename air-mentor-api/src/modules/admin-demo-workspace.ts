import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'

import {
  createDemoWorkspace,
  listDemoWorkspaces,
  previewDemoProvisioning,
  resetDemoWorkspace,
} from '../lib/demo-workspace-service.js'
import { parseOrThrow, requireRole } from './support.js'

export async function registerAdminDemoWorkspaceRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.get('/api/admin/demo-workspaces', {
    schema: {
      tags: ['admin-demo-workspace'],
      summary: 'List all demo workspaces',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    return listDemoWorkspaces(context)
  })

  app.post('/api/admin/demo-workspaces', {
    schema: {
      tags: ['admin-demo-workspace'],
      summary: 'Create a new demo workspace',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(
      z.object({
        name: z.string().min(1),
        ownerFacultyId: z.string().min(1).optional(),
        batchId: z.string().min(1).optional(),
      }),
      request.body,
    )
    return createDemoWorkspace(context, body)
  })

  app.post('/api/admin/demo-workspaces/:demoWorkspaceId/provision/preview', {
    schema: {
      tags: ['admin-demo-workspace'],
      summary: 'Preview demo provisioning — dry run, no writes',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(
      z.object({ demoWorkspaceId: z.string().min(1) }),
      request.params,
    )
    const body = parseOrThrow(
      z.object({
        batchId: z.string().min(1),
        termId: z.string().min(1),
        sectionLabels: z.array(z.string().min(1)).min(1),
        studentsPerSection: z.number().int().positive(),
      }),
      request.body,
    )
    return previewDemoProvisioning(context, {
      demoWorkspaceId: params.demoWorkspaceId,
      batchId: body.batchId,
      termId: body.termId,
      sectionLabels: body.sectionLabels,
      studentsPerSection: body.studentsPerSection,
    })
  })

  app.delete('/api/admin/demo-workspaces/:demoWorkspaceId', {
    schema: {
      tags: ['admin-demo-workspace'],
      summary: 'Reset (delete) all rows tagged with demoWorkspaceId',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(
      z.object({ demoWorkspaceId: z.string().min(1) }),
      request.params,
    )
    return resetDemoWorkspace(context, params.demoWorkspaceId)
  })
}

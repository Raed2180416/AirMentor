/**
 * GET/PUT /api/admin/faculty-calendar/:facultyId — the sysadmin timetable
 * workspace. Reads/writes go through the repository (which owns the 3-way
 * projection); the merge/lock/window computation is moved verbatim. `now` is
 * injected so the application layer stays clock-free.
 */
import { forbidden, notFound } from '../../../lib/http-errors.js'
import type { AdminControlPlaneRepository } from '../../ports/admin-control-plane-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import {
  addDays,
  classBlocksEqual,
  type FacultyCalendarTemplate,
  type FacultyCalendarWorkspace,
} from './faculty-calendar-domain.js'

export type ReadFacultyCalendarDeps = {
  repo: AdminControlPlaneRepository
  now: () => string
}

export type ReadFacultyCalendarInput = {
  facultyId: string
}

export async function readFacultyCalendar(
  deps: ReadFacultyCalendarDeps,
  input: ReadFacultyCalendarInput,
): Promise<UseCaseResponse> {
  const [profile, template, workspace] = await Promise.all([
    deps.repo.getFacultyProfileRef(input.facultyId),
    deps.repo.loadFacultyCalendarCanonicalTemplate(input.facultyId),
    deps.repo.loadFacultyCalendarAdminWorkspace(input.facultyId),
  ])
  if (!profile) throw notFound('Faculty profile not found')
  const publishedAt = workspace.publishedAt ?? null
  const directEditWindowEndsAt = publishedAt ? addDays(publishedAt, 14) : null
  return {
    status: 200,
    body: {
      facultyId: input.facultyId,
      template,
      workspace,
      directEditWindowEndsAt,
      classEditingLocked: !!directEditWindowEndsAt && new Date(directEditWindowEndsAt).getTime() < new Date(deps.now()).getTime(),
    },
  }
}

export type SaveFacultyCalendarDeps = {
  repo: AdminControlPlaneRepository
  emitAudit: AuditEmitter
  now: () => string
}

export type SaveFacultyCalendarInput = {
  facultyId: string
  actorRole: string
  actorFacultyId: string | null
  actorUserId: string
  body: {
    template: FacultyCalendarTemplate | null
    workspace: FacultyCalendarWorkspace
  }
}

export async function saveFacultyCalendar(
  deps: SaveFacultyCalendarDeps,
  input: SaveFacultyCalendarInput,
): Promise<UseCaseResponse> {
  const { facultyId } = input
  const [profile, currentTemplate, currentWorkspace] = await Promise.all([
    deps.repo.getFacultyProfileRef(facultyId),
    deps.repo.loadFacultyCalendarCanonicalTemplate(facultyId),
    deps.repo.loadFacultyCalendarAdminWorkspace(facultyId),
  ])
  if (!profile) throw notFound('Faculty profile not found')

  const nextWorkspace = {
    publishedAt: currentWorkspace.publishedAt ?? (input.body.template ? deps.now() : null),
    markers: input.body.workspace.markers
      .filter(marker => marker.facultyId === facultyId)
      .sort((left, right) => {
        if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
        const leftStart = left.startMinutes ?? -1
        const rightStart = right.startMinutes ?? -1
        return leftStart - rightStart
      }),
  }

  const nextDirectEditWindowEndsAt = nextWorkspace.publishedAt ? addDays(nextWorkspace.publishedAt, 14) : null
  const classEditingLocked = !!nextDirectEditWindowEndsAt && new Date(nextDirectEditWindowEndsAt).getTime() < new Date(deps.now()).getTime()
  if (classEditingLocked) {
    const currentBlocks = currentTemplate?.classBlocks ?? []
    const nextBlocks = input.body.template?.classBlocks ?? []
    if (!classBlocksEqual(currentBlocks, nextBlocks)) {
      throw forbidden('Class blocks cannot be edited after the direct-edit window closes')
    }
  }

  await Promise.all([
    deps.repo.saveFacultyCalendarTemplateProjection(facultyId, input.body.template),
    deps.repo.saveFacultyCalendarAdminWorkspaceProjection(facultyId, nextWorkspace),
  ])

  await deps.emitAudit({
    entityType: 'FacultyTimetableAdmin',
    entityId: facultyId,
    action: 'updated',
    actorRole: input.actorRole,
    actorId: input.actorFacultyId ?? input.actorUserId,
    before: {
      hasTemplate: !!currentTemplate,
      workspace: currentWorkspace,
    },
    after: {
      hasTemplate: !!input.body.template,
      workspace: nextWorkspace,
    },
    metadata: {
      directEditWindowEndsAt: nextDirectEditWindowEndsAt,
      classEditingLocked,
    },
  })

  return {
    status: 200,
    body: {
      facultyId,
      template: input.body.template,
      workspace: nextWorkspace,
      directEditWindowEndsAt: nextDirectEditWindowEndsAt,
      classEditingLocked,
    },
  }
}

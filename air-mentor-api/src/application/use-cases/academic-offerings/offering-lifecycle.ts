/**
 * Section-offering lifecycle use-cases.
 *
 *   GET   /api/admin/offerings
 *   POST  /api/admin/offerings
 *   PATCH /api/admin/offerings/:offeringId
 *
 * The list projection reuses the injected buildAcademicBootstrap; create/update
 * go through the repository. Stage columns on PATCH are pinned to the current
 * row and a stage-mutation attempt throws the same badRequest as the legacy
 * handler (the dedicated advance-stage flow owns stage transitions).
 */
import { createId } from '../../../lib/ids.js'
import { badRequest, notFound } from '../../../lib/http-errors.js'
import type { AcademicOfferingsRepository } from '../../ports/academic-offerings-repository.js'
import type { AcademicBootstrapResult, AuditEmitter, SectionOfferingRow } from './shared.js'

type ExpectVersion = (currentVersion: number, nextVersion: number, entityLabel: string, current: unknown) => void

export type OfferingWriteBody = {
  courseId: string
  termId: string
  branchId: string
  sectionCode: string
  yearLabel: string
  attendance: number
  studentCount: number
  stage: number
  stageLabel: string
  stageDescription: string
  stageColor: string
  tt1Done: boolean
  tt2Done: boolean
  tt1Locked: boolean
  tt2Locked: boolean
  quizLocked: boolean
  assignmentLocked: boolean
  finalsLocked: boolean
  pendingAction?: string | null
  status: string
}

export type ListOfferingsDeps = {
  buildAcademicBootstrap: (viewer: {
    facultyId: string | null
    roleCode: string | null
    demoWorkspaceId: string | null
  }) => Promise<AcademicBootstrapResult>
}

export type ListOfferingsInput = {
  facultyId: string | null
  roleCode: string | null
  demoWorkspaceId: string | null
}

export async function listOfferings(deps: ListOfferingsDeps, input: ListOfferingsInput): Promise<unknown> {
  const snapshot = await deps.buildAcademicBootstrap({
    facultyId: input.facultyId,
    roleCode: input.roleCode,
    demoWorkspaceId: input.demoWorkspaceId,
  })
  return { items: snapshot.offerings }
}

export type CreateOfferingDeps = {
  repo: AcademicOfferingsRepository
  emitAudit: AuditEmitter
  now: () => string
}

export type CreateOfferingInput = OfferingWriteBody & {
  actorRole: string
  actorId: string | null
}

export async function createOffering(deps: CreateOfferingDeps, input: CreateOfferingInput): Promise<unknown> {
  const offeringId = createId('offering')
  const now = deps.now()
  await deps.repo.insertOffering({
    offeringId,
    courseId: input.courseId,
    termId: input.termId,
    branchId: input.branchId,
    sectionCode: input.sectionCode,
    yearLabel: input.yearLabel,
    attendance: input.attendance,
    studentCount: input.studentCount,
    stage: input.stage,
    stageLabel: input.stageLabel,
    stageDescription: input.stageDescription,
    stageColor: input.stageColor,
    tt1Done: input.tt1Done ? 1 : 0,
    tt2Done: input.tt2Done ? 1 : 0,
    tt1Locked: input.tt1Locked ? 1 : 0,
    tt2Locked: input.tt2Locked ? 1 : 0,
    quizLocked: input.quizLocked ? 1 : 0,
    assignmentLocked: input.assignmentLocked ? 1 : 0,
    finalsLocked: input.finalsLocked ? 1 : 0,
    pendingAction: input.pendingAction ?? null,
    status: input.status,
    version: 1,
    createdAt: now,
    updatedAt: now,
  })
  const created = await deps.repo.getOfferingById(offeringId)
  await deps.emitAudit({
    entityType: 'section_offering',
    entityId: offeringId,
    action: 'CREATE',
    actorRole: input.actorRole,
    actorId: input.actorId,
    after: created,
  })
  return created
}

export type UpdateOfferingDeps = {
  repo: AcademicOfferingsRepository
  expectVersion: ExpectVersion
  emitAudit: AuditEmitter
  now: () => string
}

export type UpdateOfferingInput = OfferingWriteBody & {
  offeringId: string
  version: number
  actorRole: string
  actorId: string | null
}

export async function updateOffering(deps: UpdateOfferingDeps, input: UpdateOfferingInput): Promise<unknown> {
  const current = await deps.repo.getOfferingById(input.offeringId)
  if (!current) throw notFound('Section offering not found')
  deps.expectVersion(current.version, input.version, 'section offering', current)
  const stageMutationRequested = (
    input.stage !== current.stage
    || input.stageLabel !== current.stageLabel
    || input.stageDescription !== current.stageDescription
    || input.stageColor !== current.stageColor
  )
  if (stageMutationRequested) {
    throw badRequest('Use the dedicated advance-stage flow to change class stage state.')
  }
  await deps.repo.updateOffering(input.offeringId, {
    courseId: input.courseId,
    termId: input.termId,
    branchId: input.branchId,
    sectionCode: input.sectionCode,
    yearLabel: input.yearLabel,
    attendance: input.attendance,
    studentCount: input.studentCount,
    stage: current.stage,
    stageLabel: current.stageLabel,
    stageDescription: current.stageDescription,
    stageColor: current.stageColor,
    tt1Done: input.tt1Done ? 1 : 0,
    tt2Done: input.tt2Done ? 1 : 0,
    tt1Locked: input.tt1Locked ? 1 : 0,
    tt2Locked: input.tt2Locked ? 1 : 0,
    quizLocked: input.quizLocked ? 1 : 0,
    assignmentLocked: input.assignmentLocked ? 1 : 0,
    finalsLocked: input.finalsLocked ? 1 : 0,
    pendingAction: input.pendingAction ?? null,
    status: input.status,
    version: current.version + 1,
    updatedAt: deps.now(),
  })
  const updated = await deps.repo.getOfferingById(input.offeringId)
  await deps.emitAudit({
    entityType: 'section_offering',
    entityId: input.offeringId,
    action: 'UPDATE',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: current,
    after: updated,
  })
  return updated as SectionOfferingRow
}

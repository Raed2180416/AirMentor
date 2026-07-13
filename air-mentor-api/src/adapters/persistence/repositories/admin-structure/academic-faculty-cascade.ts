/**
 * Academic-faculty soft-delete cascade.
 *
 * Schema-coupled; the cascade block is moved verbatim from the
 * PATCH /api/admin/academic-faculties/:academicFacultyId handler in
 * modules/admin-structure.ts. Delete ordering and audit emissions are preserved.
 */
import { eq } from 'drizzle-orm'
import {
  academicTerms,
  batches,
  branches,
  courses,
  curriculumCourses,
  departments,
  facultyAppointments,
  facultyOfferingOwnerships,
  policyOverrides,
  roleGrants,
  sectionOfferings,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { emitAuditEvent } from '../../../../modules/support.js'
import { mapBatch, mapCurriculumCourse, mapPolicyOverride } from './row-mappers.js'
import { scopeReferencesDeletedBatch } from './batch-scope-context.js'
import type { AcademicFacultyCascadeSummary } from './academic-faculty-cascade-summary.js'

export async function cascadeDeleteAcademicFacultyChildren(context: RouteContext, input: {
  auth: { activeRoleGrant: { roleCode: string }; facultyId: string | null }
  params: { academicFacultyId: string }
  now: string
  cascadeSummary: AcademicFacultyCascadeSummary
}) {
  const { auth, params, now, cascadeSummary } = input

  const [
    departmentRows,
    branchRows,
    batchRows,
    termRows,
    courseRows,
    curriculumRows,
    policyRows,
    offeringRows,
    ownershipRows,
    appointmentRows,
    roleGrantRows,
  ] = await Promise.all([
    context.db.select().from(departments),
    context.db.select().from(branches),
    context.db.select().from(batches),
    context.db.select().from(academicTerms),
    context.db.select().from(courses),
    context.db.select().from(curriculumCourses),
    context.db.select().from(policyOverrides),
    context.db.select().from(sectionOfferings),
    context.db.select().from(facultyOfferingOwnerships),
    context.db.select().from(facultyAppointments),
    context.db.select().from(roleGrants),
  ])

  const departmentIds = new Set(
    departmentRows
      .filter(row => row.academicFacultyId === params.academicFacultyId)
      .map(row => row.departmentId),
  )
  const branchIds = new Set(
    branchRows
      .filter(row => departmentIds.has(row.departmentId))
      .map(row => row.branchId),
  )
  const batchIds = new Set(
    batchRows
      .filter(row => branchIds.has(row.branchId))
      .map(row => row.batchId),
  )
  const termIds = new Set(
    termRows
      .filter(row => branchIds.has(row.branchId) || (row.batchId ? batchIds.has(row.batchId) : false))
      .map(row => row.termId),
  )
  const courseIds = new Set(
    courseRows
      .filter(row => departmentIds.has(row.departmentId))
      .map(row => row.courseId),
  )
  const offeringIds = new Set(
    offeringRows
      .filter(row => branchIds.has(row.branchId) || termIds.has(row.termId) || courseIds.has(row.courseId))
      .map(row => row.offeringId),
  )

  for (const row of curriculumRows.filter(item => batchIds.has(item.batchId) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(curriculumCourses).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(curriculumCourses.curriculumCourseId, row.curriculumCourseId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumCourse',
      entityId: row.curriculumCourseId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapCurriculumCourse(row),
      after: mapCurriculumCourse(next),
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.curriculumCoursesDeleted += 1
  }

  for (const row of offeringRows.filter(item => offeringIds.has(item.offeringId) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(sectionOfferings).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(sectionOfferings.offeringId, row.offeringId))
    await emitAuditEvent(context, {
      entityType: 'section_offering',
      entityId: row.offeringId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: row,
      after: next,
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.offeringsDeleted += 1
  }

  for (const row of ownershipRows.filter(item => offeringIds.has(item.offeringId) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(facultyOfferingOwnerships).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(facultyOfferingOwnerships.ownershipId, row.ownershipId))
    await emitAuditEvent(context, {
      entityType: 'faculty_offering_ownership',
      entityId: row.ownershipId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: row,
      after: next,
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.ownershipsDeleted += 1
  }

  for (const row of courseRows.filter(item => courseIds.has(item.courseId) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(courses).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(courses.courseId, row.courseId))
    await emitAuditEvent(context, {
      entityType: 'Course',
      entityId: row.courseId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: row,
      after: next,
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.coursesDeleted += 1
  }

  for (const row of termRows.filter(item => termIds.has(item.termId) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(academicTerms).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(academicTerms.termId, row.termId))
    await emitAuditEvent(context, {
      entityType: 'AcademicTerm',
      entityId: row.termId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: row,
      after: next,
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.termsDeleted += 1
  }

  for (const row of batchRows.filter(item => batchIds.has(item.batchId) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(batches).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(batches.batchId, row.batchId))
    await emitAuditEvent(context, {
      entityType: 'Batch',
      entityId: row.batchId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapBatch(row),
      after: mapBatch(next),
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.batchesDeleted += 1
  }

  for (const row of branchRows.filter(item => branchIds.has(item.branchId) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(branches).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(branches.branchId, row.branchId))
    await emitAuditEvent(context, {
      entityType: 'Branch',
      entityId: row.branchId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: row,
      after: next,
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.branchesDeleted += 1
  }

  for (const row of departmentRows.filter(item => departmentIds.has(item.departmentId) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(departments).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(departments.departmentId, row.departmentId))
    await emitAuditEvent(context, {
      entityType: 'Department',
      entityId: row.departmentId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: row,
      after: next,
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.departmentsDeleted += 1
  }

  for (const row of policyRows.filter(item => (
    (item.scopeType === 'academic-faculty' && item.scopeId === params.academicFacultyId)
    || (item.scopeType === 'department' && departmentIds.has(item.scopeId))
    || (item.scopeType === 'branch' && branchIds.has(item.scopeId))
    || (item.scopeType === 'batch' && batchIds.has(item.scopeId))
    || (item.scopeType === 'section' && scopeReferencesDeletedBatch(item.scopeId, batchIds))
  ) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(policyOverrides).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(policyOverrides.policyOverrideId, row.policyOverrideId))
    await emitAuditEvent(context, {
      entityType: 'PolicyOverride',
      entityId: row.policyOverrideId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapPolicyOverride(row),
      after: mapPolicyOverride(next),
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.policyOverridesDeleted += 1
  }

  for (const row of appointmentRows.filter(item => (
    departmentIds.has(item.departmentId)
    || (item.branchId ? branchIds.has(item.branchId) : false)
  ) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(facultyAppointments).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(facultyAppointments.appointmentId, row.appointmentId))
    await emitAuditEvent(context, {
      entityType: 'FacultyAppointment',
      entityId: row.appointmentId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: row,
      after: next,
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.appointmentsDeleted += 1
  }

  for (const row of roleGrantRows.filter(item => (
    (item.scopeType === 'academic-faculty' && item.scopeId === params.academicFacultyId)
    || (item.scopeType === 'department' && departmentIds.has(item.scopeId))
    || (item.scopeType === 'branch' && branchIds.has(item.scopeId))
    || (item.scopeType === 'batch' && batchIds.has(item.scopeId))
    || (item.scopeType === 'section' && scopeReferencesDeletedBatch(item.scopeId, batchIds))
  ) && item.status !== 'deleted')) {
    const next = {
      ...row,
      status: 'deleted',
      version: row.version + 1,
      updatedAt: now,
    }
    await context.db.update(roleGrants).set({
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    }).where(eq(roleGrants.grantId, row.grantId))
    await emitAuditEvent(context, {
      entityType: 'RoleGrant',
      entityId: row.grantId,
      action: 'cascade_deleted',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: row,
      after: next,
      metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
    })
    cascadeSummary.roleGrantsDeleted += 1
  }
}

/**
 * Scope existence assertion + in-scope batch enumeration.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import {
  academicFaculties,
  batches,
  branches,
  departments,
  institutions,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { badRequest, notFound } from '../../../../lib/http-errors.js'
import {
  decodeSectionScopeId,
  encodeSectionScopeId,
  type ScopeTypeValue,
} from '../../../../lib/stage-policy.js'
import { scopeTypeSchema } from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'
import { listBatchSectionLabels } from './batch-scope-context.js'

export async function listBatchesInScope(context: RouteContext, scopeType: ScopeTypeValue, scopeId: string) {
  const [allBatches, allBranches, allDepartments] = await Promise.all([
    context.db.select().from(batches),
    context.db.select().from(branches),
    context.db.select().from(departments),
  ])
  const branchById = new Map(allBranches.map(row => [row.branchId, row]))
  const departmentById = new Map(allDepartments.map(row => [row.departmentId, row]))

  return allBatches.filter(batch => {
    const branch = branchById.get(batch.branchId)
    const department = branch ? departmentById.get(branch.departmentId) : null
    if (!branch || !department) return false
    if (scopeType === 'institution') return true
    if (scopeType === 'academic-faculty') return department.academicFacultyId === scopeId
    if (scopeType === 'department') return department.departmentId === scopeId
    if (scopeType === 'branch') return branch.branchId === scopeId
    return batch.batchId === scopeId
  })
}

export async function assertScopeExists(context: RouteContext, scopeType: z.infer<typeof scopeTypeSchema>, scopeId: string) {
  if (scopeType === 'institution') {
    const [row] = await context.db.select().from(institutions).where(eq(institutions.institutionId, scopeId))
    if (!row) throw notFound('Institution scope not found')
    return row
  }
  if (scopeType === 'academic-faculty') {
    const [row] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, scopeId))
    if (!row) throw notFound('Academic faculty scope not found')
    return row
  }
  if (scopeType === 'department') {
    const [row] = await context.db.select().from(departments).where(eq(departments.departmentId, scopeId))
    if (!row) throw notFound('Department scope not found')
    return row
  }
  if (scopeType === 'branch') {
    const [row] = await context.db.select().from(branches).where(eq(branches.branchId, scopeId))
    if (!row) throw notFound('Branch scope not found')
    return row
  }
  if (scopeType === 'section') {
    const parsed = decodeSectionScopeId(scopeId)
    if (!parsed) throw badRequest('Section scope ids must use the canonical <batchId>::<SECTION> format.')
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, parsed.batchId))
    if (!batch) throw notFound('Section scope not found')
    const knownSectionLabels = listBatchSectionLabels(batch)
    if (!knownSectionLabels.includes(parsed.sectionCode)) throw notFound('Section scope not found')
    return {
      batch,
      sectionCode: parsed.sectionCode,
      scopeId: encodeSectionScopeId(batch.batchId, parsed.sectionCode),
    }
  }
  const [row] = await context.db.select().from(batches).where(eq(batches.batchId, scopeId))
  if (!row) throw notFound('Batch scope not found')
  return row
}

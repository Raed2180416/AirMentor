/**
 * buildPublicFacultyList — the unauthenticated public faculty directory,
 * projected from the academic bootstrap snapshot. DB-touching (via
 * buildAcademicBootstrap), so it lives in the persistence layer and keeps the
 * `context: RouteContext` signature. Moved verbatim from modules/academic.ts.
 */
import type { RouteContext } from '../../../../app.js'
import {
  publicFacultyResponseSchema,
  type PublicFacultyResponse,
} from '../../../../application/use-cases/academic/academic-task-contracts.js'
import { buildAcademicBootstrap } from './build-academic-bootstrap.js'

export async function buildPublicFacultyList(context: RouteContext): Promise<PublicFacultyResponse> {
  const snapshot = await buildAcademicBootstrap(context)
  return publicFacultyResponseSchema.parse({
    items: snapshot.faculty.map(account => ({
      facultyId: account.facultyId,
      username: account.username,
      email: account.email,
      name: account.name,
      displayName: account.name,
      designation: account.roleTitle,
      dept: account.dept,
      departmentCode: account.dept,
      roleTitle: account.roleTitle,
      allowedRoles: account.allowedRoles,
    })),
  })
}

/**
 * Drizzle read for GET /api/admin/search — the multi-table scan dataset. Query
 * set moved verbatim from the legacy handler (`context.db` -> injected `db`).
 */
import {
  academicFaculties,
  adminRequests,
  batches,
  branches,
  courses,
  departments,
  facultyProfiles,
  students,
  userAccounts,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type { SearchDataset } from '../../../../application/use-cases/admin-control-plane/search-domain.js'

export async function loadSearchDataset(db: AppDb): Promise<SearchDataset> {
  const [
    academicFacultyRows,
    departmentRows,
    branchRows,
    batchRows,
    studentRows,
    facultyRows,
    userRows,
    courseRows,
    requestRows,
  ] = await Promise.all([
    db.select().from(academicFaculties),
    db.select().from(departments),
    db.select().from(branches),
    db.select().from(batches),
    db.select().from(students),
    db.select().from(facultyProfiles),
    db.select().from(userAccounts),
    db.select().from(courses),
    db.select().from(adminRequests),
  ])

  return {
    academicFacultyRows,
    departmentRows,
    branchRows,
    batchRows,
    studentRows,
    facultyRows,
    userRows,
    courseRows,
    requestRows,
  }
}

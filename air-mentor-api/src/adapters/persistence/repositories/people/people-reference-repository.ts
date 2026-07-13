/**
 * Drizzle loader for the people reference-data aggregate. The 8-way parallel
 * read + Map construction is moved verbatim from modules/people.ts
 * (loadPeopleReferenceData); the Maps are parameterised with the framework-free
 * domain row types so the application layer never touches db/schema.
 */
import {
  academicFaculties,
  academicTerms,
  batches,
  branches,
  departments,
  facultyOfferingOwnerships,
  institutions,
  sectionOfferings,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type {
  AcademicFacultyRow,
  BatchRow,
  BranchRow,
  DepartmentRow,
  OfferingRow,
  PeopleReferenceData,
  TermRow,
} from '../../../../application/use-cases/people/people-domain.js'

export async function loadReferenceData(db: AppDb): Promise<PeopleReferenceData> {
  const [
    institution,
    academicFacultyRows,
    departmentRows,
    branchRows,
    batchRows,
    termRows,
    offeringRows,
    ownershipRows,
  ] = await Promise.all([
    db.select().from(institutions).then(rows => rows[0] ?? null),
    db.select().from(academicFaculties),
    db.select().from(departments),
    db.select().from(branches),
    db.select().from(batches),
    db.select().from(academicTerms),
    db.select().from(sectionOfferings),
    db.select().from(facultyOfferingOwnerships),
  ])
  return {
    institution,
    academicFacultyById: new Map<string, AcademicFacultyRow>(academicFacultyRows.map(row => [row.academicFacultyId, row])),
    departmentById: new Map<string, DepartmentRow>(departmentRows.map(row => [row.departmentId, row])),
    branchById: new Map<string, BranchRow>(branchRows.map(row => [row.branchId, row])),
    batchById: new Map<string, BatchRow>(batchRows.map(row => [row.batchId, row])),
    termById: new Map<string, TermRow>(termRows.map(row => [row.termId, row])),
    offeringById: new Map<string, OfferingRow>(offeringRows.map(row => [row.offeringId, row])),
    ownerships: ownershipRows,
  }
}

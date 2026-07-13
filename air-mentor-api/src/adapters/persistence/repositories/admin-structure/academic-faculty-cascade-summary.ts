/**
 * Academic-faculty cascade-delete summary counters.
 *
 * Moved verbatim from modules/admin-structure.ts (AcademicFacultyCascadeSummary
 * type + createAcademicFacultyCascadeSummary factory). Kept schema-free but sits
 * beside the cascade adapter it belongs to.
 */
export type AcademicFacultyCascadeSummary = {
  departmentsDeleted: number
  branchesDeleted: number
  batchesDeleted: number
  termsDeleted: number
  coursesDeleted: number
  curriculumCoursesDeleted: number
  policyOverridesDeleted: number
  offeringsDeleted: number
  ownershipsDeleted: number
  appointmentsDeleted: number
  roleGrantsDeleted: number
}

export function createAcademicFacultyCascadeSummary(): AcademicFacultyCascadeSummary {
  return {
    departmentsDeleted: 0,
    branchesDeleted: 0,
    batchesDeleted: 0,
    termsDeleted: 0,
    coursesDeleted: 0,
    curriculumCoursesDeleted: 0,
    policyOverridesDeleted: 0,
    offeringsDeleted: 0,
    ownershipsDeleted: 0,
    appointmentsDeleted: 0,
    roleGrantsDeleted: 0,
  }
}

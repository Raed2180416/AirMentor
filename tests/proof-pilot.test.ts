import { describe, expect, it } from 'vitest'
import {
  CANONICAL_PROOF_BATCH_ID,
  resolveAdminDirectoryScopeFilter,
  resolveCanonicalProofBatch,
  routeTargetsCanonicalProofHierarchy,
  shouldResolveCanonicalProofRoute,
} from '../src/proof-pilot'
import type { LiveAdminDataset, LiveAdminRoute } from '../src/system-admin-live-data'

const dataset: Pick<LiveAdminDataset, 'batches'> = {
  batches: [
    {
      batchId: CANONICAL_PROOF_BATCH_ID,
      branchId: 'branch_mnc_btech',
      admissionYear: 2023,
      batchLabel: '2023 Proof',
      currentSemester: 6,
      sectionLabels: ['A', 'B'],
      status: 'active',
      version: 1,
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
    {
      batchId: 'batch_2022',
      branchId: 'branch_mnc_btech',
      admissionYear: 2022,
      batchLabel: '2022',
      currentSemester: 1,
      sectionLabels: ['A', 'B'],
      status: 'active',
      version: 1,
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
  ],
}

describe('proof pilot helpers', () => {
  it('resolves the canonical proof batch from the live dataset', () => {
    expect(resolveCanonicalProofBatch(dataset)?.batchLabel).toBe('2023 Proof')
  })

  it('marks bare or proof-hierarchy faculty routes as canonical-proof targets', () => {
    expect(routeTargetsCanonicalProofHierarchy({ section: 'faculties' })).toBe(true)
    expect(routeTargetsCanonicalProofHierarchy({
      section: 'faculties',
      academicFacultyId: 'academic_faculty_engineering_and_technology',
      departmentId: 'dept_cse',
      branchId: 'branch_mnc_btech',
    })).toBe(true)
  })

  it('does not mark unrelated faculty routes as canonical-proof targets', () => {
    const unrelatedRoute: LiveAdminRoute = {
      section: 'faculties',
      academicFacultyId: 'academic_faculty_business',
      departmentId: 'dept_finance',
      branchId: 'branch_bba',
    }
    expect(routeTargetsCanonicalProofHierarchy(unrelatedRoute)).toBe(false)
    expect(shouldResolveCanonicalProofRoute(unrelatedRoute, dataset)).toBe(false)
  })

  it('forces the canonical proof route when the selected proof batch is missing or invalid', () => {
    expect(shouldResolveCanonicalProofRoute({ section: 'faculties' }, dataset)).toBe(true)
    expect(shouldResolveCanonicalProofRoute({
      section: 'faculties',
      academicFacultyId: 'academic_faculty_engineering_and_technology',
      departmentId: 'dept_cse',
      branchId: 'branch_mnc_btech',
      batchId: 'missing_batch',
    }, dataset)).toBe(true)
  })

  it('does not auto-resolve when the user has deliberately selected a valid non-proof batch', () => {
    expect(shouldResolveCanonicalProofRoute({
      section: 'faculties',
      academicFacultyId: 'academic_faculty_engineering_and_technology',
      departmentId: 'dept_cse',
      branchId: 'branch_mnc_btech',
      batchId: 'batch_2022',
    }, dataset)).toBe(false)
  })

  it('defaults directory scoping to the canonical proof hierarchy on proof-mode faculty routes', () => {
    expect(resolveAdminDirectoryScopeFilter({
      route: { section: 'faculties' },
    })).toEqual({
      academicFacultyId: 'academic_faculty_engineering_and_technology',
      departmentId: 'dept_cse',
      branchId: 'branch_mnc_btech',
      batchId: 'batch_branch_mnc_btech_2023',
      sectionCode: undefined,
    })
  })

  it('preserves explicit route and carried registry scopes for directory filtering', () => {
    expect(resolveAdminDirectoryScopeFilter({
      route: {
        section: 'faculties',
        academicFacultyId: 'academic_faculty_engineering_and_technology',
        departmentId: 'dept_cse',
        branchId: 'branch_mnc_btech',
        batchId: 'batch_2022',
      },
      selectedSectionCode: 'B',
    })).toEqual({
      academicFacultyId: 'academic_faculty_engineering_and_technology',
      departmentId: 'dept_cse',
      branchId: 'branch_mnc_btech',
      batchId: 'batch_2022',
      sectionCode: 'B',
    })

    expect(resolveAdminDirectoryScopeFilter({
      route: { section: 'students' },
      registryScope: {
        academicFacultyId: 'academic_faculty_engineering_and_technology',
        departmentId: 'dept_cse',
        branchId: 'branch_mnc_btech',
        batchId: CANONICAL_PROOF_BATCH_ID,
        sectionCode: 'A',
      },
    })).toEqual({
      academicFacultyId: 'academic_faculty_engineering_and_technology',
      departmentId: 'dept_cse',
      branchId: 'branch_mnc_btech',
      batchId: CANONICAL_PROOF_BATCH_ID,
      sectionCode: 'A',
    })
  })
})

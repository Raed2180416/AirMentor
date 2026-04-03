import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  formatFacultyAppointmentLabel,
  formatFacultyGrantScopeLabel,
  formatRecordProofBanner,
  shouldHydrateHierarchyEditor,
  upsertAcademicFacultyRecord,
  upsertBatchRecord,
  upsertBranchRecord,
  upsertDepartmentRecord,
} from '../src/system-admin-live-app'
import type { LiveAdminDataset } from '../src/system-admin-live-data'

function makeDataset(): LiveAdminDataset {
  return {
    institution: null,
    academicFaculties: [{
      academicFacultyId: 'af_1',
      institutionId: 'inst_1',
      code: 'ENG',
      name: 'Engineering',
      overview: null,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    departments: [],
    branches: [{
      branchId: 'branch_1',
      departmentId: 'dept_1',
      code: 'CSE',
      name: 'Computer Science',
      programLevel: 'UG',
      semesterCount: 8,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    batches: [{
      batchId: 'batch_1',
      branchId: 'branch_1',
      admissionYear: 2023,
      batchLabel: '2023',
      currentSemester: 5,
      sectionLabels: ['A'],
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    terms: [],
    facultyMembers: [],
    students: [],
    courses: [],
    curriculumCourses: [],
    policyOverrides: [],
    offerings: [],
    ownerships: [],
    requests: [],
    reminders: [],
  }
}

describe('system-admin-live-detail formatting', () => {
  it('renders the canonical provenance banner when record-level proof fields are present', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
      formatRecordProofBanner({
        scopeDescriptor: {
          scopeType: 'section',
          scopeId: 'batch_2022::A',
          label: 'Section A',
          batchId: 'batch_2022',
          sectionCode: 'A',
          branchName: 'Computer Science and Engineering',
          simulationRunId: null,
          simulationStageCheckpointId: null,
          studentId: 'student_1',
        },
        resolvedFrom: {
          kind: 'policy-override',
          scopeType: 'batch',
          scopeId: 'batch_2022',
          label: 'Batch 2022 override',
        },
        scopeMode: 'section',
        countSource: 'operational-semester',
        activeOperationalSemester: 5,
      }),
    ))

    expect(markup).toContain('Scope Section A')
    expect(markup).toContain('resolved from Batch 2022 override')
    expect(markup).toContain('operational semester 5')
  })

  it('renders the availability message when proof counts are unavailable', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
      formatRecordProofBanner({
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'student_1',
          label: 'Student Aisha Khan',
          batchId: 'batch_2022',
          sectionCode: 'A',
          branchName: 'Computer Science and Engineering',
          simulationRunId: null,
          simulationStageCheckpointId: null,
          studentId: 'student_1',
        },
        resolvedFrom: {
          kind: 'default-policy',
          scopeType: 'proof',
          scopeId: null,
          label: 'No authoritative proof snapshot',
        },
        scopeMode: 'proof',
        countSource: 'unavailable',
        activeOperationalSemester: null,
      }),
    ))

    expect(markup).toContain('No authoritative proof count source is available.')
    expect(markup).toContain('No authoritative proof snapshot')
  })

  it('prefers enriched faculty labels over raw identifiers', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
      createElement('span', null, formatFacultyGrantScopeLabel({
        grantId: 'grant_1',
        facultyId: 'fac_1',
        roleCode: 'MENTOR',
        scopeType: 'branch',
        scopeId: 'branch_cse',
        scopeLabel: 'Computer Science and Engineering',
      })),
      createElement('span', null, formatFacultyAppointmentLabel({
        appointmentId: 'appt_1',
        facultyId: 'fac_1',
        departmentId: 'dept_cse',
        departmentName: 'Computer Science and Engineering',
        departmentCode: 'CSE',
        branchId: 'branch_cse',
        branchName: 'Computer Science and Engineering',
        branchCode: 'CSE',
      })),
    ))

    expect(markup).toContain('Computer Science and Engineering')
    expect(markup).not.toContain('branch_cse')
    expect(markup).not.toContain('dept_cse')
  })

  it('upserts updated academic faculty records into the local admin dataset immediately', () => {
    const next = upsertAcademicFacultyRecord(makeDataset(), {
      academicFacultyId: 'af_1',
      institutionId: 'inst_1',
      code: 'ENG',
      name: 'Engineering Updated',
      overview: 'Updated overview',
      status: 'active',
      version: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    expect(next.academicFaculties).toHaveLength(1)
    expect(next.academicFaculties[0]?.name).toBe('Engineering Updated')
    expect(next.academicFaculties[0]?.version).toBe(2)
  })

  it('upserts updated department records into the local admin dataset immediately', () => {
    const next = upsertDepartmentRecord({
      ...makeDataset(),
      departments: [{
        departmentId: 'dept_1',
        academicFacultyId: 'af_1',
        code: 'CSE',
        name: 'Computer Science',
        status: 'active',
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }, {
      departmentId: 'dept_1',
      academicFacultyId: 'af_1',
      code: 'CSE',
      name: 'Computer Science Updated',
      status: 'active',
      version: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    expect(next.departments).toHaveLength(1)
    expect(next.departments[0]?.name).toBe('Computer Science Updated')
    expect(next.departments[0]?.version).toBe(2)
  })

  it('upserts updated branch records into the local admin dataset immediately', () => {
    const next = upsertBranchRecord(makeDataset(), {
      branchId: 'branch_1',
      departmentId: 'dept_1',
      code: 'CSE',
      name: 'Computer Science Updated',
      programLevel: 'UG',
      semesterCount: 8,
      status: 'active',
      version: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    expect(next.branches).toHaveLength(1)
    expect(next.branches[0]?.name).toBe('Computer Science Updated')
    expect(next.branches[0]?.version).toBe(2)
  })

  it('upserts updated batch records into the local admin dataset immediately', () => {
    const next = upsertBatchRecord(makeDataset(), {
      batchId: 'batch_1',
      branchId: 'branch_1',
      admissionYear: 2023,
      batchLabel: '2023 Proof',
      currentSemester: 6,
      sectionLabels: ['A', 'B'],
      status: 'active',
      version: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    expect(next.batches).toHaveLength(1)
    expect(next.batches[0]?.batchLabel).toBe('2023 Proof')
    expect(next.batches[0]?.currentSemester).toBe(6)
    expect(next.batches[0]?.sectionLabels).toEqual(['A', 'B'])
  })

  it('keeps hierarchy editor hydration disabled while the matching dialog is open', () => {
    expect(shouldHydrateHierarchyEditor('branch', 'branch')).toBe(false)
    expect(shouldHydrateHierarchyEditor('department', 'department')).toBe(false)
    expect(shouldHydrateHierarchyEditor('academic-faculty', 'academic-faculty')).toBe(false)
    expect(shouldHydrateHierarchyEditor('batch', 'batch')).toBe(false)
    expect(shouldHydrateHierarchyEditor('branch', 'department')).toBe(true)
    expect(shouldHydrateHierarchyEditor(null, 'branch')).toBe(true)
  })
})

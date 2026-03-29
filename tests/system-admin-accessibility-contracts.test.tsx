import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  AdminDetailTabPanel,
  AdminDetailTabs,
  buildAdminActiveScopeChain,
  buildAdminSectionScopeId,
  getAdminWorkspaceSnapshotKey,
} from '../src/system-admin-live-app'
import {
  describeGovernanceResolutionMessage,
  SystemAdminHierarchyWorkspaceTabs,
} from '../src/system-admin-faculties-workspace'

const institution = {
  institutionId: 'inst_1',
  name: 'AirMentor University',
  timezone: 'Asia/Kolkata',
  academicYearStartMonth: 7,
  status: 'active',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const academicFaculty = {
  academicFacultyId: 'af_1',
  institutionId: 'inst_1',
  code: 'ENG',
  name: 'Engineering',
  overview: null,
  status: 'active',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const department = {
  departmentId: 'dept_1',
  institutionId: 'inst_1',
  academicFacultyId: 'af_1',
  code: 'CSE',
  name: 'Computer Science',
  status: 'active',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const branch = {
  branchId: 'branch_1',
  departmentId: 'dept_1',
  code: 'CSE',
  name: 'Computer Science and Engineering',
  programLevel: 'UG',
  semesterCount: 8,
  status: 'active',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const batch = {
  batchId: 'batch_2022',
  branchId: 'branch_1',
  admissionYear: 2022,
  batchLabel: '2022',
  currentSemester: 5,
  sectionLabels: ['A', 'B'],
  status: 'active',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('system-admin accessibility contracts', () => {
  it('renders admin detail tabs with explicit tab-to-panel linkage', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
      createElement(AdminDetailTabs, {
        activeTab: 'profile',
        onChange: () => {},
        ariaLabel: 'Student detail sections',
        idBase: 'student-detail',
        tabs: [
          { id: 'profile', label: 'Profile' },
          { id: 'history', label: 'History', disabled: true },
        ],
      }),
      createElement(AdminDetailTabPanel, {
        idBase: 'student-detail',
        tabId: 'profile',
        children: createElement('div', null, 'Profile panel'),
      }),
    ))

    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('id="student-detail-tab-profile"')
    expect(markup).toContain('aria-controls="student-detail-panel-profile"')
    expect(markup).toContain('id="student-detail-panel-profile"')
    expect(markup).toContain('role="tabpanel"')
    expect(markup).toContain('aria-labelledby="student-detail-tab-profile"')
  })

  it('renders hierarchy workspace tabs with explicit panel linkage', () => {
    const markup = renderToStaticMarkup(createElement(SystemAdminHierarchyWorkspaceTabs, {
      tabs: [
        { id: 'overview', label: 'Overview', icon: createElement('span', null, 'O') },
        { id: 'policy', label: 'Policy', icon: createElement('span', null, 'P') },
      ],
      activeTab: 'overview',
      onChange: () => {},
    }))

    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('id="university-tab-overview"')
    expect(markup).toContain('aria-controls="university-panel-overview"')
    expect(markup).toContain('aria-selected="true"')
  })

  it('builds section as the active governance scope with a canonical scope id', () => {
    const scopeChain = buildAdminActiveScopeChain({
      institution,
      academicFaculty,
      department,
      branch,
      batch,
      sectionCode: ' a ',
    })

    expect(scopeChain.at(-1)).toEqual({
      scopeType: 'section',
      scopeId: buildAdminSectionScopeId(batch.batchId, 'A'),
      label: 'Section A',
    })
    expect(scopeChain.at(-2)).toEqual({
      scopeType: 'batch',
      scopeId: batch.batchId,
      label: 'Batch 2022',
    })
  })

  it('describes governance inheritance with section-aware wording', () => {
    expect(describeGovernanceResolutionMessage({ scopeType: 'section', scopeId: 'batch_2022::A', label: 'Section A' })).toBe(
      'Resolved from Section scope. Applied overrides inherit through the active hierarchy chain, ending at section.',
    )
  })

  it('distinguishes batch and section snapshots without changing the route shape', () => {
    const route = {
      section: 'faculties' as const,
      academicFacultyId: academicFaculty.academicFacultyId,
      departmentId: department.departmentId,
      branchId: branch.branchId,
      batchId: batch.batchId,
    }

    const batchSnapshotKey = getAdminWorkspaceSnapshotKey({
      route,
      universityTab: 'overview',
      selectedSectionCode: null,
    })
    const sectionSnapshotKey = getAdminWorkspaceSnapshotKey({
      route,
      universityTab: 'overview',
      selectedSectionCode: 'A',
    })

    expect(batchSnapshotKey).toBe('#/admin/faculties/af_1/departments/dept_1/branches/branch_1/batches/batch_2022::overview::')
    expect(sectionSnapshotKey).toBe('#/admin/faculties/af_1/departments/dept_1/branches/branch_1/batches/batch_2022::overview::A')
    expect(sectionSnapshotKey).not.toBe(batchSnapshotKey)
  })
})

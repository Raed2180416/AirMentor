import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  formatFacultyAppointmentLabel,
  formatFacultyGrantScopeLabel,
  formatRecordProofBanner,
} from '../src/system-admin-live-app'

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
})

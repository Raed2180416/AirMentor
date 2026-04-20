import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ApiAdminRequestDetail, ApiAdminRequestSummary } from '../src/api/types'
import { T } from '../src/data'
import { SystemAdminRequestWorkspace } from '../src/system-admin-request-workspace'

function makeRequest(status: ApiAdminRequestSummary['status']): ApiAdminRequestSummary {
  return {
    adminRequestId: `request_${status.replace(/\s+/g, '_').toLowerCase()}`,
    requestType: 'Mentor Reassignment',
    scopeType: 'batch',
    scopeId: 'batch_2022',
    targetEntityRefs: [{ entityType: 'Batch', entityId: 'batch_2022' }],
    priority: 'P2',
    status,
    requestedByRole: 'HOD',
    requestedByFacultyId: 'fac_hod_1',
    ownedByRole: 'SYSTEM_ADMIN',
    ownedByFacultyId: 'fac_admin_1',
    summary: 'Review section mentor ownership',
    details: 'Reassign mentorship for section A before TT2 closes.',
    notesThreadId: 'thread_1',
    dueAt: '2026-04-20T00:00:00.000Z',
    slaPolicyCode: 'default',
    decision: null,
    payload: {},
    version: 1,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
    requesterName: 'Prof. HoD',
    ownerName: 'System Admin',
  }
}

function makeRequestDetail(request: ApiAdminRequestSummary): ApiAdminRequestDetail {
  return {
    ...request,
    notes: [],
    transitions: [],
  }
}

function renderRequestWorkspace(status: ApiAdminRequestSummary['status']) {
  const selectedRequest = makeRequest(status)
  return renderToStaticMarkup(createElement(SystemAdminRequestWorkspace, {
    requests: [selectedRequest],
    selectedRequestId: selectedRequest.adminRequestId,
    requestDetailLoading: false,
    selectedRequest,
    requestDetail: makeRequestDetail(selectedRequest),
    requestBusyId: '',
    toneColor: T.warning,
    onSelectRequest: () => {},
    onAdvanceRequest: () => {},
    onRequestInfoRequest: () => {},
    onRejectRequest: () => {},
  }))
}

describe('system-admin request workspace transitions', () => {
  it('shows Needs Info and Reject controls for in-review requests', () => {
    const markup = renderRequestWorkspace('In Review')

    expect(markup).toContain('Approve')
    expect(markup).toContain('Needs Info')
    expect(markup).toContain('Reject')
  })

  it('keeps reject available for new requests without showing the in-review side action', () => {
    const markup = renderRequestWorkspace('New')

    expect(markup).toContain('Take Review')
    expect(markup).toContain('Reject')
    expect(markup).not.toContain('Needs Info</button>')
  })

  it('offers close for rejected requests and hides reject/request-info actions', () => {
    const markup = renderRequestWorkspace('Rejected')

    expect(markup).toContain('Close')
    expect(markup).not.toContain('Reject</button>')
    expect(markup).not.toContain('Needs Info</button>')
  })
})

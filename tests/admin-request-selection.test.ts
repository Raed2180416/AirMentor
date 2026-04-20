import { describe, expect, it } from 'vitest'
import type { ApiAdminRequestDetail, ApiAdminRequestSummary } from '../src/api/types'
import { resolveSelectedAdminRequest } from '../src/admin-request-selection'

function makeSummary(overrides: Partial<ApiAdminRequestSummary> = {}): ApiAdminRequestSummary {
  return {
    adminRequestId: 'request_1',
    requestType: 'Mentor Reassignment',
    scopeType: 'batch',
    scopeId: 'batch_2025',
    targetEntityRefs: [],
    priority: 'P2',
    status: 'New',
    requestedByRole: 'HOD',
    requestedByFacultyId: 'fac_hod',
    ownedByRole: 'SYSTEM_ADMIN',
    ownedByFacultyId: 'fac_admin',
    summary: 'Grant additional mentor mapping coverage',
    details: 'Need temporary mentor reassignment capacity for section update.',
    notesThreadId: 'thread_1',
    dueAt: '2026-04-20T00:00:00.000Z',
    slaPolicyCode: 'default',
    decision: null,
    payload: {},
    version: 1,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
    requesterName: 'Dr. Kavitha Rao',
    ownerName: 'System Admin',
    ...overrides,
  }
}

function makeDetail(overrides: Partial<ApiAdminRequestDetail> = {}): ApiAdminRequestDetail {
  const summary = makeSummary(overrides)
  return {
    ...summary,
    notes: [],
    transitions: [],
  }
}

describe('resolveSelectedAdminRequest', () => {
  it('prefers the newer detail record when it is ahead of the cached summary', () => {
    const summary = makeSummary({ status: 'New', version: 1 })
    const detail = makeDetail({ status: 'In Review', version: 2 })

    expect(resolveSelectedAdminRequest(summary, detail)).toBe(detail)
  })

  it('keeps the newer summary when the detail lags behind', () => {
    const summary = makeSummary({ status: 'Approved', version: 3 })
    const detail = makeDetail({ status: 'In Review', version: 2 })

    expect(resolveSelectedAdminRequest(summary, detail)).toBe(summary)
  })

  it('ignores mismatched detail records from another request id', () => {
    const summary = makeSummary({ adminRequestId: 'request_1' })
    const detail = makeDetail({ adminRequestId: 'request_2', status: 'Closed', version: 9 })

    expect(resolveSelectedAdminRequest(summary, detail)).toBe(summary)
  })

  it('falls back cleanly when only one request record is available', () => {
    const summary = makeSummary({ status: 'Rejected' })
    const detail = makeDetail({ status: 'Implemented' })

    expect(resolveSelectedAdminRequest(summary, null)).toBe(summary)
    expect(resolveSelectedAdminRequest(null, detail)).toBe(detail)
    expect(resolveSelectedAdminRequest(null, null)).toBeNull()
  })
})

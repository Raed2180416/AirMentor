import type { ApiAdminRequestDetail, ApiAdminRequestSummary } from './api/types'
import { T, mono, sora } from './data'
import {
  EmptyState,
  EntityButton,
  InfoBanner,
  SectionHeading,
  formatDateTime,
} from './system-admin-ui'
import { Btn, Card, Chip } from './ui-primitives'

type SystemAdminRequestWorkspaceProps = {
  requests: ApiAdminRequestSummary[]
  selectedRequestId?: string
  requestDetailLoading: boolean
  selectedRequest: ApiAdminRequestSummary | null
  requestDetail: ApiAdminRequestDetail | null
  requestBusyId: string
  toneColor: string
  onSelectRequest: (requestId: string) => void
  onAdvanceRequest: (request: ApiAdminRequestSummary) => void
}

export function SystemAdminRequestWorkspace({
  requests,
  selectedRequestId,
  requestDetailLoading,
  selectedRequest,
  requestDetail,
  requestBusyId,
  toneColor,
  onSelectRequest,
  onAdvanceRequest,
}: SystemAdminRequestWorkspaceProps) {
  return (
    <>
      <SectionHeading
        title="Requests"
        eyebrow="Workflow"
        caption="HoD-issued permanent changes move through admin review, approval, implementation, and closure."
        toneColor={toneColor}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '0.96fr 1.04fr', gap: 16, alignItems: 'start' }}>
        <Card style={{ padding: 18, display: 'grid', gap: 10, alignContent: 'start' }}>
          {requests.map(request => (
            <EntityButton
              key={request.adminRequestId}
              selected={selectedRequestId === request.adminRequestId}
              onClick={() => onSelectRequest(request.adminRequestId)}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{request.summary}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {request.requestType} · {request.scopeType}:{request.scopeId} · due {formatDateTime(request.dueAt)}
                  </div>
                </div>
                <Chip color={request.status === 'Closed' ? T.dim : request.status === 'Implemented' ? T.success : T.warning}>
                  {request.status}
                </Chip>
              </div>
            </EntityButton>
          ))}
        </Card>

        <Card style={{ padding: 18, display: 'grid', gap: 14, alignContent: 'start' }}>
          {!selectedRequestId ? (
            <EmptyState title="Select a request" body="Choose a request from the left to inspect details, linked targets, and implementation status." />
          ) : requestDetailLoading && !selectedRequest ? (
            <InfoBanner message="Loading request details…" />
          ) : !selectedRequest ? (
            <EmptyState title="Request not found" body="The selected request could not be loaded. Refresh the workspace or choose another request." />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{selectedRequest.summary}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6, maxWidth: 720 }}>{selectedRequest.details}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip color={selectedRequest.status === 'Closed' ? T.dim : selectedRequest.status === 'Implemented' ? T.success : T.warning}>
                    {selectedRequest.status}
                  </Chip>
                  {['New', 'In Review', 'Needs Info', 'Approved', 'Implemented'].includes(selectedRequest.status) ? (
                    <Btn onClick={() => onAdvanceRequest(selectedRequest)} disabled={requestBusyId === selectedRequest.adminRequestId}>
                      {selectedRequest.status === 'New'
                        ? 'Take Review'
                        : selectedRequest.status === 'Approved'
                          ? 'Mark Implemented'
                          : selectedRequest.status === 'Implemented'
                            ? 'Close'
                            : 'Approve'}
                    </Btn>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Request Type: <span style={{ color: T.text }}>{selectedRequest.requestType}</span></div>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Priority: <span style={{ color: T.text }}>{selectedRequest.priority}</span></div>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Requester: <span style={{ color: T.text }}>{selectedRequest.requesterName ?? selectedRequest.requestedByFacultyId}</span></div>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Current Owner: <span style={{ color: T.text }}>{selectedRequest.ownerName ?? selectedRequest.ownedByFacultyId ?? 'Unassigned'}</span></div>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Due: <span style={{ color: T.text }}>{formatDateTime(selectedRequest.dueAt)}</span></div>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Updated: <span style={{ color: T.text }}>{formatDateTime(selectedRequest.updatedAt)}</span></div>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Linked Targets</div>
                {selectedRequest.targetEntityRefs.length === 0 ? (
                  <div style={{ ...mono, fontSize: 11, color: T.muted }}>No explicit target entities were attached to this request.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedRequest.targetEntityRefs.map(ref => (
                      <Chip key={`${ref.entityType}:${ref.entityId}`} color={T.accent}>
                        {ref.entityType}:{ref.entityId}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>

              {requestDetail && requestDetail.transitions.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status History</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {requestDetail.transitions.map(transition => (
                      <Card key={transition.transitionId} style={{ padding: 12 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{transition.previousStatus ?? 'Start'} {'->'} {transition.nextStatus}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                          {transition.actorRole}{transition.actorFacultyId ? ` · ${transition.actorFacultyId}` : ''} · {formatDateTime(transition.createdAt)}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}

              {requestDetail && requestDetail.notes.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {requestDetail.notes.map(note => (
                      <Card key={note.noteId} style={{ padding: 12 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{note.body}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                          {note.authorRole}{note.authorFacultyId ? ` · ${note.authorFacultyId}` : ''} · {formatDateTime(note.createdAt)}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </>
  )
}

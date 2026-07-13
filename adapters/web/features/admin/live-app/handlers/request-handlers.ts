import type { Dispatch, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type { ApiAdminRequestSummary } from '@web/shared/api/types'
import { toErrorMessage } from '../../live-app-model'

export interface RequestHandlerDeps {
  apiClient: AirMentorApiClient
  refreshRequestWorkspaceState: (requestId: string) => Promise<void>
  setRequestBusy: Dispatch<SetStateAction<string>>
  setFlashMessage: Dispatch<SetStateAction<string>>
  setActionError: Dispatch<SetStateAction<string>>
}

export function createRequestHandlers(deps: RequestHandlerDeps) {
  const { apiClient, refreshRequestWorkspaceState, setRequestBusy, setFlashMessage, setActionError } = deps

  const handleAdvanceRequest = async (request: ApiAdminRequestSummary) => {
    setRequestBusy(request.adminRequestId)
    try {
      if (request.status === 'New' || request.status === 'Needs Info') await apiClient.assignAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Claimed for review.' })
      else if (request.status === 'In Review') await apiClient.approveAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Approved for implementation.' })
      else if (request.status === 'Approved') await apiClient.markAdminRequestImplemented(request.adminRequestId, { version: request.version, noteBody: 'Implemented from the sysadmin workspace.' })
      else if (request.status === 'Implemented' || request.status === 'Rejected') await apiClient.closeAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Closed after execution.' })
      await refreshRequestWorkspaceState(request.adminRequestId)
      setFlashMessage('Request updated.')
    } catch (error) { setActionError(toErrorMessage(error)) }
    finally { setRequestBusy('') }
  }

  const handleRequestInfoRequest = async (request: ApiAdminRequestSummary) => {
    if (request.status !== 'In Review') return
    const noteBody = window.prompt('What clarification is needed from HoD?', 'Please clarify implementation scope and acceptance criteria.')
    if (noteBody == null) return
    const trimmedNote = noteBody.trim()
    if (!trimmedNote) {
      setActionError('A clarification note is required to move this request to Needs Info.')
      return
    }
    setRequestBusy(request.adminRequestId)
    try {
      await apiClient.requestAdminRequestInfo(request.adminRequestId, {
        version: request.version,
        noteBody: trimmedNote,
      })
      await refreshRequestWorkspaceState(request.adminRequestId)
      setFlashMessage('Request moved to Needs Info.')
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setRequestBusy('')
    }
  }

  const handleRejectRequest = async (request: ApiAdminRequestSummary) => {
    if (!['New', 'In Review', 'Needs Info', 'Approved'].includes(request.status)) return
    const noteBody = window.prompt('Enter a rejection rationale (required).', 'Rejected by system admin after governance review.')
    if (noteBody == null) return
    const trimmedNote = noteBody.trim()
    if (!trimmedNote) {
      setActionError('A rejection rationale is required to reject this request.')
      return
    }
    setRequestBusy(request.adminRequestId)
    try {
      await apiClient.rejectAdminRequest(request.adminRequestId, {
        version: request.version,
        noteBody: trimmedNote,
      })
      await refreshRequestWorkspaceState(request.adminRequestId)
      setFlashMessage('Request rejected.')
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setRequestBusy('')
    }
  }

  return { handleAdvanceRequest, handleRequestInfoRequest, handleRejectRequest }
}

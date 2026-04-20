import type { ApiAdminRequestDetail, ApiAdminRequestSummary } from './api/types'

export function resolveSelectedAdminRequest(
  selectedRequestSummary: ApiAdminRequestSummary | null,
  selectedRequestDetail: ApiAdminRequestDetail | null,
): ApiAdminRequestSummary | ApiAdminRequestDetail | null {
  if (selectedRequestSummary && selectedRequestDetail) {
    if (selectedRequestSummary.adminRequestId !== selectedRequestDetail.adminRequestId) return selectedRequestSummary
    return selectedRequestDetail.version >= selectedRequestSummary.version
      ? selectedRequestDetail
      : selectedRequestSummary
  }
  return selectedRequestDetail ?? selectedRequestSummary
}

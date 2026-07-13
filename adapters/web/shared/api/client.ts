// Coordinator/barrel for the AirMentor API client. Implementation lives in
// ./client-parts/*. This module re-exports the identical public surface so
// existing '@web/shared/api/client' importers keep working unchanged.

export { AirMentorApiError } from './client-parts/errors'
export type { AirMentorApiClientLike } from './client-parts/api-client-like'
export { AirMentorApiClient } from './client-parts/api-client'

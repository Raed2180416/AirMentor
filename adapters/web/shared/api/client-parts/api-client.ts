// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import { AirMentorAdminRequestRoutes } from './admin-request-routes'
import type { AirMentorApiClientLike } from './api-client-like'

export class AirMentorApiClient extends AirMentorAdminRequestRoutes implements AirMentorApiClientLike {}

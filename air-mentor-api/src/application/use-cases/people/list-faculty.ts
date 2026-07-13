/**
 * GET /api/admin/faculty — the faculty master directory. The parallel dataset
 * load, per-profile mapping (credential status + appointments + grants), scope
 * filtering, and shared-cache provenance enrichment are moved verbatim from the
 * legacy handler; the DB reads go through the repository and the batch-policy
 * resolver is injected.
 */
import { deriveFacultyCredentialStatus } from '../../../lib/password-setup.js'
import type { PeopleRepository } from '../../ports/people-repository.js'
import type { UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapFacultyRecord, type ResolveBatchPolicyResult } from './people-domain.js'
import { matchesFacultyDirectoryScope } from './faculty-directory-scope.js'
import { enrichFacultyRecordWithProvenance, type ResolveBatchPolicyFn } from './faculty-provenance.js'
import type { FacultyDirectoryScopeFilter } from './people-schemas.js'

export type ListFacultyDeps = {
  repo: PeopleRepository
  resolveBatchPolicy: ResolveBatchPolicyFn
  now: () => string
}

export type ListFacultyInput = {
  filter: FacultyDirectoryScopeFilter
}

export async function listFaculty(deps: ListFacultyDeps, input: ListFacultyInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const [profiles, users, credentials, setupTokens, appointments, grants, references] = await Promise.all([
    repo.listFacultyProfiles(),
    repo.listUserAccounts(),
    repo.listPasswordCredentials(),
    repo.listPasswordSetupTokens(),
    repo.listFacultyAppointments(),
    repo.listRoleGrants(),
    repo.loadReferenceData(),
  ])
  const provenanceCache = new Map<string, ResolveBatchPolicyResult>()
  const mappedFaculty = profiles
    .map(profile => mapFacultyRecord({
      profile,
      user: users.find(item => item.userId === profile.userId),
      credentialStatus: deriveFacultyCredentialStatus({
        now: deps.now(),
        passwordConfigured: credentials.some(item => item.userId === profile.userId),
        tokens: setupTokens.filter(item => item.userId === profile.userId),
      }),
      appointments: appointments.filter(item => item.facultyId === profile.facultyId),
      grants: grants.filter(item => item.facultyId === profile.facultyId),
      references,
    }))
    .filter(faculty => matchesFacultyDirectoryScope(faculty, references, input.filter))
  return {
    status: 200,
    body: {
      items: await Promise.all(mappedFaculty.map(faculty => enrichFacultyRecordWithProvenance(deps.resolveBatchPolicy, faculty, references, provenanceCache))),
    },
  }
}

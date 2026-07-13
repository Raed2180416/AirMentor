// Session, authentication, credential-setup, and UI-preference contracts.
// Extracted verbatim from '../types'. Type-only module.

export type ApiRoleCode = 'SYSTEM_ADMIN' | 'HOD' | 'COURSE_LEADER' | 'MENTOR'

export type ApiRoleGrant = {
  grantId: string
  facultyId: string
  roleCode: ApiRoleCode
  scopeType: string
  scopeId: string
  scopeLabel?: string | null
  startDate?: string | null
  endDate?: string | null
  status: string
  version: number
}

export type ApiUiPreferences = {
  userId: string
  themeMode: 'frosted-focus-light' | 'frosted-focus-dark'
  version: number
  updatedAt: string
}

export type ApiSessionResponse = {
  sessionId: string
  csrfToken: string
  demoWorkspaceId: string | null
  user: {
    userId: string
    username: string
    email: string
  }
  faculty: {
    facultyId: string
    displayName: string | null
  } | null
  activeRoleGrant: ApiRoleGrant
  availableRoleGrants: ApiRoleGrant[]
  preferences: ApiUiPreferences
}

export type ApiLoginRequest = {
  identifier: string
  password: string
}

export type ApiFacultyCredentialStatus = {
  passwordConfigured: boolean
  activeSetupRequest: boolean
  latestPurpose: 'invite' | 'reset' | null
  latestRequestedAt: string | null
  latestExpiresAt: string | null
}

export type ApiPasswordSetupRequestResponse = {
  ok: true
  previewEnabled: boolean
  setupUrl: string | null
  message: string
}

export type ApiPasswordSetupInspectResponse = {
  purpose: 'invite' | 'reset'
  username: string
  email: string
  facultyId: string
  displayName: string
  expiresAt: string
  credentialStatus?: ApiFacultyCredentialStatus | null
}

export type ApiPasswordSetupRedeemResponse = {
  ok: true
  username: string
  displayName: string
  purpose: 'invite' | 'reset'
}

export type ApiAdminFacultyPasswordSetupResponse = {
  facultyId: string
  purpose: 'invite' | 'reset'
  issuedToEmail: string
  expiresAt: string
  previewEnabled: boolean
  setupUrl: string | null
}

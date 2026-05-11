import 'fastify'

export type AuthRoleGrant = {
  grantId: string
  facultyId: string
  roleCode: string
  scopeType: string
  scopeId: string
  status: string
  version: number
}

export type RequestAuth = {
  sessionId: string
  userId: string
  username: string
  email: string
  demoWorkspaceId: string | null
  facultyId: string | null
  facultyName: string | null
  activeRoleGrant: AuthRoleGrant
  availableRoleGrants: AuthRoleGrant[]
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: RequestAuth | null
  }
}

export {}

// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiAcademicLoginFaculty,
  ApiLoginRequest,
  ApiPasswordSetupInspectResponse,
  ApiPasswordSetupRedeemResponse,
  ApiPasswordSetupRequestResponse,
  ApiSessionResponse
} from '@web/shared/api/types'
import { AirMentorApiTransport } from './transport'

export class AirMentorSessionRoutes extends AirMentorApiTransport {
  async restoreSession() {
    return this.request<ApiSessionResponse>('/api/session')
  }

  async login(payload: ApiLoginRequest) {
    return this.request<ApiSessionResponse>('/api/session/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async requestPasswordSetup(payload: { identifier: string }) {
    return this.request<ApiPasswordSetupRequestResponse>('/api/session/password-setup/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async inspectPasswordSetup(token: string) {
    return this.request<ApiPasswordSetupInspectResponse>(`/api/session/password-setup/${encodeURIComponent(token)}`)
  }

  async redeemPasswordSetup(payload: { token: string; password: string }) {
    return this.request<ApiPasswordSetupRedeemResponse>('/api/session/password-setup/redeem', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async logout() {
    await this.request('/api/session', { method: 'DELETE' })
    this.csrfToken = null
  }

  async switchRoleContext(roleGrantId: string) {
    return this.request<ApiSessionResponse>('/api/session/role-context', {
      method: 'POST',
      body: JSON.stringify({ roleGrantId }),
    })
  }

  async listAcademicLoginFaculty() {
    return this.request<{ items: ApiAcademicLoginFaculty[] }>('/api/academic/public/faculty')
  }
}

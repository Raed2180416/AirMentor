import type { ReactNode } from 'react'
import type { ApiAcademicLoginFaculty, ApiPasswordSetupInspectResponse, ApiPasswordSetupRequestResponse } from '@web/shared/api/types'

export type AcademicLoginPageProps = {
  facultyOptions?: ApiAcademicLoginFaculty[]
  helperText?: string
  modeLabel?: string
  heroBody?: string
  busy?: boolean
  externalError?: string
  passwordSetupToken?: string | null
  passwordSetupInspect?: ApiPasswordSetupInspectResponse | null
  passwordSetupMessage?: string
  passwordSetupRequestResult?: ApiPasswordSetupRequestResponse | null
  onBackToPortal?: () => void
  onRequestPasswordSetup: (identifier: string) => Promise<void> | void
  onRedeemPasswordSetup: (password: string) => Promise<void> | void
  onClearPasswordSetupToken: () => void
  onLogin: (identifier: string, password: string) => Promise<void> | void
}

export type AcademicSessionBoundaryProps = {
  backendReady: boolean
  booting: boolean
  loadingLabel?: string
  sessionReady: boolean
  facultyOptions: ApiAcademicLoginFaculty[]
  authBusy: boolean
  authError: string
  passwordSetupToken?: string | null
  passwordSetupInspect?: ApiPasswordSetupInspectResponse | null
  passwordSetupMessage?: string
  passwordSetupRequestResult?: ApiPasswordSetupRequestResponse | null
  onBackToPortal: () => void
  onRequestPasswordSetup: (identifier: string) => Promise<void> | void
  onRedeemPasswordSetup: (password: string) => Promise<void> | void
  onClearPasswordSetupToken: () => void
  onLogin: (identifier: string, password: string) => Promise<void> | void
  children: ReactNode
}

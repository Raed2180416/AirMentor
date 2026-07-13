import { T, mono } from '@web/simulation/fixtures'
import { describeProofProvenance } from '@web/simulation/proof-provenance'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { Btn, Card } from '@web/shared/ui/primitives'
import type { ProofOps } from './profile-helpers'

type FacultyProfileBannersProps = {
  liveProfilePresent: boolean
  proofOps: ProofOps | null
  loading: boolean
  error: string
}

export function FacultyProfileBanners({
  liveProfilePresent,
  proofOps,
  loading,
  error,
}: FacultyProfileBannersProps) {
  return (
    <>
      {!liveProfilePresent ? (
        <InfoBanner
          tone="neutral"
          message="The admin-managed faculty profile is not provisioned for this account yet. This page will not synthesize permissions, department ownership, mentor scope, or timetable authority from local teaching fallbacks."
        />
      ) : null}

      {proofOps ? (
        <div data-proof-section="proof-mode-authority">
          <InfoBanner tone="neutral" message={describeProofProvenance(proofOps)} />
        </div>
      ) : null}

      {proofOps ? (
        <Card style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
            Shared proof controls remain available on this profile page and now stay near the top of the proof-mode surface so stage playback is visible before the deeper teacher detail cards.
          </div>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => {
              if (typeof document === 'undefined') return
              document.getElementById('teacher-proof-panel-surface')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            Jump to proof controls
          </Btn>
        </Card>
      ) : null}

      {loading ? <InfoBanner message="Loading faculty profile..." /> : null}
      {error ? <InfoBanner tone="error" message={error} /> : null}
    </>
  )
}

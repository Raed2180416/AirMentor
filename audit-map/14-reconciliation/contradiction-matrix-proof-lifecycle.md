# Contradiction Matrix: Proof Lifecycle

## Claim C01: Date Authority
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (B.1)
- Doc: `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:10` (split date auth)
- Code: `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:20` (server dictates)
- Resolution: Server dictates date authority strictly. Needs-doc-update.

## Claim C02: Active Run Transition
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (C.1)
- Doc: `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:15` (fluid transition)
- Code: `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:45` (rigid state machine)
- Resolution: Setup-draft -> active-run transition is rigid state machine. Needs-doc-update.

## Claim C03: Inspectable Immutability
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (C.10)
- Doc: `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:22` (vague on read-only)
- Code: `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:88` (immutable)
- Resolution: Completed-inspectable is immutable, terminal state. Needs-doc-update.

## Claim C04: Stopped vs Completed
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (C.11)
- Doc: `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:5` (conflated)
- Code: `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:102` (distinct paths)
- Resolution: Stopped != completed. Stopped is interrupted mid-flight. Needs-doc-update.

## Claim C05: Reset Current Stage
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (C.12)
- Doc: `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:40` (vague cascade)
- Code: `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:150` (wipes stage only)
- Resolution: Reset-current-stage wipes stage data only, preserves run. Needs-doc-update.

## Claim C06: Complete Reset
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (D.1)
- Doc: `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:55` (unclear bounds)
- Code: `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:180` (nukes entire history)
- Resolution: Complete-reset destructively nukes entire run history back to draft. Needs-doc-update.

## Claim C07: Next Day Advance
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (D.2)
- Doc: `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:66` (auto-advance)
- Code: `air-mentor-api/src/lib/proof-control-plane-advance-service.ts:210` (requires preflight)
- Resolution: Next day advance requires server preflight check, not automatic. Needs-doc-update.

## Claim C08: Semester Boundaries
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (L.1)
- Doc: `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:20` (seamless flow)
- Code: `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:250` (hard stop)
- Resolution: Semester boundaries are hard stops, requiring explicit activation. Needs-doc-update.

## Claim C09: Activation Lock
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (L.2)
- Doc: `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:80` (mutable config)
- Code: `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:300` (locks config)
- Resolution: Activation permanently locks semester configuration. Needs-doc-update.

## Claim C10: Seeded Run Bypass
- Auth: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (L.3)
- Doc: `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:90` (requires setup)
- Code: `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:350` (skips setup)
- Resolution: Seeded run bypasses setup-draft, jumps to active-run. Needs-doc-update.

# Working Knowledge

Update this file during every pass.

## Current Bootstrap Notes

- The repo already has a substantial historical audit corpus in `/audit` and `docs/closeout/`.
- Local dev shell is declared in `flake.nix` and includes Node 24, Python 3.11, `uv`, and Playwright.
- Frontend production behavior depends on `VITE_AIRMENTOR_API_BASE_URL`.
- Backend production-like cookie/origin behavior depends on `CORS_ALLOWED_ORIGINS`, `CSRF_SECRET`, `SESSION_COOKIE_SECURE`, and `SESSION_COOKIE_SAME_SITE`.
- Repo-local Caveman auto-hooks are blocked by an existing zero-byte `.codex` file in the repo root.
- Repo-wide inventory ledgers now capture the current file census for `src/`, `air-mentor-api/src/`, `tests/`, `air-mentor-api/tests/`, `scripts/`, `air-mentor-api/scripts/`, `.github/workflows/`, `docs/closeout/`, and the audit-map control plane.
- Gap-closure Track A prompt prose has path drift versus current audit OS: canonical current directories are `04-feature-atoms`, `05-dependencies`, and `08-ml-audit`, not the older `08-feature-atoms`, `09-dependency`, and `12-ml` labels still present in handoff prose.
- Current gap-closure pass control-plane truth drifted at bootstrap: `audit-air-mentor-ui-bootstrap-gap-closure-deploy-audit-reconciliation-pass.status` and its checkpoint showed `running` with `pid=1493998` / `execution_supervisor_pid=1494569`, but direct `ps` found no live processes and `pending.queue` still retained the pass entry. This was manually reconciled in-pass to terminal completed truth at `2026-04-20T01:57:31Z`.
- After that manual reconciliation, the pass control plane behaved like earlier supervisor-drift cases: primary fields stayed terminal (`state=completed`, checkpoint `last_event=completed`), but supervisor subfields restamped to `watching` / `attempt-log` at `2026-04-20T01:58:41Z`. Treat primary status/checkpoint fields plus durable artifacts as authoritative for this pass.
- Root vitest config only discovers frontend `tests/**` files, so backend gap-closure suites must run from `air-mentor-api/` to avoid false "No test files found" negatives.
- Focused gap-closure validation on 2026-04-20 now has current evidence:
  - Frontend/local listener-free suites pass: `tests/domain.test.ts`, `tests/calendar-utils.test.ts`, `tests/academic-session-shell.test.tsx` (`17/17`).
  - Backend listener-free focused suites pass: `air-mentor-api/tests/academic-bootstrap-routes.test.ts` plus GAP-5-filtered `air-mentor-api/tests/gap-closure-intent.test.ts` (`3 passed`, `8 skipped`).
  - Full `air-mentor-api/tests/gap-closure-intent.test.ts` still blocks on embedded Postgres listener startup with `listen EPERM: operation not permitted 127.0.0.1`; treat remaining GAP-1/2/3/4 integration assertions as code-backed and sandbox-blocked until rerun elsewhere.
- `air-mentor-api/tests/academic-bootstrap-routes.test.ts` had drifted behind GAP-5 because its mock DB returned no active run; current local truth is restored after updating the test fixture to return an active `simulationRuns` row.
- GAP-7 now has direct frontend proof coverage in repo: `tests/domain.test.ts` asserts `toDueLabel(..., anchorISO)` behavior, and `tests/calendar-utils.test.ts` asserts `applyPlacementToTask(..., anchorISO)` keeps due labels aligned to proof virtual date.
- Prompt suite `v1.x` was too weak to force near-lossless route, role, and feature decomposition. Prompt suite `v2.0` now requires exhaustive micro-interaction, state-family, and completeness gating, and the earlier route/role/feature outputs should be treated as provisional.
- Route-map v2.0 now captures the top-level portal hashes, academic internal page-state families, sysadmin deep links, query-driven bootstrap state, storage-backed restore behavior, and canonical proof-route normalization.
- Role-surface pass v2.0 is now mapped for all five role families. The remaining high-value delta is feature atoms, dependency edges, and later live verification rather than more role names.
- Feature-atom pass v2.0 currently resolves to 24 feature-atom files plus 1 cross-surface microinteraction registry row (`25` rows total in `feature-registry.md`); the sysadmin request transition mismatch still remains as C-006.
- The sysadmin request workspace is status-driven and currently omits explicit `Needs Info` / `Rejected` UI controls even though the backend still supports those transitions.
- HoD admin-request visibility is requester-scoped, and the unlock-review surface is a separate academic workflow rather than the sysadmin request queue.
- The route pass did not surface a new contradiction; the only recorded live route drift still comes from the preexisting Railway `/health` mismatch.
- Dependency pass v2.0 now maps the hidden coupling layer across portal hashes, session cookies, CSRF config, academic bootstrap, route-history restore, proof playback selection, checkpoint-scoped student access, canonical proof scope, admin request transitions, admin search scope, and runtime shadow state.
- Proof-refresh completion ownership is now resolved locally: Fastify bootstrap starts `startProofRunWorker(...)` (`air-mentor-api/src/app.ts`), queue lease claim/heartbeat/failure/retry semantics are in `air-mentor-api/src/lib/proof-run-queue.ts`, seeded/live run services terminalize `completed` state, and activation-path fallback can synchronously execute queued non-materialized runs (`audit-map/13-backend-provenance/proof-refresh-completion-lineage.md`).
- The strongest remaining dependency risk is semantic drift between local-storage-backed selection state and the live proof/dashboard scope when the checkpoint or route context changes.
- State-flow pass v2 now persists five state families in `audit-map/07-state-flows/`: academic session-role-page navigation, sysadmin session-route restore, proof playback checkpoint progression, runtime shadow conflict/drift, and admin request lifecycle transitions.
- State-flow evidence confirms explicit restore and re-entry mechanics (`routeHistory`, hash parse/serialize replay, session restore, storage-backed workspace restore, and proof checkpoint persistence), with 401 retry and fallback behavior in both academic and sysadmin shells.
- C-006 remains active after state-flow mapping: backend request routes support `Needs Info` and `Rejected` while the sysadmin request workspace still exposes only `Take Review` / `Approve` / `Mark Implemented` / `Close`.
- Live verification is still outstanding for all state-flow families; current confidence is high for local and test-backed transitions, medium for deployed runtime parity.
- ML audit pass now classifies the proof-risk stack as multiple layers rather than one model: deterministic observable fallback scoring, trained multi-head logistic artifacts, deterministic calibration-display suppression, deterministic correlation-driver augmentation, deterministic policy replay and queue heuristics, and UI-only advisory scenario heads.
- Active proof-risk artifacts are DB-backed through `riskModelArtifacts`, while row-level provenance is stored in `riskEvidenceSnapshots` and served through `riskAssessments`.
- Runtime active recompute can synthesize `fallback-simulated` source refs when stage evidence or graph/history context is missing, so model-shaped responses can still carry downgraded provenance.
- Head probability display is intentionally gated by held-out support and ECE thresholds, and `ceRisk` remains band-only even when other heads are allowed to show probabilities.
- Academic surfaces reuse the active proof model via `computeRiskFromActiveModelOrPolicy()`, but they do not carry the same source-ref and correlation context as the proof-tail surfaces, so explanation richness can diverge across roles.
- Curriculum linkage is the main mixed ML-adjacent pipeline outside proof risk: deterministic prerequisite and token matching leads, optional Python NLP and `sentence-transformers` refine, and optional local Ollama assist is non-blocking.
- Frontend ML and proof UI tests passed locally, as did backend pure model and heuristic tests. Fresh route-level backend proof tests and fresh `evaluate:proof-risk-model` regeneration were blocked in this sandbox by `listen EPERM`.
- Test-gap pass coverage is strongest in deterministic helpers, backend route tests, and local UI contracts; the remaining high-risk blind spots are cross-role same-student truth, admin request transition UI parity, live Pages/Railway auth/session proof, and live proof-artifact credibility.
- UX friction pass v2.0 now records the main operator load hotspots: sysadmin request actions compress backend transitions into one status-driven button, proof dashboard state is split across active semester/checkpoint/tab restore, hierarchy and curriculum binding mix scope aliases with synthetic provisioning, course pages freeze or lock exam structure after marks land, and calendar/timetable planning switches between two different mental models.
- The mentor and HoD drilldowns are clearer than the admin control plane but still rely on dense provenance vocabulary and multi-drilldown action clusters; the student shell is intentionally bounded and comparatively low friction.
- The system-admin history archive/recycle-bin restore page is the clearest low-friction admin workflow reviewed in this pass.
- The sysadmin request lifecycle mismatch (C-006) is still open at the UI layer: backend routes support `Needs Info` and `Rejected`, but the visible workspace still exposes only the status-driven path.
- Live proof behavior, fallback frequency, and production-artifact freshness are still not proven on the deployed stack; the local proof tests only establish deterministic behavior inside the repo.
- Accessibility tests are contract-level checks for ARIA, focus, and contrast. They do not yet prove that the dense proof and admin surfaces remain legible under real production data volume.
- Live-behavior pass confirmed shell-level GitHub Pages reachability again: both the root URL and `#/admin` resolve to the `air-mentor-ui` HTML shell.
- The bootstrap live Pages HTML shell is byte-identical to a clean committed `HEAD` Pages-style build, so the deployed frontend shell currently aligns with committed source; a dirty-worktree build in this workspace diverged only because local undeployed source edits are present.
- The Railway `/health` contradiction remains open: the latest direct live artifact still shows `404` with `x-railway-fallback: true`, and this pass could not refresh Railway bodies because the current terminal environment could not resolve or render the live Railway host.
- The canonical live closeout wrapper fails fast in this shell because `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER` and `AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD` are absent, so authenticated system-admin, request, proof, teaching-parity, accessibility, keyboard, and session-security flows remain blocked in this pass.
- The current native Codex terminal environment only provided partial live visibility in this pass: shell and Node DNS to the live hosts failed with `EBUSY`, Playwright MCP browser calls were cancelled, and the available `web` fetcher only surfaced the Pages shell.
- `bash audit-map/16-scripts/tmux-list-jobs.sh` initially failed because `audit-map/29-status/audit-air-mentor-ui-live-live-behavior-pass.status` contained a stray `3Z` line; the status file was manually rewritten in this pass and the status reader now works again.
- A 2026-04-15T17:41Z rerun reconfirmed the same blocker stack rather than clearing it: `web.open` still reaches GitHub Pages root and `#/admin` only at HTML-shell level, while direct `node fetch(...)` to both Pages and Railway still fails with `getaddrinfo EBUSY`.
- The rerun tightened the environment diagnosis: Railway `/`, `/health`, and `/openapi.json` are not just unverified, they are presently unrefreshable from this native Codex shell because both the shell-side network path and the browser MCP path fail before any new response body is captured.
- Local expectation for Railway `/health` remains authoritative and current because both `air-mentor-api/src/app.ts` and `air-mentor-api/railway.json` still declare `/health`; the unresolved live `404` is therefore a real deployment contradiction, not a stale local assumption.
- The canonical live closeout command was rerun with the documented Pages and Railway URLs at 2026-04-15T17:41Z and still failed immediately on missing live system-admin credentials, so the blocker is reproducible with the actual resume command rather than only with a helper shell function.
- Account-routing pass confirmed the current bootstrap route is still native Codex `gpt-5.4` with `xhigh` reasoning because `task-classify-route.sh` marks `account-routing-pass` as `provider_admission_policy=native-only`, `select-execution-route.sh` returns `selected_provider=native-codex`, and native route health is currently clear.
- The routing controller had a safety gap before this pass: once an Arctic slot was considered execution-ready at any acceptable floor model, the selector could still auto-pick a higher merely visible requested model on that provider. `select-execution-route.sh` now pins non-native automatic routing to each slot's execution-verified model.
- Arctic Codex execution posture changed materially from earlier routing docs: all six `codex-*` slot status files now record `execution_verification_state=verified` with `execution_model=gpt-5.3-codex`, backed by `execution-smoke-*.txt` snapshots that contain the expected `execution-ok` marker.
- That promotion does not make Arctic Codex a substitute for native-only high-stakes passes, because only native Codex has locally verified `gpt-5.4` availability plus direct reasoning-effort control.
- tmux visibility is inconsistent from the current native shell: `tmux ls` can list detached sessions, but `tmux has-session` against the detached `account-routing-pass` hit `Operation not permitted`, so the duplicate detached pass could not be cleanly stopped via the wrapper during this review.
- Prompt self-improvement pass (2026-04-15) identified a concrete prompt reliability gap: core prompts still carried stale environment assumptions even after routing status files changed. The prompt suite now hardens against this by requiring status/checkpoint/log evidence (`prompt-self-improvement-pass.md` v2.1), enforcing runtime status-file precedence and drift checks (`environment/main-analysis-agent-bootstrap.md` v2.1), and adding closure-phase stale-assumption reconciliation (`exhaustive-closure-campaign.md` v3.2).
- Unattended-run pass drift check (2026-04-15T18:38:45Z) initially found prompt/runtime divergence: the requested native route (`native-codex`/`gpt-5.4-mini`) hit a hard quota stop (`attempt-1`) and automatic failover switched to Arctic `codex-01` on execution-verified `gpt-5.3-codex`. Status/checkpoint truth now shows that rerouted pass reached terminal `completed` at `2026-04-15T18:41:15Z` / `2026-04-15T18:41:16Z`, so the earlier non-terminal queue-preservation notes are historical only.
- Frontend microinteraction pass captured six high-density clusters: academic role-route shell sync, calendar/timetable drag-resize placement, sysadmin live shell queue/search routing, request lifecycle controls, proof dashboard launcher/checkpoint playback, and hierarchy route-scoped restore (`audit-map/12-frontend-microinteractions/component-cluster-microinteraction-map.md`).
- Persisted microinteraction coupling now has explicit key evidence: proof checkpoint selection key `airmentor-proof-playback-selection` (`src/proof-playback.ts`), sysadmin proof tab key `airmentor-system-admin-proof-dashboard-tab` (`src/system-admin-proof-dashboard-workspace.tsx`), route-scoped restore key family `airmentor-admin-ui:<hash>` (`src/system-admin-faculties-workspace.tsx`), and dismissed admin queue persistence in localStorage (`src/system-admin-live-app.tsx`).
- The frontend microinteraction pass did not close contradiction C-006; request workspace controls still expose a narrower transition set than backend-supported `Needs Info` and `Rejected`.
- `src/data.old.ts` again showed zero `src/` call-site hits via `rg`, strengthening the archival-candidate hypothesis but still requiring formal disposition.
- Backend provenance pass now confirms migrations are raw SQL applied in filename lexical order through `schema_migrations`, with later lineage extending through `0018_proof_active_operational_semester.sql`.
- Proof seed provenance is two-layered by design: platform seed JSON baseline plus MSRUAS proof synthetic runtime seeding; deterministic seeded runs then materialize runtime, checkpoint, and projection families.
- Async proof worker lineage is now explicit: queued `simulation_runs` row -> lease claim/heartbeat -> `startProofSimulationRun(...)` -> seeded finalization/rebuilds -> activation -> `publishOperationalProjection(...)`.
- Runtime and replay coupling is explicit: snapshot restore relaunches run with parent linkage, and both seeded finalize and runtime recompute call stage-playback rebuild; artifact rebuild and active-risk recompute are independently gateable.
- No new contradiction was added in this pass, but three backend integrity risks are now tracked: migration-prefix readability drift, projection rewrite transient exposure risk, and fallback provenance interpretation risk for `fallback-simulated` evidence mode.
- Workflow automation pass now maps all five `.github/workflows/*` files as behavior systems with trigger scope, job graph, environment gates, script coupling, and proof boundary semantics in `audit-map/09-workflow-automation/workflow-behavior-map.md`.
- `proof-browser-cadence.yml` currently runs scripts named `playwright-admin-live-*` without forcing `AIRMENTOR_LIVE_STACK=1` or live URLs, so workflow success can still represent local-seeded smoke rather than deployed-live semantics.
- `deploy-pages.yml` proves publish mechanics but has no post-deploy semantic check stage, so successful Pages deployment does not prove route/action/cross-role semantic correctness.
- `deploy-railway-api.yml` has useful preflight + health + session-contract logic, but core deployment and verification paths are conditionally skipped when Railway vars/secrets are absent, which can leave a green workflow state with unproven deployment truth.
- `verify-live-closeout.yml` remains the strongest workflow-native live semantic proof path (semester walk + full closeout chain), but it is manual-dispatch only and credential-gated, so cadence guarantees are operational rather than automatic.

## Claim Verification Pass (2026-04-15T21:38:19Z)

- Status-file truth supersedes older notes: `audit-air-mentor-ui-bootstrap-unattended-run-pass.status` and its checkpoint are terminal `completed` on `2026-04-15T18:41:15Z` / `2026-04-15T18:41:16Z`; earlier non-terminal drift wording was stale.
- `audit-air-mentor-ui-bootstrap-claim-verification-pass.status` and its checkpoint were observed as `running` from `2026-04-15T21:25:46Z`, but active tmux-backed execution and the live pass log confirmed that this state belonged to the current wrapper-owned run rather than an abandoned stale wrapper. Leave terminal completion and queue removal to the wrapper.
- `route-health-native-codex.status` still advertised cooldown through `2026-04-15T21:23:00Z`, but that timestamp had already expired before this pass and should not be treated as an active route blocker.
- `audit-map/15-final-maps/data-flow-map.md` overstated its backing corpus: `audit-map/06-data-flows/` is absent, and the underlying `data-flow-pass` status/checkpoint/log show a `stalled-no-progress` completion after only initial bootstrap file reads. Treat the current data-flow map as overlay-only partial evidence until rerun.
- `audit-map/15-final-maps/feature-registry.md` and the detailed feature atoms had taxonomy drift: `unlock-review` was misfiled under the mentor surface even though `canAccessPage()` restricts it to HoD; `queue-history` was over-narrowed to mentor despite Course Leader/Mentor/HoD access.
- The UX friction ledger remains useful as a code/test-informed hypothesis set, but its ranking of the "strongest friction cluster" is inference-backed rather than user- or live-validated evidence.
- The durable baseline for the validation phase is now `audit-map/32-reports/claim-verification-matrix.md`.

## Next Deep-Dive Priorities

1. rerun `live-behavior-pass` from a network-enabled environment with `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER` and `AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD` so the authenticated Pages + Railway closeout suite can execute end-to-end and refresh Railway `/`, `/health`, `/openapi.json`, and session-contract evidence
2. continue to `cost-optimization-pass`, then `unattended-run-pass`, then Phase B closure deep passes (`frontend-microinteraction-pass`, `backend-provenance-pass`, `workflow-automation-pass`, `same-student-cross-surface-parity-pass`) with the corrected routing baseline carried forward explicitly; `script-behavior-pass` is already durably mapped

## Unknown Omission Pass (2026-04-16)

- The prior queued `unknown-omission-pass` wrapper state is stale: `audit-map/29-status/audit-air-mentor-ui-bootstrap-unknown-omission-pass.status` and its checkpoint still report `running` from `2026-04-15T22:18:16Z`, while `manual-action-required.md` records an overnight stop/failure and no terminal last-message artifact exists. Treat the direct manual pass outputs in `audit-map/32-reports/unknown-omission-ledger.md` as the current truth until the wrapper state is explicitly superseded.
- New omission families discovered beyond the existing blocker list:
  - telemetry and startup-diagnostics flow (`src/telemetry.ts`, `src/startup-diagnostics.ts`, backend relay/persistence, and dedicated tests)
  - sysadmin helper-cluster microinteractions (section-scope IDs, bulk mentor assignment preview/apply, scoped registry launches, faculty calendar/timetable editing, queue dismissals, and system-admin session boundary)
  - backend active-run/helper services (active-run selection, authoritative-first fallback, live-run seeding, dashboard diagnostics, section-risk aggregation, and mentor provisioning eligibility)
  - same-student parity fixture generation via `air-mentor-api/scripts/generate-academic-parity-seed.ts`
  - live auth, password probing, artifact snapshot, and Railway recovery helper scripts
  - contract/observability suites for startup diagnostics, telemetry, OpenAPI/config, admin hierarchy, and queue-worker stop semantics
- The omission hunt did not find a new workflow-file family gap; `.github/workflows/*` remains adequately represented at execution-system depth. The new gaps are concentrated in helper components, helper services, and underused contract suites rather than in missing workflow files.
- `audit-map/01-inventory/component-index.md` was corrected during this pass to add omitted active files: `src/academic-workspace-route-helpers.ts`, `src/academic-workspace-route-surface.tsx`, and `src/telemetry.ts`.
- Recommended follow-on order after this pass: `frontend-microinteraction-pass` continuation for the sysadmin helper cluster, `backend-provenance-pass` continuation for the active-run/helper-service cluster, `same-student-cross-surface-parity-pass`, and then a credentialed `live-behavior-pass` rerun; `script-behavior-pass` is already durably mapped.

## Residual Closure And Final Readiness (2026-04-16)

- The deepest two validation passes (`residual-gap-closure-pass` and `closure-readiness-pass`) were not trustworthy on the current GitHub Copilot alternate route: both exited without writing their required artifacts, and the artifact gate correctly rejected them.
- The routing policy is now split more carefully:
  - `claim-verification-pass` and `unknown-omission-pass` may use verified alternates when native is unavailable
  - `residual-gap-closure-pass` and `closure-readiness-pass` are forced back to native-only because alternate-route execution produced no durable output
- `_audit-common.sh` status reconciliation is hardened so a pass with `last_execution_failure_class` or non-zero `exit_code` is no longer auto-promoted to `completed` just because the supervising process exited.
- The missing residual-gap and closure-readiness artifacts were completed manually from the durable evidence corpus:
  - `audit-map/32-reports/residual-gap-closure-report.md`
  - `audit-map/32-reports/closure-readiness-verdict.md`
- Data-flow corpus rerun completion: standalone per-flow records now exist under `audit-map/06-data-flow/` with index `flow-corpus-index.md` and five required high-risk flow files (proof run/checkpoint/projection, proof-risk artifacts/evidence snapshots, academic route/session/bootstrap, sysadmin request/proof/history/search, telemetry/startup diagnostics).
- C-009 closure condition is now satisfied for standalone corpus backing; remaining data-flow residual risk is long-tail component interaction depth and duplicate directory naming drift (`06-data-flow/` vs `06-data-flows/`).
- Current closure verdict remains intentionally skeptical: the audit is strong enough to support scoped code fixes, but not strong enough to claim exhaustive semantic closure while long-tail frontend interactions and credentialed live parity proof remain open; proof-refresh completion ownership is now mapped locally, with deployed liveness still pending.
- Closure-readiness rerun (manual in-session, 2026-04-16) reconfirmed wrapper-state drift: `audit-air-mentor-ui-bootstrap-closure-readiness-pass.status` and its checkpoint still show `running` despite durable closure artifacts existing. For this pass family, durable report + coverage artifacts are authoritative until wrapper reconciliation is performed.
- Closure-readiness stance remains unchanged in confidence class: operationally mature and safe for scoped, evidence-anchored fixes, but not closure-ready for near-lossless semantic claims because credentialed live parity, long-tail helper/component decomposition, and restricted-environment proof-risk regeneration remain open.

## Closure Readiness Refresh (2026-04-16)

- `audit-map/29-status/route-health-native-codex.status` still advertises a cooldown ending at `2026-04-16T01:16:00Z`, but that timestamp is already expired and should be treated as stale route-health metadata rather than an active blocker for current manual analysis.
- `audit-map/13-backend-provenance/proof-refresh-completion-lineage.md` now closes the local ownership question for post-enqueue proof refresh: the remaining uncertainty is deployed worker liveness and continuity, not who owns completion in code.
- This section's earlier missing-artifact warning is now superseded by the manual rerun recorded below: durable long-tail interaction evidence, a pass last-message file, and reconciled pass control files now exist for `frontend-long-tail-pass`.
- Long-tail frontend interaction coverage remains an active closure blocker only in the narrower sense of exhaustive tail depth and live-authenticated confirmation, not because the pass lacks durable artifacts.
- Safe-for-fixes posture remains unchanged: this audit is strong enough for scoped, evidence-anchored fixes, but not strong enough to support claims of near-lossless semantic closure until credentialed live parity and durable long-tail frontend decomposition are completed.

## Frontend Long-Tail Manual Rerun (2026-04-16T09:41:20Z)

- Durable frontend long-tail evidence now exists in `audit-map/12-frontend-microinteractions/long-tail-interaction-map.md`; the missing-artifact contradiction `C-010` is resolved and the pass control files were reconciled to match the new durable output.
- Audit-OS residual drift remains for this pass family: the primary completion fields (`state=completed`, checkpoint `last_event=completed`) are now terminal, but the status file's supervisor/progress subfields keep restamping to `watching` / `attempt-log` even with no live tmux session or active PID. Treat the durable artifacts plus the primary completion fields as authoritative until the wrapper monitor is repaired (`C-012`).
- The sysadmin helper/shell long tail is now explicitly mapped:
  - section-scope normalization and selector semantics
  - scoped registry launch and breadcrumb return flow
  - bulk mentor preview/apply invalidation and confirm path
  - action-queue dismiss/hide-all/restore-all persistence
  - session boundary login/role-switch/logout and faculties restore banner behavior
  - active faculty calendar modal planner behavior
- New frontend contradiction `C-011`: the visible faculties `Section` selector is built from current student records rather than canonical `selectedBatch.sectionLabels`, so configured empty sections can disappear from section-scoped governance/provisioning/registry control even though the batch still advertises them elsewhere.
- Hidden coupling risk: `src/system-admin-live-app.tsx` duplicates the section-scope helper logic that already exists in `src/admin-section-scope.ts`; provisioning helpers import the shared file, but the live app keeps a second local implementation.
- Queue-dismiss state is browser-global rather than user-scoped: `dismissedQueueItemKeys` persist in localStorage under `airmentor-admin-dismissed-queue-items` and survive logout, so hidden requests/reminders can bleed across sysadmin sessions on the same browser profile.
- The active admin planner surface is `src/system-admin-faculty-calendar-workspace.tsx`, which fetches `/api/admin/faculty-calendar/:facultyId`, opens from the faculty-detail timetable summary, allows marker edits even when recurring class edits are locked, and saves both `template` + `workspace` through `saveAdminFacultyCalendar()`.
- `src/system-admin-timetable-editor.tsx` is now mapped as a repo-present but currently unmounted alternate planner implementation; it has no current imports or tests outside itself, so future agents should not treat it as a live route surface without verifying a call site.
- `src/data.old.ts` again showed zero active repo imports under `rg -n "data.old" -S .`; call-site inventory is effectively closed, but formal archival/removal intent is still not documented.
- Frontend residuals are now narrower: telemetry/startup diagnostics still need dedicated mapping, `src/data.old.ts` still needs a formal disposition, exhaustive every-component tail coverage across the rest of `src/` remains open, and live authenticated confirmation is still blocked.

## Closure Readiness Artifact-Integrity Refresh (2026-04-16)

- The current `closure-readiness-pass` control plane still cannot be treated as literal liveness truth: `audit-air-mentor-ui-bootstrap-closure-readiness-pass.status` restarted at `2026-04-16T10:19:51Z` and `audit-map/32-reports/operator-dashboard.md` marks it `running`, but the current shell could not confirm the recorded PIDs and `tmux ls` returned `Operation not permitted`. Durable report + ledger artifacts remain more trustworthy than active-pass UI state from this shell.
- `script-behavior-pass` is now creditable for closure: `audit-air-mentor-ui-bootstrap-script-behavior-pass.status` and its checkpoint are terminal, `audit-map/32-reports/script-behavior-registry.md` and the pass-scoped last-message exist, and `audit-map/32-reports/operator-dashboard.md` no longer marks the artifact as missing.
- Historical note now superseded: `same-student-cross-surface-parity-pass` previously lacked a durable artifact, but the missing report/last-message/control-file reconciliation were completed later in-session on `2026-04-16`.
- Closure stance remains skeptical for a different reason now: the audit is still safe for scoped, evidence-anchored fixes, but closure cannot be claimed while credentialed live same-target parity is blocked and contradiction `C-021` remains unresolved.
- Current credible follow-on order is: restore the live session contract, add or approve a read-only proof observer, then rerun live same-target parity; in parallel, continue telemetry/startup + remaining frontend/helper-service mapping.
- Live credentialed parity pass manual reconciliation (2026-04-16T11:03:53Z): `audit-air-mentor-ui-live-live-credentialed-parity-pass.status` still claimed `running`, but the recorded `pid` and `execution_supervisor_pid` were absent and no durable report existed. This run wrote the blocked parity artifacts, then reconciled the pass control files to terminal blocked truth.
- Current live session-contract truth is now re-proved for this shell: `cd air-mentor-api && RAILWAY_PUBLIC_API_URL=https://api-production-ab72.up.railway.app EXPECTED_FRONTEND_ORIGIN=https://raed2180416.github.io npm run verify:live-session-contract` fails immediately on missing `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER`, before any network or live mutation.
- Current browser-path truth is also re-proved for this shell: Playwright MCP `browser_navigate` to the public Pages root still returns `user cancelled MCP tool call`, so fresh rendered browser evidence is blocked even before credentials are supplied.
- The repo currently lacks a safe blind live proof/parity observer. `scripts/system-admin-proof-risk-smoke.mjs` can create proof imports, validate/review/approve them, recompute risk, create proof runs, and activate semesters; `scripts/system-admin-teaching-parity-smoke.mjs` patches faculty profile and appointment state. Under the live-safety rule, neither is acceptable for production parity capture without a proven restore path.
- The academic-side live scripts currently imply one multi-grant faculty identity rather than separate `COURSE_LEADER`, `MENTOR`, and `HOD` credentials: the teacher session switches to `Course Leader`, `Mentor`, and `HoD` via in-session role buttons after a single academic login. This remains code-backed only until live credentials are available.
- Student shell still appears to be an indirect proof drilldown rather than a separate live credential path; no separate student login contract was found in the current live parity helper chain.
- Updated follow-on order for live closure work: `verify:live-session-contract` with real live admin credentials, add or approve a read-only live proof/parity observer, then rerun `live-credentialed-parity-pass` for same-target tuple capture across `SYSTEM_ADMIN`, `COURSE_LEADER`, `MENTOR`, `HOD`, and student-shell.
- Live parity control-plane drift remains partially open after manual reconciliation: the status file now keeps terminal primary fields, but `execution_supervisor_state` and progress metadata restamped to `watching` / `attempt-log`. Treat the durable parity report plus checkpoint `last_event=completed` as authoritative until `C-016` is repaired.
- Live credentialed parity rerun drift check (2026-04-16T18:21:12Z): the current shell again has none of the required live env exported (`PLAYWRIGHT_APP_URL`, `PLAYWRIGHT_API_URL`, `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER`, `AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD`, `AIRMENTOR_LIVE_TEACHER_IDENTIFIER` all unset), so the pass is blocked at precondition level in addition to the earlier Railway/backend blockers.
- Claim-verification refresh (2026-04-16T18:30:20Z) now supersedes the old 2026-04-15 validation matrix on two material points: the final data-flow map is backed by canonical `audit-map/06-data-flow/` corpus entries for the required five high-risk families, and the current feature-registry truth is `24` feature-atom files plus `1` cross-surface microinteraction row rather than a flat `24`-row registry.
- Fresh targeted frontend parity/UI evidence was re-run successfully in this shell: `npm test -- system-admin-proof-dashboard-workspace.test.tsx academic-route-pages.test.tsx faculty-profile-proof.test.tsx` passed `24/24`. Fresh backend DB-backed parity/admin reruns remain blocked in this sandbox by `listen EPERM: operation not permitted 127.0.0.1`, so backend route-level parity claims stay code-backed and committed-test-backed rather than freshly rerun.
- Current live blocker truth is stronger than "missing live env vars": the 2026-04-16 stored artifacts now prove Railway session login currently returns `404 Application not found`, Railway has no active deployment, the prepared backend crash fix is billing-blocked, direct shell fetches still fail with `getaddrinfo EBUSY`, and Playwright MCP still cancels before navigation.
- Fresh shell transport evidence on the same rerun still fails before HTTP response: direct Node fetches to Pages root, Railway `/health`, and Railway session login all return `getaddrinfo EBUSY`, while Playwright MCP still cancels before navigation. The latest network-backed Railway `404 Application not found` probe therefore remains the newest HTTP-level session evidence.
- `audit-air-mentor-ui-live-live-credentialed-parity-pass.status` and the paired checkpoint regressed again to a dead `running` state on `2026-04-16T18:17:46Z`; `ps` found no matching PIDs and the log only contained bootstrap/read activity. This rerun manually restored terminal blocked truth, so use the fresh 18:21Z artifacts plus the reconciled status/checkpoint instead of the stale wrapper state.

## Unknown Omission Rerun (2026-04-16T14:07:01Z)

- The current rerun found three additional underrepresented families beyond the prior unknown-omission ledger:
  - proof provenance / count-source explanation surfaces shared across sysadmin, HoD, faculty-profile, risk-explorer, proof-summary, and student-shell
  - proof playback lifecycle helpers that control queue visibility, checkpoint-reset deletion, stage-summary rebuilds, and observed-state parsing
  - closeout stage-promotion automation (`run-detached.sh`, `closeout-stage-*.mjs`, `finalize-stage-*-after-session.sh`) that can mutate closeout ledgers, manifests, defect state, and stage docs after detached runs
- These families were confirmed as genuinely underrepresented rather than merely inventoried: `rg` returned no matches for their helper names across the current final maps, live-behavior corpus, microinteraction maps, or coverage ledgers, even though the code paths are active and in some cases user-visible.
- `src/proof-provenance.ts` is now a high-signal omission because it shapes user-visible explanatory copy for proof scope, checkpoint-vs-run counts, and model usefulness across multiple role surfaces, but no direct tests mention it.
- The current `unknown-omission-pass` wrapper rerun was non-authoritative at pass start: status/checkpoint said `running` with recorded PIDs, `ps` found no matching processes, and the log contained only bootstrap prompt text. Manual reconciliation fixed the primary completion fields, but the supervisor/progress metadata later restamped to `watching` / `attempt-log`; treat the durable report plus `state=completed` / checkpoint `last_event=completed` as authoritative until `C-020` is repaired.
- Recommended local follow-on order after this rerun: `backend-provenance-pass` continuation for proof lifecycle/provenance helpers, `frontend-microinteraction-pass` continuation for proof explanation surfaces and the remaining `src/` tail, then `same-student-cross-surface-parity-pass`.
- Superseded by the later script-behavior registry: parity-seed generation, live auth/recovery helpers, and closeout stage-promotion automation are now durably mapped, so those rows are historical precursors rather than current blockers.

## Backend Provenance Continuation (2026-04-16)

- `seedIntoDatabase(...)` is a destructive reset boundary, not an additive loader: it deletes broad auth, academic, and proof-runtime tables before replaying `platform.seed.json`, then rebuilds the proof sandbox.
- The previously partial backend helper families are now locally mapped: proof count-source/provenance builders, playback reset/rebuild helpers, active-run/live-run/dashboard/section-risk helpers, authoritative-first fallback, and mentor provisioning eligibility.
- `rebuildSimulationStagePlayback(...)` resets only checkpoint-scoped artifacts, then rebuilds checkpoints, stage student/offering/queue projections, queue cases, and checkpoint-bound `riskEvidenceSnapshots`.
- `recomputeObservedOnlyRisk(...)` deletes active risk/alert/reassessment/evidence rows for a run and rebuilds them from current observed rows, reusing checkpoint stage-close evidence when present and falling back to `coEvidenceMode='fallback-simulated'` when it is not.
- `rebuildProofRiskArtifacts(...)` is batch-scoped rather than current-run scoped: it selects governed complete runs from `PROOF_CORPUS_MANIFEST`, deactivates prior active artifacts for the batch, and inserts new production/challenger/correlation rows with `sourceRunIdsJson`.
- `publishOperationalProjection(...)` is the active-run mirror writer: it rewrites semesters 1-5 transcript rows, semester 6 proof attendance/assessment mirrors, refreshes active risk/alert/elective timestamps, and updates `studentAcademicProfiles.prevCgpaScaled`.
- Default faculty, HoD, and student proof views can be checkpoint-backed while labeled as `proof-run` when the activated proof semester diverges from `batches.currentSemester` or active-risk rows are absent; this is code-backed and test-backed same-truth nuance, not yet live-confirmed.
- `academic-authoritative-first` helpers choose authoritative families wholesale once any authoritative rows exist, so runtime-only task/calendar shadow data can disappear instead of being merged record-by-record.
- No new contradiction was added in this pass; the remaining backend provenance uncertainty is deployed runtime proof, not local lineage ambiguity.

## Same-Student Cross-Surface Parity Pass (2026-04-16)

- The stale same-student pass control plane was manually reconciled: the status/checkpoint pair had claimed `running` with `pid=958497` and `execution_supervisor_pid=959058`, but `ps` found no such processes and the archived log was wrapper-only. This run wrote the missing durable parity artifact, a pass last-message, and terminal control-file truth.
- Durable parity artifact: `audit-map/32-reports/same-student-cross-surface-parity-report.md`.
- Local parity is now materially mapped:
  - parity seed lineage is explicit in `air-mentor-api/scripts/generate-academic-parity-seed.ts`
  - explicit checkpoint render fixtures align faculty-profile, HoD, risk explorer, and student shell on `mnc_student_001 / 1MS23MC001 / run_001 / checkpoint_001 / semester 6 / Post TT1`
  - committed backend tests bind course leader / mentor queue students to the same student-shell and risk-explorer drilldowns
  - HoD summary aligns with sysadmin dashboard and faculty-profile queue load in local backend tests
- Fresh verification in this shell:
  - frontend parity render suite passed `35/35`
  - backend DB-backed parity rerun was blocked by sandbox `listen EPERM: operation not permitted 127.0.0.1`
- New contradiction `C-021`: default faculty, HoD, and student proof slices can recurse into checkpoint-backed data and then relabel the payload as `countSource=proof-run` while clearing checkpoint metadata.
- Audit-OS drift remains on this same pass family even after manual reconciliation: the primary fields are terminal, but the status file restamped supervisor/progress metadata to `watching` / `attempt-log`. Treat the durable report, the pass last-message, and checkpoint `last_event=completed` as authoritative (`C-022`).
- Same-student parity is therefore no longer blocked by a missing artifact. It remains blocked only at the live same-target layer: Railway session-contract failure, lack of a safe read-only proof observer, and no fresh deployed tuple capture.
- Updated credible follow-on order: credentialed `live-behavior-pass` or a new read-only parity observer pass, then re-check `C-021` against deployed behavior.

## Deterministic Proof Contract Remediation (2026-04-16)

- Deterministic remediation wave completed for proof-risk and cross-surface parity contracts: canonical stage/phenotype action-catalog diagnostics, runtime/playback catalog validity enforcement, feature confidence propagation, queue-priority scalar alignment, fallback probability suppression, and advisory derived-head framing.
- Cross-surface parity test stability improved by role-switch sequencing fixes and deterministic student selection fallback inside the backend integration suite.
- Local verification evidence is captured in `audit-map/17-artifacts/local/2026-04-16T2054Z--deterministic-proof-remediation--local--test-evidence.md`.
- Command-backed test results from this wave:
  - `air-mentor-api/tests/proof-risk-model.test.ts`: pass `3/3`
  - `air-mentor-api/tests/policy-phenotypes.test.ts`: pass `4/4`
  - `air-mentor-api/tests/risk-explorer.test.ts`: pass `7/7`
  - `tests/risk-explorer.test.tsx`: pass `5/5`
- Edited-file static diagnostics are clean (`get_errors` reported no errors across all changed source and test files in this tranche).

## Prompt Pack And Overnight Automation Refresh (2026-04-18)

- The adversarial orchestrator suite is now expanded to Prompt `0-14` with six added deep-integrity passes (truth drift, feature intent, cross-flow recovery, fault tolerance/degradation, memory lifecycle cleanup, UX cohesion), plus mandatory schema blocks for truth/intent/logic/UX/recovery integrity.
- Prompt 0 now hard-fails on unresolved truth drift and open intent/logic/UX integrity blockers, and requires new outputs `truth-drift-ledger.json` plus `intent-logic-ux-failure-register.md`.
- New standalone pass prompts were added under `audit-map/20-prompts/` so the queue/orchestrator can execute the six added passes overnight without custom prompt wiring.
- Route selection hardening now excludes slots with blocked usage, failing route state, or failing last execution probe class; this prevents fallback loops onto provider-rejected routes.
- Overnight orchestrator startup now reclaims stale idle-shell tmux sessions, and usage-refresh/night-run status reflection is repaired for deterministic unattended runs.
- Current handoff and execution instructions are in `audit-map/32-reports/overnight-net-agent-handoff-2026-04-18.md`; account autoswitch readiness snapshot is in `audit-map/25-accounts-routing/autoswitch-readiness-2026-04-18.md`.

## Truth Drift Reconciliation (2026-04-18)

- Environment drift check passed for route assumptions: the active truth-drift session is still on `native-codex / native-codex-session / gpt-5.4 / xhigh`, native route health is `clear`, and Caveman is globally forced `full`.
- `audit-map/32-reports/current-run-status.md` was stale before this pass: it still claimed the queue was empty and the pipeline finished on `2026-04-16`, but the live 2026-04-18 control plane showed a non-empty `pending.queue`, an active `truth-drift-reconciliation-pass`, a stale night-run orchestrator, and a running usage-refresh orchestrator.
- Pre-fix `audit-map/32-reports/operator-dashboard.md` was a transient stale snapshot from `2026-04-18 00:18:38 UTC`: it still showed `night-run-orchestrator` as `running` and `usage-refresh-orchestrator` as `stale` even though status/checkpoint truth flipped at `2026-04-18T00:20:03Z` to `night-run=stale` and `usage-refresh=running`.
- Current status/checkpoint truth no longer reproduces the earlier supervisor-drift contradictions on `frontend-long-tail-pass`, `live-credentialed-parity-pass`, `unknown-omission-pass`, and `same-student-cross-surface-parity-pass`; `C-012`, `C-016`, `C-020`, and `C-022` are historical resolved drift unless a future snapshot regresses.
- Prompt metadata is internally coherent at `v5.4`; no `prompt-index` / version-history / change-log drift was found.
- This pass wrote a frozen pre-fix snapshot under `audit-map/18-snapshots/repo/2026-04-18T002343Z--truth-drift-control-plane-snapshot.txt` and a P9 findings artifact under `audit-map/17-artifacts/local/2026-04-18T002343Z--truth-drift-reconciliation--local--findings.json`.

## Truth Drift Reconciliation Refresh (2026-04-18T00:45:56Z)

- The earlier `00:23:43Z` truth-drift refresh was not durable enough on its own: a second control-plane wave at `2026-04-18T00:40:26Z` / `00:40:31Z` restarted `night-run-orchestrator`, `usage-refresh-orchestrator`, and `truth-drift-reconciliation-pass`, but `current-run-status.md` still described the earlier state until this refresh rewrote it.
- Direct `tmux ls` and `tmux has-session -t <session>` probes from this shell now fail with `Operation not permitted`, so current-shell tmux visibility is `inaccessible`, not `present`; status/checkpoint/log truth must stay authoritative unless tmux access is re-established.
- The pre-fix `operator-dashboard.md` also lagged current truth: it still advertised tmux `present` for active sessions because it had been generated before the direct shell-level tmux denial was rechecked. Regenerating the dashboard from the current shell now aligns tmux visibility with the direct probe result.
- Coverage row 40 had an artifact-claim drift: it cited `audit-map/32-reports/truth-drift-reconciliation-report.md` and an older findings JSON path, but neither file nor the truth-drift pass last-message existed on disk. This refresh repaired that bundle with a new report, pass last-message, and `2026-04-18T00:45:56Z` findings JSON.
- Contradiction `C-024` recurred after the `00:40Z` rerun and is resolved again in this refresh. New contradiction record `C-025` captured the missing truth-drift artifact bundle and is resolved in-pass.
- Prompt metadata remains coherent at `v5.4`, and open product contradictions remain unchanged: this refresh repaired audit-OS truth only.

## Cross-Flow Recovery Pass (2026-04-18)

- Discovered a critical data integrity bug (P11-C04) where partial failure during academic repository writes caused a phantom success UI.
- The local cache in `src/repositories.ts` was mutated optimistically before the API call succeeded, and was not reverted if the API call failed.
- Fixed `saveTasks`, `saveTimetableTemplates`, `saveTaskPlacements`, and `saveCalendarAudit` to wrap the API calls in a try/catch block and revert the local cache on error.
- Wrote a deterministic integration test `tests/cross-flow-recovery.test.ts` to prove the phantom success UI and verify the fix.
- The test now passes, confirming that the local cache is correctly reverted on network failure.
- Generated `prompt-output-P11.json` with the required finding schema and test output.

## P0 Summary Artifact Reconciliation (2026-04-18T08:47:58Z)

- Verified terminal control-plane truth from live files: `pending.queue` is empty, `night-run-orchestrator` is `completed` (`00:40:27Z` -> `03:21:59Z`, `exit_code=0`), and `usage-refresh` plus `overnight-watchdog` are now terminal `stale` with `tmux_visibility=missing`.
- Regenerated `audit-map/32-reports/operator-dashboard.md` from current status/checkpoint files to remove stale running-state assumptions.
- Rewrote `audit-map/32-reports/current-run-status.md` to terminal campaign truth, including final rerun-window completions (`truth-drift` through `cost-optimization`) and current contradiction boundary.
- Backfilled four zero-byte pass summaries from status/checkpoint/log plus durable report evidence:
  - `audit-air-mentor-ui-bootstrap-closure-readiness-pass.last-message.md`
  - `audit-air-mentor-ui-bootstrap-feature-intent-integrity-pass.last-message.md`
  - `audit-air-mentor-ui-bootstrap-residual-gap-closure-pass.last-message.md`
  - `audit-air-mentor-ui-bootstrap-unknown-omission-pass.last-message.md`
- Open contradiction set after local contradiction closure refresh: `C-001`, `C-002`, `C-003`, `C-004`, `C-005`, `C-007`, `C-015`, `C-017`, `C-018`, `C-019`.

## Local Contradiction Closure Refresh (2026-04-18)

- C-006 is closed locally: `SystemAdminRequestWorkspace` exposes `Needs Info` and `Reject` controls with status gating, and targeted frontend request-workspace tests pass (`3/3`).
- C-011 is closed locally: faculties section selector uses batch canonical `sectionLabels`, and targeted faculties-workspace tests pass (`10/10`) for canonical-section coverage.
- C-021 is closed locally: default fallback provenance across faculty / HoD / risk-explorer / student-shell remains checkpoint-explicit under forced run-vs-batch semester divergence; backend regression `keeps default proof surfaces checkpoint-explicit when semester pointers diverge` passes (`1/1`).
- Local closure boundary is now explicit: these contradictions are resolved in code + targeted tests, while live same-target capture and deployment/session blockers remain open under `C-015`, `C-017`, `C-018`, and `C-019`.

## Overnight Merge Final Decisions (2026-04-22)

- Named authority drift 犹在：tracked corpus 仍缺 `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md`；旧 frozen appendix path 于本轮前亦缺。故今并账唯用 proxy authority：`audit-map/20-prompts/prompt-index.md`, `audit-map/01-inventory/docs-index.md`, `docs/closeout/final-authoritative-plan.md`, `docs/closeout/assertion-traceability-matrix.md`。
- `audit-map/14-reconciliation/final-decision-appendix.md` 今仅为 non-synthetic guard stub：未重构任何 frozen rule，`Overnight Additions (2026-04-22)` 故意置 `None`。
- Unified merge artifacts：
  - `audit-map/14-reconciliation/overnight-unified-ledger.md`
  - `audit-map/32-reports/overnight-unified-mitigation-plan.md`
  - `audit-map/14-reconciliation/contradiction-matrix.md` 与 `audit-map/14-reconciliation/reconciliation-log.md` 之 overnight appended sections
- Proof lifecycle 真义今归一处：
  - activation = `range guard -> checkpoint availability -> run/batch rewrite -> active-only republish`
  - semester authority = operational `run -> batch`；checkpoint-bound `checkpoint -> run -> batch`
  - progression = chain-first, gate-second；`openQueueCount > 0` 即阻；first blocked checkpoint 继而锁后续 playback
  - reset split = `reset-current-stage` artifact purge vs `complete-reset` snapshot restore to new active run
  - vocabulary = `running/queued -> completed -> active/archived`；`completed-inspectable` 为行为，非 enum
- ML 真义今归一处：
  - scorer = five heads first，`riskBand` second
  - docs 须拆 model / policy / monitoring / simulator-runtime
  - CatBoost 非 current challenger runtime truth；Beta 非 current active default；active artifact 仍示 `isotonic`
  - v8 missingness fix 仍半落地，待 callers 真传 `cgpaMissing` / `backlogMissing`
  - current overload diagnosis = missingness authority gap + stage skew + capacity clamp，非单点 calibration blame
  - 未闭 code gaps 尚有 multiplicative intervention fn、latent first-class schema、sem6 residue、governance case-key breadth
- Queue / calendar / HOD 真义今归一处：
  - `workflow task != primary concern case`
  - `concernContextKey` 仍属 required-by-spec but absent-in-code；勿 alias 为 `queueCaseId` 或 `primaryCase`
  - calendar drag/detail-reschedule 乃 real `dueDateISO` write，并留 audit events
  - HOD `Action Needed` 只计 governed `open`；`Watching` 可见而不阻
  - HOD correction authoritative chain = `request -> approve/reject -> clear-lock/reset-unlock -> edit -> recompute -> relock`
- Downstream 执行序已冻于 `overnight-unified-mitigation-plan.md` Phase `1..11`：authority freeze -> proof docs -> queue/calendar/HOD docs -> ML doc truth -> contract/code gaps -> focused regression -> handoff freeze。

## Queue / Case / Calendar Reconciliation (2026-04-25)
- `concernContextKey` spec 凍結為 4-tuple [studentId + offeringId + concernFamily + semesterNumber]；碼中冗餘 `courseCode` 待清理。
- Workflow 任務隔離：`approval-unlock`, `escalation-review` 等 workflow 嚴禁混入 primary student concern case。
- HOD Correction 鏈條閉環：記述 `request -> approve -> reset-unlock -> edit -> recompute -> relock` 完整週期。
- Dismissal = Handled：確認 `dismissal` 與 `handled` 語義合一，均指 Case 結案。
- Calendar 權威同步：Calendar drag 須確保 DB `due_at` 之權威寫回，非僅 UI 表現。

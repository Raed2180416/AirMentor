# Manual Action Required

## Open Items

1. If you want Arctic Codex or Copilot to auto-route higher visible tiers such as `gpt-5.4` or `gpt-5.4-mini`, keep iterating on execution smoke until those exact runtime models produce stable success markers; the controller now pins Arctic alternates to the slot's currently execution-verified model instead.
2. If repo-local Caveman auto-start is desired, decide whether the existing repo-root `.codex` file can be replaced by a directory-based Codex config.
3. If live auth-required flows are needed, provide or confirm the current live credentials used by the repo's verification scripts.
4. To finish the authenticated `live-behavior-pass`, rerun from a network-enabled environment that can resolve the live hosts and can use Playwright or equivalent browser automation. The current native Codex shell still fails direct Node fetches to both live hostnames with `getaddrinfo EBUSY`, and Playwright MCP browser calls are still cancelled before navigation. Export `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER` and `AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD`, then run `PLAYWRIGHT_APP_URL=https://raed2180416.github.io/AirMentor/ PLAYWRIGHT_API_URL=https://api-production-ab72.up.railway.app/ AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=<identifier> AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=<password> bash scripts/verify-final-closeout-live.sh`. Remaining uncovered scope: live login, overview, faculties workspace, request flow, proof semester walk, teaching parity, HoD proof/risk, student-shell proof parity, accessibility, keyboard, session security, and fresh Railway `/`, `/health`, `/openapi.json`, and session-contract capture.
5. To finish `live-credentialed-parity-pass`, first export the live system-admin credentials and run only the session-contract preflight: `cd /home/raed/projects/air-mentor-ui/air-mentor-api && RAILWAY_PUBLIC_API_URL=https://api-production-ab72.up.railway.app EXPECTED_FRONTEND_ORIGIN=https://raed2180416.github.io AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=<identifier> AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=<password> npm run verify:live-session-contract`. Do not run `playwright:admin-live:teaching-parity` on the deployed stack yet: current script inspection shows that `system-admin-proof-risk-smoke.mjs` can mutate proof lifecycle state and `system-admin-teaching-parity-smoke.mjs` patches faculty records without a fully proven restore path. Remaining uncovered scope: shared live target tuple, same-student invariants across `SYSTEM_ADMIN` / `COURSE_LEADER` / `MENTOR` / `HOD` / student-shell, safe read-only proof observation, and live browser-rendered screenshots/network evidence.
6. To finish Anthropic account-label closure, rerun `bash audit-map/16-scripts/arctic-slot-login.sh anthropic:anthropic-main`, choose `Yes` for adding another connection, complete Claude OAuth in intended Zen account, paste returned authorization code, and when prompted by the wrapper type the exact Anthropic account email/name used in Zen. Then rerun `bash audit-map/16-scripts/arctic-verify-slot-execution.sh --slot anthropic-main --probe-best --format json` and confirm the row still reports `execution_provider_identity=anthropic-org-c6cb4546-f02c-44be-8176-45ae188f31d1` (or the new org marker if account changed).
5. Resolved on `2026-04-15T18:41:16Z`: `unattended-run-pass` completed after native quota failover to Arctic `codex-01` on `gpt-5.3-codex`. Earlier non-terminal drift notes are stale; `audit-map/29-status/audit-air-mentor-ui-bootstrap-unattended-run-pass.status` and `audit-map/30-checkpoints/audit-air-mentor-ui-bootstrap-unattended-run-pass.checkpoint` are authoritative.

## Arctic Slot Login Posture

- All requested slots are authenticated and model-visible.
- The installed Arctic CLI on this machine still does not accept the documented `--name` account flag.
- Therefore do not log repeated providers into the shared global Arctic auth store unless you explicitly intend a legacy single-store flow.
- Continue using the slot-aware isolated-store sequence for any future re-authentication.

## Canonical Slot Map

Use `25-accounts-routing/desired-provider-account-plan.md` as the source of truth for:

- which real account belongs in each slot
- which account label to type when `arctic-slot-login.sh` asks what you actually authenticated
- which provider each slot should use

## Legacy Shared-Store Escape Hatch

Only if you intentionally want the unsafe legacy shared global Arctic auth store:

- `bash audit-map/16-scripts/arctic-guided-login.sh --global codex google github-copilot`

Do not use that path for six Codex accounts and two Copilot accounts.

## Current Arctic Execution Gap

- `google-main` is now execution-verified on `google/gemini-3.1-pro-preview`.
- All six Arctic Codex slots are now execution-verified on `codex/gpt-5.3-codex`.
- `copilot-raed2180416` is now execution-verified on `github-copilot/gemini-3.1-pro-preview` and `github-copilot/gpt-4.1`.
- `copilot-accneww432` is now execution-verified on `github-copilot/gemini-3.1-pro-preview`.
- Arctic Codex `gpt-5.4` and `gpt-5.4-mini` are still only visible, not separately execution-verified.
- Visible `github-copilot/gpt-5.4` is still rejected at runtime as `model_not_supported`.
- That means Arctic is currently safe for account continuity and model inventory everywhere, and safe for unattended alternate execution on the pinned Codex `gpt-5.3-codex` route, the Google slot, and the verified Copilot Gemini route.

## Provider readiness wait expired (2026-04-15T09:11:47Z)

- Pass 'route-map-pass' could not reach a verified route. Last state: wait. Reason: No execution-verified Arctic slot is ready for provider 'codex'.. Resume with 'bash audit-map/16-scripts/select-execution-route.sh route-map-pass --require-provider codex'.

## Overnight pass stopped (2026-04-15T09:16:34Z)

- Session 'audit-air-mentor-ui-bootstrap-route-map-pass' ended the overnight queue with state='stale'. Inspect its status/checkpoint/log trio before resuming.

## Overnight pass stopped (2026-04-15T09:53:52Z)

- Session 'audit-air-mentor-ui-bootstrap-role-surface-pass' ended the overnight queue with state='failed'. Inspect its status/checkpoint/log trio before resuming.

## Overnight launch failure (2026-04-15T14:31:56Z)

- Pass 'data-flow-pass' could not launch from the overnight queue. Queue entry was retained. Review the launch output in the current terminal and rerun night-run-orchestrator after fixing the blocker.

## Execution recovery failed (2026-04-15T15:26:33Z)

- Pass 'ml-audit-pass' exhausted automatic recovery after provider='native-codex' slot='native' model='gpt-5.4'. Inspect the latest attempt log under /home/raed/projects/air-mentor-ui/audit-map/22-logs and resume with 'bash audit-map/16-scripts/recover-from-failure.sh ml-audit-pass bootstrap resume'.

## Overnight pass stopped (2026-04-15T15:27:03Z)

- Session 'audit-air-mentor-ui-bootstrap-ml-audit-pass' ended the overnight queue with state='failed'. Inspect its status/checkpoint/log trio before resuming.

## Overnight pass stopped (2026-04-15T19:52:16Z)

- Session 'audit-air-mentor-ui-bootstrap-synthesis-pass' ended the overnight queue with state='stale'. Inspect its status/checkpoint/log trio before resuming.

## Overnight pass stopped (2026-04-15T20:19:39Z)

- Session 'audit-air-mentor-ui-bootstrap-synthesis-pass' ended the overnight queue with state='stale'. Inspect its status/checkpoint/log trio before resuming.

## Execution recovery failed (2026-04-15T21:02:11Z)

- Historical only: an earlier `claim-verification-pass` attempt exhausted automatic recovery after provider='github-copilot' slot='copilot-accneww432' model='gpt-5.3-codex`, but the current native-Codex rerun started at `2026-04-15T21:25:46Z` supersedes that failed attempt. Do not resume the failed Copilot attempt unless the active native status/checkpoint/log trio later ends non-terminal again.

## Overnight pass stopped (2026-04-15T21:02:12Z)

- Historical only: the failed overnight `claim-verification-pass` session was superseded by the current native-Codex rerun. Treat the active `audit-map/29-status/audit-air-mentor-ui-bootstrap-claim-verification-pass.status` and paired checkpoint as authoritative instead.

## Execution recovery failed (2026-04-15T22:01:16Z)

- Pass 'unknown-omission-pass' exhausted automatic recovery after provider='native-codex' slot='native' model='gpt-5.4'. Inspect the latest attempt log under /home/raed/projects/air-mentor-ui/audit-map/22-logs and resume with 'bash audit-map/16-scripts/recover-from-failure.sh unknown-omission-pass bootstrap resume'.

## Overnight pass stopped (2026-04-15T22:01:30Z)

- Session 'audit-air-mentor-ui-bootstrap-unknown-omission-pass' ended the overnight queue with state='failed'. Inspect its status/checkpoint/log trio before resuming.

## tmux access denied (2026-04-15T22:17:52Z)

- The current shell cannot access the tmux socket. Re-run the tmux wrapper from a shell with real user-session tmux access.

## tmux access denied (2026-04-15T22:17:52Z)

- The current shell cannot access the tmux socket. Re-run the tmux wrapper from a shell with real user-session tmux access.

## Execution recovery failed (2026-04-15T22:34:02Z)

- Pass 'residual-gap-closure-pass' exhausted automatic recovery after provider='github-copilot' slot='copilot-accneww432' model='gpt-5.3-codex'. Inspect the latest attempt log under /home/raed/projects/air-mentor-ui/audit-map/22-logs and resume with 'bash audit-map/16-scripts/recover-from-failure.sh residual-gap-closure-pass bootstrap resume'.

## Execution recovery failed (2026-04-15T22:35:35Z)

- Pass 'closure-readiness-pass' exhausted automatic recovery after provider='github-copilot' slot='copilot-accneww432' model='gpt-5.3-codex'. Inspect the latest attempt log under /home/raed/projects/air-mentor-ui/audit-map/22-logs and resume with 'bash audit-map/16-scripts/recover-from-failure.sh closure-readiness-pass bootstrap resume'.

## Overnight pass stopped (2026-04-15T22:35:35Z)

- Session 'audit-air-mentor-ui-bootstrap-closure-readiness-pass' ended the overnight queue with state='failed'. Inspect its status/checkpoint/log trio before resuming.

## Execution route not ready (2026-04-15T23:51:16Z)

- Pass 'closure-readiness-pass' could not start automatically. Reason: Observed native Codex cooldown is active until 2026-04-16T01:16:00Z; route selection should prefer a verified alternate provider.. Resume with 'bash audit-map/16-scripts/select-execution-route.sh closure-readiness-pass --requested-model gpt-5.4'.

## tmux access denied (2026-04-16T15:43:48Z)

- The current shell cannot access the tmux socket. Re-run the tmux wrapper from a shell with real user-session tmux access.

## Overnight launch failure (2026-04-18T00:18:25Z)

- Pass 'truth-drift-reconciliation-pass' could not launch from the overnight queue. Queue entry was retained. Review the launch output in the current terminal and rerun night-run-orchestrator after fixing the blocker.

## Provider rotation required (2026-04-19T13:05:04Z)

- cycle-test-1 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:04Z)

- cycle-test-2 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:05Z)

- cycle-test-3 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:05Z)

- cycle-test-4 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:05Z)

- cycle-test-5 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:05Z)

- cycle-test-6 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:05Z)

- cycle-test-7 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:05Z)

- cycle-test-8 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:06Z)

- cycle-test-9 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:06Z)

- cycle-test-10 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:06Z)

- cycle-test-11 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:06Z)

- cycle-test-12 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:06Z)

- cycle-test-13 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Provider rotation required (2026-04-19T13:05:07Z)

- cycle-test-14 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'.

## Arctic login required (2026-04-19T17:48:41Z)

- Run 'bash audit-map/16-scripts/arctic-slot-login.sh anthropic:anthropic-main', then verify with 'bash audit-map/16-scripts/arctic-slot-status.sh' and resume.

## Execution recovery failed (2026-04-20T03:13:51Z)

- Pass 'ml-optimal-model-deep-tune-pass' exhausted automatic recovery after provider='github-copilot' slot='copilot-accneww432' model='gemini-3.1-pro-preview'. Inspect the latest attempt log under /home/raed/projects/air-mentor-ui/audit-map/22-logs and resume with 'bash audit-map/16-scripts/recover-from-failure.sh ml-optimal-model-deep-tune-pass bootstrap resume'.

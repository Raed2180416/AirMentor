# Switch History

| Date | From | To | Reason | Status |
| --- | --- | --- | --- | --- |
| 2026-04-15 | none | none | Bootstrap only; no safe account switch verified yet | Recorded |
| 2026-04-15T09:11:46Z | native-codex:native-codex-session | native-codex:native-codex-session | dry-run rotation check Native Codex is the default verified execution path. | Ready |
| 2026-04-15T09:12:15Z | native-codex:native-codex-session | wait | dry-run rotation check after exclude fix No verified alternate provider is currently ready. | Waiting |
| 2026-04-15T09:12:26Z | native-codex:native-codex-session | wait | trace wait history append No verified alternate provider is currently ready. | Waiting |
| 2026-04-15T10:48:25Z | native-codex:unknown | google:google-main | Runtime failure class=quota-or-rate-limit Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-15T10:48:25Z | native-codex:native-codex-session | google:google-main | Runtime recovery after quota-or-rate-limit in pass 'data-flow-pass'. | Retried |
| 2026-04-15T14:35:36Z | native-codex:native-codex-session | google:google-main | Pass 'data-flow-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T14:57:39Z | google:google-main | codex:codex-04 | Runtime failure class=stalled-no-progress Native Codex is cooling down until 2026-04-16T14:55:00Z; using the highest-ranked verified alternate route. | Ready |
| 2026-04-15T14:57:39Z | google:google-main | codex:codex-04 | Runtime recovery after stalled-no-progress in pass 'data-flow-pass'. | Retried |
| 2026-04-15T15:10:00Z | native-codex:unknown | codex:codex-05 | Runtime failure class=quota-or-rate-limit Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-15T15:10:00Z | native-codex:native-codex-session | codex:codex-05 | Runtime recovery after quota-or-rate-limit in pass 'state-flow-pass'. | Retried |
| 2026-04-15T18:23:34Z | native-codex:unknown | codex:codex-06 | Runtime failure class=quota-or-rate-limit Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-15T18:23:34Z | native-codex:native-codex-session | codex:codex-06 | Runtime recovery after quota-or-rate-limit in pass 'prompt-self-improvement-pass'. | Retried |
| 2026-04-15T18:35:15Z | native-codex:unknown | codex:codex-01 | Runtime failure class=quota-or-rate-limit Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-15T18:35:15Z | native-codex:native-codex-session | codex:codex-01 | Runtime recovery after quota-or-rate-limit in pass 'unattended-run-pass'. | Retried |
| 2026-04-15T18:46:06Z | native-codex:native-codex-session | codex:codex-06 | Pass 'frontend-microinteraction-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T19:00:45Z | native-codex:native-codex-session | codex:codex-01 | Pass 'backend-provenance-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T19:16:03Z | native-codex:native-codex-session | codex:codex-04 | Pass 'workflow-automation-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T19:30:04Z | native-codex:native-codex-session | codex:codex-05 | Pass 'script-behavior-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T19:38:45Z | native-codex:native-codex-session | codex:codex-06 | Pass 'same-student-cross-surface-parity-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T19:46:15Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'audit-the-audit-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T19:51:15Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'synthesis-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T20:18:37Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'synthesis-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T20:46:05Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'claim-verification-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T20:46:38Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'unknown-omission-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T20:47:40Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'residual-gap-closure-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T20:48:43Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'closure-readiness-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T21:01:10Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'claim-verification-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T22:33:31Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'residual-gap-closure-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T22:34:34Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Pass 'closure-readiness-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T23:22:23Z | native-codex:native-codex-session | codex:codex-01 | Pass 'data-flow-corpus-rerun-pass' started on a verified alternate route. Verified Arctic slot is ready for provider 'codex'. Requested model 'gpt-5.4' is compatible with provider 'codex' but is not separately execution-verified on slot 'codex-01', so the slot's execution-verified model 'gpt-5.3-codex' was selected. | Started |
| 2026-04-15T23:39:06Z | native-codex:native-codex-session | codex:codex-02 | Pass 'proof-refresh-completion-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-15T23:46:08Z | native-codex:native-codex-session | codex:codex-03 | Pass 'frontend-long-tail-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-16T00:27:24Z | native-codex:native-codex-session | codex:codex-05 | Pass 'closure-readiness-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-16T18:37:22Z | native-codex:unknown | github-copilot:copilot-accneww432 | Runtime failure class=quota-or-rate-limit Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-16T18:37:22Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Runtime recovery after quota-or-rate-limit in pass 'unknown-omission-pass'. | Retried |
| 2026-04-16T18:39:23Z | native-codex:unknown | github-copilot:copilot-accneww432 | Runtime failure class=quota-or-rate-limit Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-16T18:39:23Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Runtime recovery after quota-or-rate-limit in pass 'residual-gap-closure-pass'. | Retried |
| 2026-04-16T18:41:24Z | native-codex:unknown | github-copilot:copilot-accneww432 | Runtime failure class=quota-or-rate-limit Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-16T18:41:24Z | native-codex:native-codex-session | github-copilot:copilot-accneww432 | Runtime recovery after quota-or-rate-limit in pass 'closure-readiness-pass'. | Retried |
| 2026-04-17T23:35:47Z | github-copilot:copilot-accneww432 | native-codex:native-codex-session | test rotation Native Codex is the default verified execution path. | Ready |
| 2026-04-18T00:56:08Z | native-codex:unknown | google:google-main | Runtime failure class=quota-or-rate-limit Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-18T00:56:08Z | native-codex:native-codex-session | google:google-main | Runtime recovery after quota-or-rate-limit in pass 'feature-intent-integrity-pass'. | Retried |
| 2026-04-18T01:16:41Z | google:google-main | github-copilot:copilot-accneww432 | Runtime failure class=stalled-no-progress Native Codex is cooling down until 2026-04-18T04:59:00Z; using the highest-ranked verified alternate route. | Ready |
| 2026-04-18T01:16:41Z | google:google-main | github-copilot:copilot-accneww432 | Runtime recovery after stalled-no-progress in pass 'feature-intent-integrity-pass'. | Retried |
| 2026-04-18T01:20:44Z | native-codex:native-codex-session | google:google-main | Pass 'cross-flow-recovery-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-18T01:40:51Z | native-codex:native-codex-session | google:google-main | Pass 'fault-tolerance-degradation-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-18T02:01:24Z | google:google-main | github-copilot:copilot-accneww432 | Runtime failure class=stalled-no-progress Native Codex is cooling down until 2026-04-18T04:59:00Z; using the highest-ranked verified alternate route. | Ready |
| 2026-04-18T02:01:24Z | google:google-main | github-copilot:copilot-accneww432 | Runtime recovery after stalled-no-progress in pass 'fault-tolerance-degradation-pass'. | Retried |
| 2026-04-18T02:05:58Z | native-codex:native-codex-session | google:google-main | Pass 'memory-lifecycle-cleanup-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-18T02:26:31Z | google:google-main | github-copilot:copilot-accneww432 | Runtime failure class=stalled-no-progress Native Codex is cooling down until 2026-04-18T04:59:00Z; using the highest-ranked verified alternate route. | Ready |
| 2026-04-18T02:26:32Z | google:google-main | github-copilot:copilot-accneww432 | Runtime recovery after stalled-no-progress in pass 'memory-lifecycle-cleanup-pass'. | Retried |
| 2026-04-18T02:31:05Z | native-codex:native-codex-session | google:google-main | Pass 'ux-consistency-cohesion-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-18T02:51:39Z | google:google-main | github-copilot:copilot-accneww432 | Runtime failure class=stalled-no-progress Native Codex is cooling down until 2026-04-18T04:59:00Z; using the highest-ranked verified alternate route. | Ready |
| 2026-04-18T02:51:39Z | google:google-main | github-copilot:copilot-accneww432 | Runtime recovery after stalled-no-progress in pass 'ux-consistency-cohesion-pass'. | Retried |
| 2026-04-18T02:56:36Z | native-codex:native-codex-session | google:google-main | Pass 'cost-optimization-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-18T03:17:09Z | google:google-main | github-copilot:copilot-accneww432 | Runtime failure class=stalled-no-progress Native Codex is cooling down until 2026-04-18T04:59:00Z; using the highest-ranked verified alternate route. | Ready |
| 2026-04-18T03:17:09Z | google:google-main | github-copilot:copilot-accneww432 | Runtime recovery after stalled-no-progress in pass 'cost-optimization-pass'. | Retried |
| 2026-04-19T13:03:58Z | native-codex:unknown | wait | cycle-test-1 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:58Z | native-codex:unknown | wait | cycle-test-2 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:58Z | native-codex:unknown | wait | cycle-test-3 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:58Z | native-codex:unknown | wait | cycle-test-4 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:58Z | native-codex:unknown | wait | cycle-test-5 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:59Z | native-codex:unknown | wait | cycle-test-6 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:59Z | native-codex:unknown | wait | cycle-test-7 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:59Z | native-codex:unknown | wait | cycle-test-8 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:59Z | native-codex:unknown | wait | cycle-test-9 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:59Z | native-codex:unknown | wait | cycle-test-10 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:59Z | native-codex:unknown | wait | cycle-test-11 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:03:59Z | native-codex:unknown | wait | cycle-test-12 No verified alternate provider is currently ready. | Waiting |
| 2026-04-19T13:05:04Z | native-codex:unknown | manual-action-required | cycle-test-1 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:04Z | native-codex:unknown | manual-action-required | cycle-test-2 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:05Z | native-codex:unknown | manual-action-required | cycle-test-3 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:05Z | native-codex:unknown | manual-action-required | cycle-test-4 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:05Z | native-codex:unknown | manual-action-required | cycle-test-5 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:05Z | native-codex:unknown | manual-action-required | cycle-test-6 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:05Z | native-codex:unknown | manual-action-required | cycle-test-7 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:05Z | native-codex:unknown | manual-action-required | cycle-test-8 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:06Z | native-codex:unknown | manual-action-required | cycle-test-9 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:06Z | native-codex:unknown | manual-action-required | cycle-test-10 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:06Z | native-codex:unknown | manual-action-required | cycle-test-11 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:06Z | native-codex:unknown | manual-action-required | cycle-test-12 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:06Z | native-codex:unknown | manual-action-required | cycle-test-13 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:07Z | native-codex:unknown | manual-action-required | cycle-test-14 Requested model 'accneww432' is not compatible with provider 'gemini-3.1-pro-preview'. | Manual action required |
| 2026-04-19T13:05:42Z | native-codex:unknown | github-copilot:copilot-accneww432 | cycle-test-1 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:42Z | native-codex:unknown | github-copilot:copilot-raed2180416 | cycle-test-2 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:43Z | native-codex:unknown | antigravity:antigravity-02 | cycle-test-3 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:43Z | native-codex:unknown | antigravity:antigravity-03 | cycle-test-4 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:43Z | native-codex:unknown | antigravity:antigravity-04 | cycle-test-5 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:43Z | native-codex:unknown | antigravity:antigravity-main | cycle-test-6 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:44Z | native-codex:unknown | codex:codex-01 | cycle-test-7 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:44Z | native-codex:unknown | codex:codex-03 | cycle-test-8 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:44Z | native-codex:unknown | codex:codex-06 | cycle-test-9 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:44Z | native-codex:unknown | codex:codex-02 | cycle-test-10 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:45Z | native-codex:unknown | codex:codex-04 | cycle-test-11 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:45Z | native-codex:unknown | codex:codex-05 | cycle-test-12 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:45Z | native-codex:unknown | google:google-main | cycle-test-13 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:45Z | native-codex:unknown | github-copilot:copilot-accneww432 | cycle-test-14 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:46Z | native-codex:unknown | github-copilot:copilot-raed2180416 | cycle-test-15 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:05:46Z | native-codex:unknown | antigravity:antigravity-02 | cycle-test-16 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-1 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-2 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-3 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-4 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-5 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-6 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-7 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-8 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-9 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-10 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-11 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:24Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-12 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:25Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-13 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:25Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-14 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:25Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-15 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:25Z | unknown:unknown | native-codex:native-codex-session | rotation-smoke-16 Native Codex is the default verified execution path. | Ready |
| 2026-04-19T13:18:36Z | native-codex:unknown | antigravity:antigravity-03 | alt-rotation-smoke-1 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:36Z | native-codex:unknown | antigravity:antigravity-04 | alt-rotation-smoke-2 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:36Z | native-codex:unknown | antigravity:antigravity-main | alt-rotation-smoke-3 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:37Z | native-codex:unknown | codex:codex-01 | alt-rotation-smoke-4 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:37Z | native-codex:unknown | codex:codex-03 | alt-rotation-smoke-5 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:37Z | native-codex:unknown | codex:codex-06 | alt-rotation-smoke-6 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:38Z | native-codex:unknown | codex:codex-02 | alt-rotation-smoke-7 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:38Z | native-codex:unknown | codex:codex-04 | alt-rotation-smoke-8 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:38Z | native-codex:unknown | codex:codex-05 | alt-rotation-smoke-9 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:39Z | native-codex:unknown | google:google-main | alt-rotation-smoke-10 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:39Z | native-codex:unknown | github-copilot:copilot-accneww432 | alt-rotation-smoke-11 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:39Z | native-codex:unknown | github-copilot:copilot-raed2180416 | alt-rotation-smoke-12 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:39Z | native-codex:unknown | antigravity:antigravity-02 | alt-rotation-smoke-13 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:40Z | native-codex:unknown | antigravity:antigravity-03 | alt-rotation-smoke-14 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:40Z | native-codex:unknown | antigravity:antigravity-04 | alt-rotation-smoke-15 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-19T13:18:40Z | native-codex:unknown | antigravity:antigravity-main | alt-rotation-smoke-16 Native Codex is unavailable; using the highest-ranked verified alternate route. | Ready |
| 2026-04-20T01:16:39Z | native-codex:native-codex-session | antigravity:antigravity-02 | Pass 'ml-optimal-model-deep-tune-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-20T01:17:06Z | native-codex:native-codex-session | google:google-main | Pass 'ml-optimal-model-deep-tune-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-20T02:05:59Z | native-codex:native-codex-session | google:google-main | Pass 'ml-optimal-model-deep-tune-pass' started on a verified alternate route. Selected alternate route. | Started |
| 2026-04-20T02:26:33Z | google:google-main | wait | Runtime failure class=stalled-no-progress No execution-verified Arctic slot is ready for provider 'google'. | Waiting |
| 2026-04-20T02:53:04Z | google:google-main | github-copilot:copilot-accneww432 | Runtime failure class=stalled-no-progress No execution-verified slot is ready for provider 'google' after excluding slot 'google-main'; using the highest-ranked verified alternate route. | Ready |
| 2026-04-20T02:53:04Z | google:google-main | github-copilot:copilot-accneww432 | Runtime recovery after stalled-no-progress in pass 'ml-optimal-model-deep-tune-pass'. | Retried |
| 2026-04-20T03:03:27Z | github-copilot:copilot-accneww432 | google:google-main | Runtime failure class=stalled-no-progress Verified Arctic slot is ready for provider 'google'. | Ready |
| 2026-04-20T03:03:28Z | github-copilot:copilot-accneww432 | google:google-main | Runtime recovery after stalled-no-progress in pass 'ml-optimal-model-deep-tune-pass'. | Retried |
| 2026-04-20T03:13:51Z | google:google-main | github-copilot:copilot-accneww432 | Runtime failure class=stalled-no-progress No execution-verified slot is ready for provider 'google' after excluding slot 'google-main'; using the highest-ranked verified alternate route. | Ready |
| 2026-04-20T03:13:51Z | google:google-main | github-copilot:copilot-accneww432 | Runtime recovery after stalled-no-progress in pass 'ml-optimal-model-deep-tune-pass'. | Retried |
| 2026-04-20T05:03:13Z | native-codex:native-codex-session | google:google-main | Pass 'ml-optimal-model-deep-tune-pass' started on a verified alternate route. Verified Arctic slot is ready for provider 'google'. Requested model 'gpt-5.4' is compatible with provider 'google' but is not separately execution-verified on slot 'google-main', so the slot's execution-verified model 'gemini-3.1-pro-preview' was selected. | Started |
| 2026-04-20T05:23:47Z | google:google-main | github-copilot:copilot-accneww432 | Runtime failure class=stalled-no-progress No execution-verified slot is ready for provider 'google' after excluding slot 'google-main'; using the highest-ranked verified alternate route. | Ready |
| 2026-04-20T05:23:47Z | google:google-main | github-copilot:copilot-accneww432 | Runtime recovery after stalled-no-progress in pass 'ml-optimal-model-deep-tune-pass'. | Retried |

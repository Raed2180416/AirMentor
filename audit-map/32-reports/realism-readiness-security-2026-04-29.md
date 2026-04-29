# Readiness And Security Audit — 2026-04-29

## Intent And Feature Intent

吾驗 real-data readiness：demo may be safe, but production claims need security, privacy, audit, and model-governance proof.

Feature intent:

- Local demo readiness must not be confused with real institutional deployment readiness.
- Sessions, CSRF, CORS, cookies, telemetry, and redaction must have explicit contracts.
- Real-data import and model calibration must remain caveated unless proven.
- Security/audit gaps must be listed as gates, not hidden under working local seed data.

## Method

Read anchors:

- `docs/closeout/deploy-env-contract.md:28-54` for frontend/backend deploy contracts.
- `docs/closeout/deploy-env-contract.md:55-78` for live verification entrypoints.
- `docs/closeout/deploy-env-contract.md:86-103` for redaction and tests.
- `docs/closeout/final-authoritative-plan-security-observability-annex.md:24-57` for session, origin, CSRF, auth, and role-boundary expectations.
- `docs/closeout/final-authoritative-plan-security-observability-annex.md:59-89` for startup diagnostics and telemetry.
- `air-mentor-api/src/config.ts:75-115` for runtime config defaults.
- `air-mentor-api/src/modules/session.ts:39-88` for session payload and cookie sync.
- `audit-map/22-evals/environment-readiness-checklist.md:1-10` for environment checklist.

Runtime probes:

- Local API login and role switching.
- Local proof dashboard and recompute.
- Local HoD endpoint authorization.
- Browser tool attempted but blocked by missing Chrome.

## Real Data Contract

Current status: **demo-seed ready, real-data conditional.**

Strong points:

- Deploy env contract requires absolute HTTPS API base URL for production-like Pages origin.
- Backend production-like posture requires allowed origins, `SameSite=None`, secure cookie, explicit CSRF secret, and non-loopback posture checks.
- Live verification wrappers exist for session-contract and closeout flows.

Gaps:

- This audit did not load real institutional SIS/LMS data.
- No real historical outcome calibration artifact was verified.
- No data-processing agreement, retention schedule, or consent model was verified in code artifacts.
- No FERPA/India-specific institutional policy mapping was verified beyond redaction/session docs.

## Import Validation Gates

Pass for documented posture:

- Environment contract requires deploy variables and startup diagnostics.
- Local seeded data loaded enough to produce active proof run and 30 checkpoints after recompute.

Gaps:

- Real import schema validation was not exercised.
- Crosswalk review queue was visible in dashboard shape but not audited end-to-end.
- Missing/dirty CSV behavior was not tested in this pass.
- Duplicate student/course/faculty handling was not verified.

## Privacy Security And Audit Gates

Pass:

- Session payload includes session id, CSRF token, user, faculty, active grant, available grants, and preferences.
- Cookies are synchronized centrally by session routes.
- Config computes local vs production-like cookie posture.
- Annex states origin and CSRF enforcement for mutating requests.
- Annex states redaction of raw passwords, cookies, CSRF tokens, bearer tokens, provider secrets, and prompt payloads.
- Operational events include login, restore, logout, role context switch, proof run queue events, and client telemetry relay.

Conditional/gaps:

- Local config falls back to `csrfSecret = databaseUrl::sessionCookieName` if `CSRF_SECRET` is absent. This is acceptable locally but not production-grade.
- Live closeout requires secrets and Railway context; not run in this audit.
- No penetration test, dependency audit, or rate-limit stress test was run.
- CERT-In incident workflow and institutional audit export were not verified as executable workflows.
- Browser security posture could not be verified because Chrome was missing.

## Model Governance Gates

From the ML sanity report:

- Operational band overlay keeps `riskProb` unchanged.
- `displayProbabilityAllowed=false` suppresses fallback probability display.
- Synthetic proof model is demo-only; real deployment requires calibration on historical outcomes.
- Missingness and CO coverage need post-demo verification.

Readiness conclusion:

- Demo-safe if described as synthetic proof corpus.
- Not production-ready for real risk probability claims without calibration artifact, validation dataset, model card, drift monitoring, and human appeal process.

## Real Data Validation Gates

Not complete.

Required before real institution use:

- Real-data dry import with de-identified sample.
- Schema/crosswalk validation report.
- Missingness audit for marks, attendance, CGPA, backlogs, COs.
- Outlier and impossible-value report.
- Per-role access negative tests on real-like data.
- Historical calibration report for risk bands.
- Human review process for high-risk recommendations.

## Operational Readiness Gates

Local demo state:

- Backend and frontend servers were live locally.
- Pipeline DAG was created and dispatched.
- Provider failures occurred: Codex empty transcript and Codex `model_reasoning_effort=max` rejection. Both were root-caused; stderr and `max→xhigh` fixes were committed.
- Chrome missing blocks final browser verification.

Deployment readiness:

- Deploy env contract is strong and test-anchored.
- Live verification wrapper must be run with real secrets and Railway context before any live production claim.
- Current audit did not run the live wrapper.

## Blockers

- **Browser environment:** no Chrome/Chromium installed.
- **Live deployment:** live closeout not run in this pass.
- **Real data:** no real-data import validation run.
- **Model governance:** no real calibration artifact or model card verified.
- **Operational demo prep:** recompute/readiness and queue resolution are required before demo.

## Demo-Safe Caveats

Use these words in demo:

- This is a synthetic six-semester proof corpus.
- Risk band is operational urgency, not calibrated failure probability.
- Counterfactual simulator is projected/simulated, not causal proof.
- HoD must switch to active HOD role.
- Final browser proof is pending until Chrome environment is installed and rerun.

## Verdict

**Readiness/security verdict: DEMO-CONDITIONAL, NOT PRODUCTION-READY.**

The repo has good session, CSRF, origin, telemetry, redaction, and deploy-contract anchors. However, production readiness requires live closeout, real-data import validation, model governance artifacts, and browser security verification.

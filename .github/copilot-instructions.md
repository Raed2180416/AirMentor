# AirMentor Workspace Instructions

## Product Truth

AirMentor is a deterministic academic decision-rehearsal platform built on
synthetic data. It is not a validated real-student prediction product and it is
not a general-purpose student information system.

Read these first:

1. `docs/agent-map/AGENT_REPO_MAP_2026-06-06.md`
2. `docs/agent-map/repo-map.json`
3. `docs/PRODUCT_DIRECTION_AND_PRUNING_2026-06-06.md`
4. `docs/CURRENT_PRODUCT_CLEANUP_DECISION_MATRIX_2026-06-06.md`
5. `docs/DETERMINISTIC_SYSTEM_MAP_2026-06-05.md`
6. `docs/TARGET_ARCHITECTURE_2026-06-05.md`
7. `docs/AIRMENTOR_COMPLETE_REALISM_AUDIT_2026-06-04.md`

For exact navigation, query the generated JSONL indexes under `docs/agent-map/`
before broad source scans. Refresh them with `npm run agent:map` after structural
changes.

## Durable Repository Areas

- `src/`: React product surfaces.
- `air-mentor-api/src/`: Fastify API, policy, simulation, risk, and persistence.
- `tests/`, `air-mentor-api/tests/`, `tests-e2e/`: executable contracts.
- `docs/paper-evidence/`: bounded research claims and non-claims.
- `docs/readiness/`: security, retention, load, and model governance policies.

Generated databases, model runs, corpora, browser recordings, logs, screenshots,
and agent transcripts do not belong in Git. Store them under an external archive
with a manifest and checksum.

## Change Rules

- Preserve the synthetic-only claim boundary.
- Keep production scoring on the governed logistic path while challengers remain
  shadow-only.
- Prefer extracting a small boundary from a hotspot over initiating a broad
  architecture rewrite.
- Do not add a second program template until the existing program is driven by a
  real runtime template contract.
- Do not add generic SIS features unless they directly support scenario setup,
  evidence capture, intervention rehearsal, or auditability.
- Add or update focused unit, API, and browser contracts for visible behavior.

## Verification

```bash
npm run build
npm --workspace air-mentor-api run build
npm test -- --reporter=dot
npm --workspace air-mentor-api test -- --reporter=dot
```

Use focused Playwright specs for changed visible flows. Do not commit generated
Playwright output.

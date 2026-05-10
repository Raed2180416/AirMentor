# AirMentor P5-D Demo Workspace Provisioning Design

## Intent

AirMentor must let a college evaluator run an honest, complete local demo in a browser without mutating global or production-like academic data. Demo state must be clearly bounded, resettable, and synthetic/demo-only.

## Feature Intent

P5-D closes the next demo-isolation gap after P5/P9 browser proof and H9 performance baseline: a demo workspace must provision a complete seeded proof dataset and demo-bound sessions/credentials/runs, not just create an empty schema registry and pointer. This work improves local demo defensibility; it does not claim production readiness, real-data validation, or multi-program generalization.

## Current Truth

- Root branch `college-demo-2026-04-27` is clean at `3bc77f0` after H9.
- P5-A/P5-B/P5-C added demo workspace schema metadata, schema create/drop, demo session pointer/header, demo-bound session restore, proof-run scope guards, academic bootstrap scope guards, student-shell scope guards, reassessment scope guards, and checkpoint playback scope guards.
- `createDemoWorkspace` currently creates a schema and marks the workspace active, but metadata provisioned counts are zero.
- `previewDemoProvisioning` is dry-run only.
- `resetDemoWorkspace` deletes rows tagged with `demoWorkspaceId`, demo sessions, and the physical demo schema.
- Demo-bound teacher bootstrap intentionally rejects global active proof runs with `NO_ACTIVE_PROOF_RUN` when no demo-bound run exists.
- Broad physical `search_path` routing for every academic/proof query is not present.
- Multi-program templates and second-program proof remain P6, not P5-D.

## Scope

Included:

- Backend provisioning path that creates a complete MSRUAS seeded demo proof workspace under `demoWorkspaceId`.
- Demo-bound proof run activation without deactivating global active proof runs.
- Demo-bound proof credentials and sessions that cannot be restored without the matching workspace pointer.
- Reset evidence that demo-bound data, sessions, credentials, and workspace scope are removed while global data remains untouched.
- Regression coverage for create/provision/reset and demo/global non-interference.
- Conservative capability matrix/report update only after verification.

Excluded:

- Full physical schema `search_path` routing for all Drizzle queries.
- P6 program-template table and BTech ECE fixture.
- Production Render deployment readiness.
- Real institutional data import/validation.
- Production ML or per-program recalibration claims.

## Evaluator Scenario

Role and purpose:

- A system admin creates a demo workspace for a local evaluation session.
- The evaluator enters the demo workspace and expects demo credentials, proof dashboard, and academic shells to work from demo-bound state.
- A teacher or HoD session inside the demo workspace must not silently read the global active proof run.
- A normal global sysadmin/teacher session must remain unaffected by the demo workspace lifecycle.

Semester/stage:

- Provisioned demo data should support the existing MSRUAS six-semester proof run and stage checkpoints used by the proven browser suite.
- P5-D may seed one active run and credentials sufficient for existing proof dashboard and academic bootstrap flows.

Evaluator observation:

- Browser/API behavior is complete enough that the evaluator is not dropped into an empty demo workspace.
- Reset removes demo state and prevents stale demo login restore.
- Global state still works after demo create/reset.

## Recommended Architecture

Use `demoWorkspaceId` as the authoritative routing key for P5-D and keep physical schema as a registry/reset boundary for this lane.

Rationale:

- Existing scope guards already compare `auth.demoWorkspaceId` and `simulationRuns.demoWorkspaceId`.
- Existing reset already deletes rows tagged with `demoWorkspaceId`.
- Broad `search_path` routing would touch many Drizzle queries and risks breaking the already-proven browser suite.
- P5-D can close evaluator-visible provisioning truth without pretending every table is physically schema-routed.

## Components

### Provisioning service

Add a focused service that provisions seeded MSRUAS demo data for a workspace. It should:

- Validate that the workspace exists and is active.
- Reuse existing MSRUAS proof seeding/run creation primitives where safe.
- Tag new simulation runs and mutable demo rows with `demoWorkspaceId`.
- Activate the demo-bound run only within the demo scope.
- Update workspace metadata with provisioned counts and active run ID.
- Be idempotent for an already provisioned workspace.

### Admin route

Add a `POST /api/admin/demo-workspaces/:demoWorkspaceId/provision` route. It should:

- Require system admin role.
- Respect the caller's current session scope rules.
- Return workspace ID, active simulation run ID, and provisioned counts.
- Avoid claiming production/import behavior.

### Credential lifecycle

Provisioning should ensure demo academic credentials are usable only in demo scope. Existing login/session pointer rules should remain authoritative:

- Login with `X-AirMentor-Demo-Workspace` creates demo-bound sessions.
- Restore without pointer or with wrong pointer returns unauthorized.
- Reset deletes demo-bound sessions.

If proof credential rows are global by current design, P5-D should at minimum prove demo sessions cannot restore/read without workspace pointer and record any remaining credential-table limitation honestly.

### Reset

Reset remains destructive only to the selected demo workspace. It should return counts for deleted sessions/data/schema and leave global active proof run plus global rows untouched.

## Data Flow

1. Sysadmin creates a demo workspace.
2. Backend creates physical demo schema metadata and active workspace row.
3. Sysadmin calls provisioning for that workspace.
4. Provisioning creates or reuses seeded proof structures and creates a demo-bound active run.
5. Teacher/HoD login with the demo workspace header receives a demo-bound session.
6. Academic bootstrap resolves only demo-bound active run data.
7. Reset deletes demo-bound state and invalidates demo sessions.
8. Global sessions and global proof runs remain available.

## Error Handling

- Unknown workspace: typed 404 or existing route error style.
- Inactive/reset workspace: typed 409 or unauthorized depending on existing helper style.
- Provisioning failure: no production overclaim; return typed error if partial state can be detected.
- Repeated provisioning: idempotent success with existing active demo run when safe.
- Cross-scope run access: existing `PROOF_RUN_SCOPE_MISMATCH` and `NO_ACTIVE_PROOF_RUN` behavior remains.

## Testing and Verification

Minimum backend regression coverage:

- Create workspace then provision it; response has non-zero counts and active demo run.
- Demo-bound teacher bootstrap succeeds after provisioning and uses a demo-bound run.
- Demo-bound teacher bootstrap rejects global active run before provisioning.
- Demo proof activation does not deactivate or replace the global active proof run.
- Reset deletes demo-bound sessions/data and leaves global rows/runs untouched.
- Repeated provision is idempotent.

Minimum frontend/browser evidence if feasible:

- A focused Playwright/API flow creates/provisions a demo workspace, logs in with demo pointer, sees proof/academic surface, resets, then confirms stale demo restore fails.

Minimum static verification:

- Backend focused tests.
- Backend TypeScript no-emit.
- Root/frontend focused tests only if frontend API types or pointer behavior changes.

## Capability Matrix Boundary

After implementation, P5 may move forward only for seeded demo workspace provisioning. It must still say partial if broad physical schema routing, P6 multi-program templates, production readiness, or real-data validation remain incomplete.

## Claim Boundary

P5-D can claim that local demo workspaces provision and reset a complete seeded MSRUAS proof workspace with demo-bound sessions/runs under current `demoWorkspaceId` guards. P5-D cannot claim physical per-schema routing for every table, multi-program support, production deployment readiness, or real-data predictive validity.

## Approval State

User approved continuing with P5-D on 2026-05-10 by saying to do it all after the next-gap design was presented.

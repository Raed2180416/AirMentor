# AirMentor P5-B Demo Scoped Session And Browser Pointer Design — 2026-05-10

## Intent

Complete the next P5 vertical slice after the backend schema-scope registry/reset contract. P5-B makes demo browser/session state explicitly scoped to one active demo workspace while keeping global sessions and global academic data safe.

This is not the full demo data-plane virtualization. It is the smallest evaluator-visible slice that proves the browser cannot silently mix global and demo sessions, reset invalidates demo-scoped sessions, and the frontend stores only a non-secret demo pointer.

## Feature Intent

A system admin can create a demo workspace, switch the browser into that demo workspace, and exercise demo-scoped login/session restore through an explicit pointer. If the pointer is missing or wrong, demo-scoped sessions do not restore. Reset clears demo sessions and drops the demo schema proof from P5-A. Global sysadmin and teacher sessions remain outside the demo scope.

Evaluator-visible behavior:

- Active demo mode is represented by a workspace pointer, not copied data.
- Demo API calls carry the pointer in a request header.
- Demo login/session responses include the active demo workspace ID.
- Demo restore fails when the browser omits or changes the pointer.
- Reset removes demo-scoped sessions and schema resources.
- Browser storage does not contain generated credentials, proof data, marks, students, or tokens.

## Scope Boundary

Included in P5-B:

1. A backend request-scope contract for the active demo workspace header.
2. A session metadata column that binds sessions to a demo workspace when a demo header is present.
3. Session login/restore behavior that requires matching demo pointer for demo sessions.
4. Reset behavior that deletes demo-scoped session rows before dropping schema/resetting legacy tagged rows.
5. Frontend pointer-only persistence and API header injection.
6. Unit/API tests proving pointer behavior and reset invalidation.
7. Focused browser proof if local ports can be started safely.
8. Capability matrix update for verified P5 rows.

Deferred beyond P5-B:

- Routing every academic/proof table through the demo schema search path.
- Full demo credential seeding inside the schema.
- Multi-program demo template switching.
- Production deployment changes.
- Claims that the demo is real-data or production ML validated.

## Architecture

### Request Pointer

The frontend sends `X-AirMentor-Demo-Workspace: <demoWorkspaceId>` when the browser is in demo mode. The backend treats the header as a selector, not as authorization. Auth still comes from credentials/session cookies and role checks.

Backend validation rules:

- Header absent: request is global.
- Header present on login: workspace must exist, be active, have `scopeKind='schema'`, and have a safe `scopeName`.
- Header present on restore: session must already be bound to the same workspace.
- Wrong or missing header for a demo-bound session returns unauthorized instead of falling back to global.

### Session Binding

Add nullable `demo_workspace_id` to `sessions`.

- Global session: `demo_workspace_id = null`.
- Demo session: `demo_workspace_id = <active demo workspace>`.

The session payload includes:

- `demoWorkspaceId: string | null`.

This keeps the proof small and explicit. It avoids storing credentials or copied academic rows in browser storage.

### Reset Contract

`DELETE /api/admin/demo-workspaces/:demoWorkspaceId` performs these P5-B additions before existing P5-A drop/cleanup:

1. Delete sessions where `sessions.demoWorkspaceId` equals the workspace.
2. Drop the schema when `scopeKind='schema'` and `scopeName` is present.
3. Run legacy row-tag cleanup for compatibility.
4. Return `deletedSessions`, `deletedSchema`, and `scopeName`.

The global sysadmin session stays untouched because it has no demo workspace binding.

### Frontend Pointer Store

Create a small module that owns active demo pointer persistence.

Allowed persisted shape:

```ts
{ demoWorkspaceId: string }
```

Storage may not include:

- passwords,
- session IDs,
- CSRF tokens,
- generated credentials,
- marks,
- attendance,
- students,
- faculty rosters,
- proof checkpoints or risk evidence.

The API client reads the pointer and injects `X-AirMentor-Demo-Workspace` on requests. Existing global API calls work unchanged when the pointer is absent.

### UI Contract

P5-B keeps the UI lightweight:

- The admin/demo workspace UI can activate a workspace pointer.
- Existing demo badge can show the active workspace state.
- Exit/reset clears the pointer.

If a broader UI page is not already centralized enough to wire safely, tests can prove the storage/client behavior directly and a browser proof can exercise the minimal visible path.

## Data Flow

1. System admin creates a demo workspace through the existing global admin route.
2. Frontend stores `{ demoWorkspaceId }` as the active demo pointer.
3. API client sends `X-AirMentor-Demo-Workspace` with session requests.
4. Login creates a session bound to `demo_workspace_id`.
5. Restore succeeds only when the same header is present.
6. Restore with missing/wrong pointer fails with unauthorized.
7. Reset deletes demo-bound sessions and drops the workspace schema.
8. Frontend clears the pointer.
9. Global session behavior remains unchanged.

## Error Handling

Typed behavior:

- Missing/unknown workspace during demo login returns unauthorized/bad request through existing error style.
- Inactive/non-schema workspace is rejected before session creation.
- Demo-bound session restore without matching pointer returns unauthorized.
- Reset reports exact counts for deleted sessions and schema deletion result.

No request should silently downgrade a demo-bound session to global mode.

## Tests

Backend/API tests:

- Creates a demo workspace, logs in with the demo header, and receives `demoWorkspaceId` in payload.
- Restores the session with the same header successfully.
- Restore without the header fails for a demo-bound session.
- Restore with a different demo workspace header fails.
- Global login/restore without a demo header still works.
- Reset returns `deletedSessions > 0`, `deletedSchema=true`, and global session restore still works.

Frontend tests:

- Pointer store writes only `demoWorkspaceId`.
- Clearing pointer removes the item.
- API client injects `X-AirMentor-Demo-Workspace` only when a pointer exists.
- Reset/exit path clears the pointer.

Browser proof:

- If local frontend/backend can run safely, exercise create demo workspace, activate pointer, observe demo badge/header behavior, reset, and verify no console crash.
- If ports are unavailable, record exact preflight blocker and keep API/unit evidence as the verified scope.

## Capability Matrix Update

Only promote rows that have direct evidence:

- `Reset Demo Workspace`: backend schema drop plus demo session deletion verified.
- `Provisioning preview / dry run`: remains whatever current evidence supports; P5-B does not claim new provisioning depth.
- `Demo data isolation`: promote from missing to partial or works only for schema registry/reset/session pointer scope, with explicit note that full academic/proof data-plane routing is deferred.
- `Demo isolation regression test`: update to reflect the backend/session regression test names.

## Acceptance Criteria

P5-B is complete when:

1. Session rows can be bound to demo workspaces.
2. Demo-bound sessions require a matching pointer on restore.
3. Global sessions still work with no pointer.
4. Reset deletes demo sessions and drops the schema.
5. Browser storage stores only the active demo workspace ID.
6. Frontend client sends the demo pointer header and clears it on exit/reset.
7. Tests and typechecks pass.
8. Capability matrix states the precise verified scope and does not overclaim full data-plane virtualization.

## Non-Claims

P5-B does not claim:

- complete academic route virtualization through per-demo schema,
- seeded demo credentials inside the demo schema,
- deployment readiness,
- real institutional data validation,
- production-grade ML accuracy,
- multi-program demo generalization.

# Gap Analysis And Roadmap

## Purpose

This document now separates:

- what the mock-flow completion phase already resolved
- what remains intentionally deferred to backend and data-engine phases

The roadmap is now mock-first, because backend work should start only after the faculty journeys are walkable and the UX rules are stable.

## High-Level Status

| Area | Current Status | Next Owner |
| --- | --- | --- |
| Role switching | Mock-complete | Backend later for auth and permission enforcement |
| Mentor detail flow | Mock-complete | Backend later for persisted data and role scope |
| Student history flow | Mock-complete | Backend later for transcript ingestion and corrections |
| Queue ownership visibility | Mock-complete | Backend later for durable transitions and audit reporting |
| Unlock review flow | Mock-complete | Backend later for persisted approvals and notifications |
| Scheme setup flow | Mock-complete | Backend later for authoritative lifecycle enforcement |
| Marks entry and locks | Mock-usable | Backend later for durable state, validation, and imports |
| Transcript engine | Mock-seeded | Backend later for ingestion, recompute, and reconciliation |
| Risk engine | Deferred | Backend phase only |

## Resolved In The Mock Phase

### Navigation And Flow Completeness

Resolved:

- mentee list is no longer a dead-end
- student history exists
- unlock review exists
- scheme setup exists
- queue history exists

Meaning:

- the major faculty journeys are now walkable end to end in the mock

### Role Behavior Alignment

Resolved:

- role change redirects invalid page context more safely
- Mentor sees summary academics instead of a total marks blackout
- HoD self-escalation affordance is removed
- HoD no longer bypasses locked entry silently

Meaning:

- the UI now aligns more closely with the documented role model

### Queue Model Visibility

Resolved:

- owner chips are visible on queue cards
- reassignment actions are visible
- transition history exists
- resolved queue items are retained instead of auto-purged

Meaning:

- the single-owner queue concept is now visible in the mock rather than only described in docs

### Student History Foundation

Resolved:

- transcript terms and subject history are seeded
- SGPA and CGPA are visible
- failed-subject and repeated-subject examples exist
- history page is reachable from both student and mentor contexts

Meaning:

- prior-semester performance is now a real UX concept, not a note for later

## Still Deferred To Backend And Data Phases

### Persistence And Multi-User Truth

Still deferred:

- backend-owned entities
- multi-user task consistency
- durable audit trail outside browser storage
- transcript corrections and import jobs

### Academic Rules Engine

Still deferred:

- exact final subject score computation from live CE and SEE inputs
- official band mapping on backend-owned scores
- SGPA and CGPA recomputation from persisted transcript records
- lock enforcement beyond UI behavior

### Queue Engine

Still deferred:

- durable queue-item transitions
- notifications
- reporting and analytics over queue history
- escalation SLA handling

### Integrations And Imports

Still deferred:

- bulk marks import jobs
- transcript ingestion workflows
- ERP or LMS integration
- admin tooling for faculty-role assignment

### Risk Engine

Still deferred:

- backend-owned risk snapshots
- history-aware risk calculation
- automatic queue creation beyond the mock's seeded rules

## Remaining Frontend-Only Polish Items

These do not block backend design, but they are still worth tightening:

- make the narrow-width top bar less crowded
- add richer validation and empty states for import-like entry flows
- make the queue scale better if the sidebar becomes too dense
- refine some stage-based academic tab copy so representational pages are more obviously mock views

## Updated Roadmap

### Phase 0: Mock UI/UX Completion

Completed in this pass:

- rendered audit and screenshot evidence
- missing mock pages and flow wiring
- seeded transcript and history data
- seeded unlock-review and overdue-remedial scenarios
- queue transition visibility

### Phase 1: Frontend Contract Extraction

Next recommended step:

- extract current mock rules into typed service-facing contracts
- move local UI assumptions into shared domain view models
- preserve current UX while making the frontend backend-ready

### Phase 2: Backend Foundation

- faculty identity and role membership
- mentor assignment
- course offering and evaluation scheme
- queue item and transition persistence
- lock state persistence

### Phase 3: Academic Entry And Transcript Foundation

- marks-entry APIs
- unlock approval APIs
- transcript ingestion
- SGPA and CGPA computation

### Phase 4: Risk Foundation

- persist history-aware risk inputs
- compute backend-owned risk snapshots
- trigger automatic queue creation from persisted rules

## Definition Of Ready For Backend Work

Backend work should begin only when the team is satisfied that:

- the major faculty journeys are walkable in the mock
- role behavior is accepted
- scheme setup and unlock flow are accepted
- student history is accepted as a core requirement
- queue ownership behavior is accepted
- remaining gaps are mostly durability and data-engine concerns rather than missing UX concepts

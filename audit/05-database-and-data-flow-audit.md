# AirMentor Database And Data Flow Audit

## What this area does
This document audits the data model and how information moves through AirMentor: from institutional setup through runtime teaching state and into proof, analytics, and student-facing explanatory payloads.

## Confirmed observations
- `air-mentor-api/src/db/schema.ts` defines a large relational schema with many JSON columns used to preserve snapshots, payloads, policies, evidence, runtime state, and audit records.
- Migrations from `0000_admin_foundation.sql` through `0015_curriculum_linkage_candidates.sql` show staged expansion from foundation CRUD to runtime, proof, governance, queueing, and curriculum linkage.
- Runtime data moves through multiple representations:
  - normalized relational tables
  - JSON snapshot fields
  - bootstrap payloads
  - storage-backed client repositories
  - proof checkpoint payloads
- `air-mentor-api/scripts/generate-academic-parity-seed.ts` imports `src/data.ts`, `src/repositories.ts`, and `src/domain.ts`, which means the backend parity-seed pipeline depends directly on frontend local/mock modeling.

## Key workflows and contracts
### Core entity graph
`institutions -> academic_faculties -> departments -> branches -> batches -> academic_terms -> section_offerings`

### Identity and authority graph
`user_accounts -> user_password_credentials -> sessions -> faculty_profiles -> faculty_appointments -> role_grants`

### Student academic graph
`students -> student_enrollments -> mentor_assignments -> student_academic_profiles -> attendance / assessment / intervention / transcript tables`

### Proof and simulation graph
`curriculum_import_versions -> simulation_runs -> simulation_stage_checkpoints -> student_observed_semester_states / risk_evidence_snapshots / risk_assessments / reassessment_events / alert_decisions / student_agent_cards / student_agent_sessions / student_agent_messages`

### Runtime state graph
`academic_runtime_state`, `academic_tasks`, `academic_task_placements`, `faculty_calendar_workspaces`, `academic_calendar_audit_events`, `academic_meetings`

## Current-state reconciliation (2026-03-28)
- Stage 5 is partially implemented but not complete:
  - additive narrow runtime contracts now exist for `tasks`, `task-placements`, and `calendar-audit`
  - conflict handling and runtime shadow-drift telemetry exist for those narrow writes
  - the legacy coarse `/sync` contracts still exist and remain part of the runtime surface
- The data-model weakness described here is still real. The repo has not yet completed runtime/proof fact normalization, so JSON-heavy state carriers and read-time shaping remain central.

## Findings
### Data-model strengths
- The schema reflects the real product domain instead of collapsing everything into a generic “records” table.
- Audit and history tables are present for several important subsystems, especially requests, offering stage advancement, proof lifecycle, and simulation reset.
- The schema is rich enough to support both live-runtime and seeded proof modes.

### Data-model weaknesses
- The model uses a large number of JSON-encoded fields to carry structured domain payloads. That is practical in the short term but weakens queryability, constraint power, and long-term migration clarity.
- The same business concept often exists in multiple layers:
  - relational rows
  - JSON snapshots in the database
  - hydrated frontend objects
  - storage-backed browser copies
- `academic_runtime_state` is a generic slice bucket, which makes the data model flexible but weakly self-describing even after the additive narrow runtime routes landed.

## Implications
- **Technical consequence:** debugging requires knowing whether the authoritative value is in a relational row, a JSON payload, a recomputed bootstrap response, or browser storage.
- **Operational consequence:** replay, repair, and analytics become harder because many payloads are stored as serialized snapshots rather than first-class relational facts.
- **Product consequence:** when the UI looks inconsistent after reload or role switch, the root cause may be data duplication rather than a rendering bug.

## Recommendations
- Define an authoritative-state policy per domain:
  - identity and role data: relational only
  - workflow state: relational with append-only history
  - client preferences: relational plus cache
  - proof snapshots: explicit immutable snapshot records
  - ephemeral UI state: browser only, clearly bounded
- Complete the cutover from the old coarse `/sync` routes to the additive narrow runtime contracts, then narrow `academic_runtime_state` into named typed tables or at least typed per-slice registries.
- Reduce the number of places where the same runtime slice is stored both server-side and browser-side.

## Confirmed facts vs inference
### Confirmed facts
- The schema includes all table families listed above.
- The proof system stores both source records and shaped artifacts such as risk evidence snapshots and student agent cards.
- The queue and simulation tables are distinct from the live teaching runtime tables.

### Reasonable inference
- The schema has been optimized for rapid feature enablement and proof replay rather than for strict relational minimalism.

## Cross-links
- [02 System Architecture Overview](./02-system-architecture-overview.md)
- [08 State Management And Client Logic Audit](./08-state-management-and-client-logic-audit.md)
- [10 Performance Scalability And Reliability Audit](./10-performance-scalability-and-reliability-audit.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [18 Proof Sandbox And Curriculum Linkage Audit](./18-proof-sandbox-and-curriculum-linkage-audit.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)

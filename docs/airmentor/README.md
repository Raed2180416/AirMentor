# AirMentor Foundation Spec Pack

This documentation pack defines the product and backend foundation for AirMentor as a CSE-umbrella academic mentoring platform at MSRUAS.

Programs in scope for this pack:

- Computer Science and Engineering
- Information Science and Engineering
- Artificial Intelligence and Machine Learning
- Mathematics and Computing

This pack treats the current React app as a mock UI prototype, not as the final source of truth for domain rules. The mock already covers the main UX surfaces, but many behaviors are still encoded as local component state, seeded data, and placeholder calculations. These documents lock the rules that the future backend and refined UI should follow.

## What This Pack Covers

- Product scope, actors, goals, and glossary
- Audit of the current mock UI and where it is incomplete
- Role model and permissions for Course Leader, Mentor, and HoD
- Queue engine rules, ownership, escalation, and intervention flows
- Grading rules, evaluation schemes, transcripts, SGPA, CGPA, and student history
- Deterministic backend domain model and contract-ready API shapes
- State machines for role switching, data entry, scheme locking, queue lifecycle, remedial plans, and student-history navigation
- Gap analysis between the current mock and the target foundation
- Test and review plan for future implementation

## Locked Decisions

- One faculty identity can hold one, two, or all three roles: `Course Leader`, `Mentor`, and `HoD`.
- The UI uses explicit active-role switching. Pages and permissions follow the active role.
- Mentor ownership is per student, not per section or per cohort.
- Queue items use a single active owner model. Escalation or defer reassigns the active item and retains history.
- Automatic queue creation is limited in v1 to:
  - academic risk `>= 70%`
  - hard attendance breach `< 65%`
  - unlock requests
  - overdue remedial follow-ups
- Attendance thresholds are:
  - warning and watchlist below `75%`
  - hard breach below `65%`
- Academic scheme rules are per course offering:
  - TT1 raw `25`
  - TT2 raw `25`
  - TT1 + TT2 normalized to `30` inside CE
  - quizzes and assignments share the remaining `30` inside CE
  - SEE always contributes `40`, with raw max allowed to be `50` or `100`
- Scheme changes are allowed only before first marks entry. After that, scheme edits require an HoD reset or unlock path.
- Grade bands are applied on the exact final subject score out of `100`, with no pre-rounding before band assignment.
- AirMentor owns full transcript history for student-history views and later risk-model inputs.
- Student-history viewing is a first-class planned flow and must be designed before backend buildout.

## Document Map

- [01-product-overview.md](./01-product-overview.md)
- [02-current-mock-ux-audit.md](./02-current-mock-ux-audit.md)
- [03-roles-permissions-and-workspaces.md](./03-roles-permissions-and-workspaces.md)
- [04-action-queue-and-interventions.md](./04-action-queue-and-interventions.md)
- [05-grading-transcripts-and-history.md](./05-grading-transcripts-and-history.md)
- [06-domain-model-and-api-contracts.md](./06-domain-model-and-api-contracts.md)
- [07-state-machines.md](./07-state-machines.md)
- [08-gap-analysis-and-roadmap.md](./08-gap-analysis-and-roadmap.md)
- [09-test-and-review-plan.md](./09-test-and-review-plan.md)
- [10-playwright-ui-audit.md](./10-playwright-ui-audit.md)

## How To Use This Pack

- Use `01` through `05` as the product and rules baseline.
- Use `06` and `07` when defining backend data model, API contracts, persistence rules, and UI integration points.
- Use `08` to understand which gaps are already resolved in the mock and which are intentionally deferred to backend phases.
- Use `09` as the acceptance checklist for the first backend-ready milestone.
- Use `10` when reviewing the rendered state of the current mock and when validating screenshot-based UX signoff.

## Non-Goals For This Pack

- No live ERP, LMS, or university SSO integration is assumed in v1.
- No email, SMS, or WhatsApp delivery is specified in v1. Alerts are in-app first.
- No final risk-model formula is locked here beyond the data foundation and the queue trigger threshold. Risk-engine implementation is a later phase.

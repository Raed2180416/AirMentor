# Action Queue And Interventions

## Queue Purpose

The action queue is the execution layer for interventions and operational exceptions. It exists to ensure that high-priority cases are assigned to a single accountable owner and do not disappear into dashboards alone.

## Core Queue Rule

Each queue item has exactly one active owner at a time.

Consequences:

- the item appears in only one active queue at a time
- defer, reassign, or escalate changes active ownership
- prior ownership remains available in history and audit logs
- resolution removes the item from active queue views and moves it into history

## Queue Item Categories

- `Academic Risk`
- `Attendance Breach`
- `Operational Unlock Request`
- `Remedial Follow-Up`
- `Manual Follow-Up`
- `Supervisory Escalation`

## Queue Sources

### Automatic Sources

Automatic queue creation in v1 is limited to the following deterministic triggers:

1. academic risk snapshot reaches or exceeds `70%`
2. attendance falls below `65%`
3. an unlock request is raised
4. a remedial plan has a missed due date or missed check-in

No other automatic queue creation rules are assumed in v1.

### Manual Sources

- Course Leader manual follow-up
- Mentor manual follow-up
- remedial-plan assignment
- student escalation from detail drawer

## Queue Ownership Matrix

| Trigger | Initial Owner | Reassignment Paths |
| --- | --- | --- |
| Academic risk `>= 70%` inside an offering | Course Leader | Mentor or HoD |
| Hard attendance breach `< 65%` inside an offering | Course Leader | Mentor or HoD |
| Unlock request | HoD | HoD only until completed |
| Overdue remedial follow-up | current remedial owner | HoD if ignored or escalated |
| Mentor manual student follow-up | Mentor | HoD |
| Course Leader supervisory escalation | HoD | HoD only until reassigned manually |

## Queue Statuses

- `New`
- `In Progress`
- `Follow-up`
- `Resolved`

Status semantics:

- `New`: no action has started
- `In Progress`: owner has started work
- `Follow-up`: main action happened and later verification is still required
- `Resolved`: workflow is complete and active ownership ends

## Reassignment Rules

### Defer To Mentor

Allowed when:

- the student has a mentor mapping
- the active owner is not already that mentor
- the case requires student follow-up rather than supervisory exception handling

Effects:

- active owner becomes the mentor
- old owner exits active ownership
- queue item history records reassignment reason, timestamp, and prior owner

### Defer Or Escalate To HoD

Used when:

- an unlock is required
- supervisory intervention is required
- the current owner lacks authority
- the case is blocked by a locked scheme or policy exception

Effects:

- active owner becomes HoD
- the queue item remains the same logical item
- the escalation note becomes mandatory

## Resolution Rules

- resolved items must remain historically visible
- resolved items must not auto-delete on a timer in the production system
- undo is allowed only while the item remains in the same business day or until another state change occurs
- if resolution is undone, the item returns to the most recent active owner and previous non-resolved status

Assumption for v1:

- history retention is indefinite unless institutional retention rules later require archival

## Intervention Model

An intervention is a timestamped record attached to a student and optionally to a queue item, offering, and role.

Intervention types in v1:

- call
- email
- in-person meeting
- mentoring session
- parent contact
- remedial assignment
- attendance warning
- supervisory escalation

Each intervention record stores:

- actor faculty ID
- actor role
- student ID
- optional offering ID
- optional queue item ID
- type
- note
- timestamp

## Remedial Plans

Remedial plans are structured intervention artifacts with:

- owner role
- due date
- check-in dates
- ordered checklist steps
- progress state

### Remedial Plan Lifecycle

1. created
2. assigned to current owner
3. step check-ins recorded over time
4. if all steps complete, queue item transitions to `Follow-up`
5. if due date or check-in is missed, queue item may auto-enter or remain in the active queue as overdue remedial follow-up

## Queue Data Invariants

- every queue item has one active owner
- every queue item has one canonical source
- student-linked queue items must reference a student
- offering-linked queue items must reference an offering when the source is academic or attendance based
- unlock requests must reference a locked entry target
- all reassignments must preserve immutable history rows

## Queue Item Fields

Required fields:

- queue item ID
- category
- source trigger
- current status
- current owner role
- current owner faculty ID if user-specific ownership applies
- student ID when applicable
- offering ID when applicable
- priority score
- created at
- updated at

Recommended fields:

- due date
- SLA level
- escalation reason
- latest note
- last intervention summary

## Queue UI Requirements

- active queue shows only current-owner items
- history or audit view shows prior owners and state transitions
- quick compose is allowed for manual items
- reassignment must require an explicit user action and reason
- resolved items must move out of active view immediately

## Operational Exceptions

Unlock requests are queue items, not side-channel actions.

Each unlock request must store:

- requested by faculty ID
- requested by active role
- target offering ID
- target entry kind
- reason
- created at
- current reviewer
- final outcome: approved, rejected, or reset-completed

## Future Extensions

Not included in v1 but compatible with this model:

- email or SMS notification delivery
- SLA escalation timers
- queue analytics and team workload balancing
- multi-step approval workflows beyond HoD

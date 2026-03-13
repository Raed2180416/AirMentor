# Roles, Permissions, And Workspaces

## Role Operating Model

AirMentor uses one faculty identity with explicit active-role switching.

Rules:

- a faculty account may hold one, two, or all three supported roles
- only one role is active at a time in the UI
- page navigation, write permissions, queue scope, and visible controls follow the active role
- all writes must record both:
  - `actorFacultyId`
  - `actorRole`

## Supported Roles

- `Course Leader`
- `Mentor`
- `HoD`

## Faculty Account Model

Each faculty account owns:

- faculty identity fields
- department and program affiliation
- role memberships
- course-offering mappings for Course Leader duties
- student mappings for Mentor duties
- department scope for HoD duties

Authentication assumption for v1:

- admin-managed AirMentor accounts
- SSO deferred

## Active Role Switch Rules

- the user lands in the first available role after login
- switching role does not log the user out
- switching role resets navigation to that role's home page
- unsaved entry work must be explicitly protected by draft save before role switch
- audit logs always store which role performed the action

## Workspace Boundaries

### Course Leader Workspace

Primary surfaces:

- dashboard
- course detail
- data entry hub
- entry workspace
- calendar
- queue filtered to owned offerings

Primary responsibilities:

- configure offering evaluation scheme before entry starts
- enter and lock marks
- review course-level risk and attendance
- create or work queue items for owned offerings
- assign remedial plans
- escalate to HoD when needed

### Mentor Workspace

Primary surfaces:

- mentee list
- mentee detail
- student history summary
- intervention log
- calendar
- queue filtered to owned students

Primary responsibilities:

- monitor cross-course vulnerability
- review attendance and academic summaries
- follow up on queue items assigned to mentor
- update interventions and remedial progress

### HoD Workspace

Primary surfaces:

- department dashboard
- faculty drill-down
- offering drill-down
- unlock and exception handling
- calendar
- queue filtered to department-wide HoD ownership

Primary responsibilities:

- review departmental load and critical cases
- resolve escalations
- approve unlocks or reset locked processes
- supervise faculty data completeness and operating health

## Permission Matrix

| Capability | Course Leader | Mentor | HoD |
| --- | --- | --- | --- |
| View owned offerings | Yes | No | Yes |
| View owned students | Limited | Yes | Yes |
| Configure evaluation scheme | Yes, owned offerings only | No | Yes |
| Enter question-wise marks | Yes, owned offerings only | No | Yes |
| Save draft entry | Yes | No | Yes |
| Submit and lock entry | Yes | No | Yes |
| Request unlock | Yes | No | Yes |
| Approve unlock or reset | No | No | Yes |
| View student risk snapshot | Yes | Yes | Yes |
| View attendance summary | Yes | Yes | Yes |
| View CE and SEE summary | Yes | Yes, summary only | Yes |
| View question-wise raw marks | Yes | No | Yes |
| Create manual follow-up task | Yes | Yes | Yes |
| Reassign queue item | Yes, within allowed policy | Yes, within allowed policy | Yes |
| Escalate to HoD | Yes | Yes | No |
| Assign remedial plan | Yes | Yes | Yes |
| Update remedial progress | Yes | Yes | Yes |
| View student history | Yes | Yes, summary mode | Yes |
| View transcript subject-level final outcomes | Yes | Yes | Yes |
| View transcript raw component detail | Yes | No | Yes |

## Student History Visibility Rules

### Course Leader

Can view:

- prior semester SGPA and CGPA
- subject-level historical outcomes
- transcript attempt records
- prior backlog indicators
- trends relevant to current course risk

### Mentor

Can view:

- semester-wise SGPA and CGPA
- subject-level final outcome summaries
- history of backlogs, repeats, and recovered performance
- intervention history linked to those terms

Cannot view:

- question-wise historical raw marks
- marks-entry level component breakdowns beyond summarized CE and SEE

### HoD

Can view:

- all transcript summary and final-outcome surfaces
- supervisory audit details on academic history

## Ownership Rules

### Course Leader Ownership

- tied to course offerings
- may span multiple sections of the same course
- queue scope includes only items whose active ownership belongs to the Course Leader and whose offering is mapped to them

### Mentor Ownership

- tied to students
- one primary mentor per student in v1
- queue scope includes only items actively assigned to mentor and mapped to that student

### HoD Ownership

- department-wide
- acts as exception owner, supervisor, and escalated-case owner

## Audit Requirements

Every privileged action must persist:

- actor faculty ID
- actor active role
- timestamp
- target entity type and ID
- prior state
- new state
- optional note or reason

Mandatory audited actions:

- role switch
- evaluation-scheme creation or update
- first marks-entry start
- draft save
- submit and lock
- unlock request
- unlock approval or reset
- queue reassignment
- remedial-plan creation
- remedial-step completion
- transcript import

## Role-Switch UX Requirements

- switching roles must preserve identity context but change navigation context
- queue badge count must re-scope immediately to the active role
- any read-only or write-only control must be recalculated on switch
- student-history page must reopen in the correct role mode if reached after a role switch

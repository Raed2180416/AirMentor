# State Machines

## Purpose

These state machines define behavior that the backend and UI must agree on. They replace the current mock's local, implicit flow handling with explicit lifecycle rules.

## Active Role Switching

```text
Logged In
  -> Active Role = first available role

Active Role
  -> switch role
  -> validate role membership
  -> reset workspace context
  -> land on role home page
  -> recompute visible queue scope and permissions
```

Guards:

- target role must be an active membership
- unsaved work must be draft-saved or explicitly abandoned before switch

## Evaluation Scheme Lifecycle

```text
Draft Scheme
  -> save scheme
Configured Scheme
  -> first marks entry starts
Entry Started And Scheme Locked
  -> HoD reset or unlock
Scheme Reopened
  -> update scheme
Configured Scheme
```

Rules:

- TT1 and TT2 definitions are fixed
- quiz and assignment components are editable only before first entry
- SEE raw max is editable only before first entry

## Data Entry Lifecycle

```text
Not Started
  -> save draft
Draft
  -> update draft
Draft
  -> submit and lock
Locked
  -> unlock requested
Unlock Pending Review
  -> HoD approves reset
Unlocked
  -> submit and lock
Locked
```

Entry kinds covered:

- TT1
- TT2
- quiz
- assignment
- attendance
- SEE

## Unlock Workflow

```text
Locked
  -> Course Leader raises unlock request
Unlock Requested
  -> HoD reviews
Approved For Reset
  -> lock removed, entry reopened
Unlocked

Unlock Requested
  -> HoD rejects
Locked
```

Required side effects:

- create queue item owned by HoD
- keep lock intact until approval
- preserve all prior audit events

## Queue Item Lifecycle

```text
New
  -> owner starts work
In Progress
  -> interim action completed
Follow-up
  -> verification successful
Resolved
```

Alternative transitions:

```text
New
  -> reassign or escalate
New with new owner

In Progress
  -> reassign or escalate
In Progress with new owner

Resolved
  -> undo resolution
Follow-up or In Progress
```

Rules:

- one active owner at a time
- each owner change creates a transition row
- resolved items are not auto-deleted

## Remedial Plan Lifecycle

```text
Draft Plan
  -> assign
Active Plan
  -> step completed
Active Plan
  -> all steps completed
Completed Plan
  -> linked queue item moves to Follow-up

Active Plan
  -> missed due date or missed check-in
Overdue Plan
  -> remains active in queue or escalates to HoD
```

## Student History Navigation

```text
Student Drawer Or Student Summary
  -> open history
Student History Overview
  -> select semester
Semester Detail
  -> select subject
Subject Outcome Detail
```

Role-based guards:

- Mentor can enter overview and semester detail
- Mentor subject detail must stop at final-outcome summary
- Course Leader and HoD may view richer academic detail

## Transcript Ingestion Lifecycle

```text
Import Submitted
  -> parse file
Parsed
  -> validate rows
Validated
  -> apply successful rows
Applied
  -> generate report
Completed

Validated
  -> one or more row failures
Partially Applied
  -> generate report
Completed With Errors
```

Required outputs:

- import job status
- per-row error report
- counts for success and failure

## Risk Snapshot Lifecycle

```text
Input Data Updated
  -> queue risk recomputation job
Risk Pending Recompute
  -> compute snapshot
Risk Snapshot Available
  -> if score >= 70 or hard attendance breach
Queue Item Created Or Updated
```

Important note:

- this pack defines the data and trigger threshold only
- the final risk algorithm is a later phase

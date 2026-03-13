# Test And Review Plan

## Purpose

This checklist defines how the first backend-ready AirMentor foundation should be reviewed before implementation is considered stable.

## Role And Navigation Tests

- verify a faculty member with only `Course Leader` role cannot access Mentor or HoD views
- verify a faculty member with only `Mentor` role lands in mentee workspace and cannot access marks entry
- verify a faculty member with only `HoD` role lands in department workspace
- verify a faculty member with two roles can switch roles and see queue, navigation, and permissions re-scope immediately
- verify a faculty member with all three roles can switch cleanly without carrying stale page state into the new role
- verify audit logs record both faculty identity and active role for all writes

## Queue Tests

- verify academic risk `>= 70%` creates exactly one active queue item owned by the Course Leader
- verify academic risk below `70%` does not auto-create a queue item by itself
- verify attendance `< 65%` creates a hard-breach queue item
- verify attendance `< 75%` but `>= 65%` creates a watchlist signal but not a hard queue item
- verify unlock request creates an HoD-owned operational queue item
- verify remedial overdue condition creates or updates an overdue remedial queue item
- verify defer to Mentor reassigns active ownership and removes the item from the prior owner's active queue
- verify defer or escalate to HoD reassigns ownership and stores transition history
- verify resolve moves the item out of active queue and into history
- verify undo resolution restores the most recent active state without losing history

## Grading Engine Tests

- verify TT1 raw `25` normalizes to `15`
- verify TT2 raw `25` normalizes to `15`
- verify quiz and assignment normalized weights always sum to `30`
- verify scheme rejects invalid quiz and assignment weight totals
- verify SEE raw max accepts only `50` or `100`
- verify final subject score equals `CE 60 + SEE 40`
- verify grade band mapping at the exact thresholds:
  - `40`
  - `44`
  - `44.01`
  - `50`
  - `55`
  - `60`
  - `74`
  - `90`
  - `90.01`

## Scheme Lifecycle Tests

- verify scheme can be edited before first entry starts
- verify first successful marks entry stamps scheme start and locks scheme edits
- verify Course Leader cannot edit locked scheme after first entry begins
- verify HoD can reopen only through explicit reset or unlock path
- verify locked entry kind remains locked until approval is completed

## Transcript And History Tests

- verify student with current semester only still shows a valid history page shell
- verify student with multiple semesters shows term cards in order
- verify SGPA is computed correctly per term
- verify CGPA is computed correctly across included transcript records
- verify failed subject records carry `0` GPA and backlog markers
- verify repeated subject attempts preserve both attempts
- verify SGPA and CGPA calculations follow transcript inclusion flags for repeated subjects
- verify absent and withheld statuses are handled correctly
- verify Mentor sees summary history but not raw marks-entry detail
- verify Course Leader and HoD see richer academic history views

## Import Tests

- verify transcript import rejects rows with unknown student IDs
- verify transcript import rejects invalid credits or inconsistent GPA mappings
- verify transcript import produces partial-success reporting when some rows fail
- verify transcript import creates auditable import-job records

## UX Acceptance Tests

- verify student drawer can navigate into student history page
- verify student history page returns to the correct parent flow
- verify queue actions can be taken from both student-centric and course-centric contexts
- verify Mentor detail is not a dead-end and exposes interventions plus history summary
- verify HoD can review unlock requests without leaving the supervisory workflow

## Review Outputs

Before backend implementation is declared ready, reviewers should be able to answer yes to the following:

- are all entities named and scoped clearly
- are all grade and GPA rules deterministic
- are all ownership transitions deterministic
- is transcript history modeled strongly enough for later risk work
- is the student history page accepted as foundational, not optional
- can the current mock be refactored toward these contracts without rethinking the product from scratch

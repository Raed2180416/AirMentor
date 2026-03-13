# Product Overview

## Product Definition

AirMentor is a faculty-facing academic intelligence and intervention platform for the MSRUAS CSE umbrella. Its primary purpose is to help faculty identify at-risk students early, act on those cases consistently, and preserve enough academic history and workflow evidence to support both intervention and later predictive risk modeling.

AirMentor is not a general student portal. Its primary operators are faculty and departmental leadership.

## Primary Actors

### Course Leader

Owns a course offering and is responsible for:

- configuring the evaluation scheme for that offering
- entering and locking academic data
- reviewing course-level risk and attendance signals
- creating and working queue items for their offerings
- assigning remedial actions or escalating cases

### Mentor

Owns a student-centric view across the students assigned to them and is responsible for:

- tracking cross-course vulnerability
- reviewing attendance and academic summaries
- monitoring interventions and remedial progress
- following up with students on assigned cases

Mentors do not own question-wise entry or grading controls.

### HoD

Owns departmental oversight and is responsible for:

- monitoring all offerings and faculty
- resolving unlock requests and supervisory escalations
- auditing risk burden and data completeness
- resetting or reopening locked processes when justified

## Identity And Role Model

- One faculty account exists per teacher.
- A faculty account can hold one or more role memberships.
- The user selects an active role in the UI.
- Navigation, visibility, and write access depend on the active role.
- Audit history always records both the faculty identity and the acting role.

## Product Goals

### Operational Goals

- give Course Leaders a stable path for academic data entry and review
- give Mentors a student-centered intervention workspace
- give HoD a true supervisory and exception-handling layer
- ensure high-priority academic cases are surfaced without relying on memory or ad hoc spreadsheets

### Academic Goals

- reflect the MSRUAS CE and SEE structure correctly
- support configurable quizzes and assignments per offering
- produce deterministic grade and GPA outcomes from normalized component data
- preserve transcript history for longitudinal student review

### Foundation Goals

- replace ad hoc local UI rules with backend-owned domain contracts
- make all later backend work depend on documented entities, workflows, and invariants
- lay a clean foundation for later risk modeling using both current and historical performance

## In-Scope Programs

- Computer Science and Engineering
- Information Science and Engineering
- Artificial Intelligence and Machine Learning
- Mathematics and Computing

This pack is department-family specific, not yet university-wide.

## V1 Operating Assumptions

- faculty authentication is admin-managed inside AirMentor
- student roster, transcript history, attendance, and marks support manual entry and bulk import
- live upstream integrations come later
- alerts are in-app only in v1
- transcript history is read-heavy in v1 and becomes a future input to the risk engine

## Core Product Areas

### Academic Operations

- offering creation and mapping
- evaluation scheme configuration
- marks entry and locking
- attendance monitoring
- gradebook and transcript generation

### Student Risk And Intervention

- current risk snapshot
- attendance watchlist and hard breach tracking
- action queue ownership and escalation
- remedial plan authoring and progress tracking
- intervention log
- student academic history

### Department Governance

- faculty visibility
- unresolved operational exceptions
- unlock requests
- offering completeness
- supervisory review of critical academic cases

## Glossary

### Course

Academic subject definition such as `CS401`.

### Course Offering

A specific course instance in a year, semester, and section, such as `CS401` section `A` in a given term.

### CE

Continuous Evaluation. Contributes `60` to the final subject score.

### SEE

Semester End Evaluation. Contributes `40` to the final subject score.

### Transcript Subject Record

A historical record of one student's performance in one subject for one term and one attempt.

### Queue Item

A workflow item assigned to exactly one active role owner and tied to a student, offering, or operational exception.

### Remedial Plan

A structured intervention with due date, check-ins, and steps tracked over time.

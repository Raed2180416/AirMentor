# Sysadmin Workspace Redesign Spec

## Purpose

The sysadmin workspace must become the operational control plane for AirMentor, not a decorative dashboard.

The sysadmin should be able to:

- define and maintain the academic hierarchy
- configure curriculum per batch and semester
- control grading and evaluation policy defaults and overrides
- inspect and edit student records coherently
- inspect and edit faculty-member permissions, teaching ownership, and calendar coverage
- implement HoD-requested permanent timetable and mentor changes
- search for any entity and jump straight into the correct editable context
- understand how one change affects linked entities before saving

The current system admin screen fails mainly because:

- data creation, inspection, and editing are mixed together without a clear flow
- cards and hover effects imply interactivity without improving readability
- there is no strong list-detail-edit pattern
- hierarchy is not readable as a real academic structure
- editing is not explicit enough, so users cannot tell what is view-only and what is editable
- there is not enough linkage between structure, people, policy, and requests

## Product Principles

- The workspace must be search-first, structure-aware, and edit-capable.
- Every entity must have a readable view mode and a deliberate edit mode.
- The sysadmin should never wonder where to go next to complete a task.
- Counts, summary chips, and health indicators must always link to the underlying records.
- Policy inheritance must always show both the effective value and the override source.
- Requests must always link to the exact affected entity and change type.
- Animation should support orientation only. It should never make tables, rows, or forms feel unstable.

## Core Information Model

The canonical academic hierarchy is:

1. Institution
2. Academic Faculty
3. Department
4. Branch or Program
5. Batch
6. Term
7. Curriculum Course

The people and operations model linked into that hierarchy is:

- Students belong to a batch and have an active academic context.
- Faculty Members have a primary department, optional role grants, and teaching assignments that may span departments, branches, batches, and years.
- Offerings and ownerships are the exact class-assignment layer.
- Requests are the controlled path for permanent timetable and mentor changes.
- Policy overrides can exist at institution, academic faculty, department, branch, and batch.

## Global Workspace Structure

Do not use a heavy permanent navigation panel.

The workspace should use:

- a sticky top bar
- breadcrumbs
- a global search bar
- context tabs inside the current entity
- a list-detail or tree-detail layout depending on the entity type

The top bar should always include:

- current location breadcrumb
- global search
- current environment indicator such as live or mock
- refresh
- theme
- portal exit
- logout

## Global Search

Global search must be available on every sysadmin screen.

It must search:

- academic faculties
- departments
- branches
- batches
- course codes
- course titles
- students
- faculty members
- requests

Search results must show:

- entity type
- primary label
- minimal location context
- direct navigation into the correct detail view

Examples:

- searching `1MS24CS022` opens student detail
- searching `CSE` opens the matching department or branch results with context
- searching `QA2299` opens the relevant curriculum course within the correct batch
- searching a faculty member opens their permissions and assignment workspace

## Primary Entry Areas

The top-level tabs should be:

1. Overview
2. Structure
3. Students
4. Faculty Members
5. Requests

`Overview` is not where the work happens. It is only a launch surface.

`Structure` is where the hierarchy, curriculum, and policy are managed.

`Students` is where student records are inspected and edited.

`Faculty Members` is where staff records, permissions, and teaching links are managed.

`Requests` is where HoD-driven changes are reviewed and implemented.

## Overview Requirements

The overview page should only answer:

- what needs attention now
- what was recently changed
- what is incomplete
- where the admin should go next

Overview must show:

- academic faculties count
- departments count
- branches count
- active batches count
- students count
- faculty members count
- open requests count
- unresolved configuration warnings
- recently changed entities
- quick actions

Quick actions should include:

- add academic faculty
- jump to a batch
- search student
- search faculty member
- review open requests

Warnings should include:

- batch missing curriculum courses
- batch missing policy override where expected
- faculty member with no teaching assignment
- student with missing mentor
- request stuck in review or approved state too long

Every count and warning must be clickable.

## Structure Workspace

This is the heart of the sysadmin panel.

The structure workspace should use a three-part pattern:

- left: structure explorer
- center: entity summary and linked tables
- right or modal drawer: edit form

The structure explorer should support expanding:

- academic faculty
- department
- branch
- batch

The explorer must always show the current selection clearly.

The center pane must always show:

- what this entity is
- where it sits in the hierarchy
- what child entities exist
- which policy is effective here
- what related people and requests exist

The right drawer or modal form must be the explicit edit surface.

### Academic Faculty

The sysadmin must be able to:

- create an academic faculty
- edit code, name, overview, and status
- archive or reactivate it
- view all departments under it
- view all branches and batches under it
- view faculty members primarily assigned under it
- view students under it
- view requests touching this scope
- set or inspect policy overrides at this scope

The academic faculty detail should include:

- summary header
- departments table
- faculty members summary
- students summary
- effective policy summary
- recent requests
- audit history

### Department

The sysadmin must be able to:

- create a department within an academic faculty
- edit department code, name, status, and academic faculty association
- archive or reactivate it
- view branches under it
- view faculty members with primary appointment here
- view cross-department teaching into or out of this department
- inspect policy overrides at this scope
- inspect affected students

The department detail should include:

- branch table
- faculty-member table
- incoming and outgoing teaching coverage
- effective policy summary
- request history
- audit history

### Branch or Program

The sysadmin must be able to:

- create a branch under a department
- edit branch code, branch name, program level, semester count, and status
- archive or reactivate it
- view all batches under the branch
- inspect curriculum divergence across batches
- inspect policy overrides at this scope
- inspect faculty teaching across batches in this branch

The branch detail should include:

- batches table
- curriculum comparison summary across batches
- policy summary
- faculty teaching map
- student counts by batch

### Batch

Batch is the main versioning unit for curriculum and policy.

The sysadmin must be able to:

- create a batch under a branch
- edit admission year, label, current semester, section labels, and status
- archive or reactivate it
- define terms for the batch
- define semester-wise curriculum from semester 1 to semester 8
- edit course codes, titles, credits, and semester placement
- clone curriculum from another batch
- compare this batch with another batch in the same branch
- inspect and edit policy overrides at the batch scope
- inspect students in this batch
- inspect faculty members teaching this batch

The batch detail should be split into tabs:

1. Summary
2. Curriculum
3. Policy
4. Terms
5. Students
6. Teaching Coverage
7. Audit

### Batch Summary

Must show:

- batch identity and current year derived from current semester
- active sections
- linked branch and department
- current student count
- assigned mentors count
- teaching faculty count
- effective policy source chain
- unresolved warnings

### Batch Curriculum

This must be a real data grid, not a block of small cards.

The curriculum view must support:

- grouping by semester
- sorting by course code
- inline edit for code, title, credits, and status
- add row
- remove row
- bulk import or paste
- clone from previous batch
- compare against another batch
- validation that credits are numeric and course codes are unique within the relevant curriculum rules

The user should be able to tell immediately:

- which semester each course belongs to
- how many credits each course has
- what changed relative to another batch

### Batch Policy

This must show both read and edit states.

The read state must show:

- effective grade bands
- effective CE and SEE split
- effective CE component limits
- effective working days and hours
- effective SGPA and CGPA rules
- which scope each value comes from

The edit state must allow the sysadmin to:

- override grade bands
- override grade points if supported
- override CE and SEE totals
- override CE component caps
- override working days
- override workday start and end times
- override SGPA and CGPA rule settings

This view must also show:

- whether values are inherited or overridden
- a reset-to-parent action for each editable group
- validation that totals make sense
- a preview of the resolved policy before save

### Batch Terms

The sysadmin must be able to:

- add a term
- edit academic year label
- edit semester number
- edit start and end dates
- close or archive a term if needed

The terms table should make it obvious:

- which semester each term belongs to
- whether dates overlap improperly
- whether the batch semester progression is coherent

### Students Workspace

Students must be shown in a real table with filters, not only summary cards.

The students list must support:

- search by university ID, name, email, branch, batch, or mentor
- filters for academic faculty, department, branch, batch, active semester, and status
- sorting by CGPA, name, university ID, or mentor
- quick jump into student detail

The student row must show:

- university ID
- name
- academic faculty
- department
- branch
- batch
- active semester
- current CGPA
- mentor
- status

The student detail view must show:

- identity and contact
- current academic context
- mentor assigned
- current CGPA and SGPA context
- complete academic history
- branch and batch links
- current policy context
- recent interventions or request history if relevant

The sysadmin must be able to:

- edit student contact fields if permitted
- correct academic context if a student is mapped to the wrong batch or semester
- view mentor assignment
- implement mentor reassignment when that change comes through the approved workflow

The student detail page must link out to:

- current batch
- current branch
- mentor faculty member
- academic history records

### Faculty Members Workspace

The faculty-members list must support:

- search by name, employee code, username, email, or department
- filters by primary department, role grant, and status
- sorting by name, department, mentor load, or teaching load

The faculty member row must show:

- name
- employee code
- primary department
- role grants
- current teaching coverage count
- mentor load
- status

The faculty member detail must show:

- identity and contact
- primary department
- appointments across departments
- role grants such as HoD, Mentor, Course Leader
- assigned classes grouped by department, branch, batch, and section
- current mentor load
- timetable coverage summary
- requests affecting this faculty member
- audit history

The sysadmin must be able to:

- create a faculty member
- edit contact and identity fields
- set primary department
- manage department appointments
- grant or remove role permissions
- assign teaching ownership to exact classes
- see cross-department teaching clearly
- see which batches and years they teach
- inspect timetable impact before confirming assignments

Important rule:

- role grants and teaching assignments are separate things and must be shown separately

### Teaching Assignment Model

The sysadmin must not assign faculty at a vague department-only level.

Assignments must be exact and visible at class level.

A teaching assignment should specify:

- faculty member
- offering or class
- department
- branch
- batch
- section if applicable
- ownership type such as primary or additional
- status

The faculty-member page and the class or offering page must both show the same assignment relationship.

## Request Workflow

Requests are not a side feature. They are the controlled implementation path.

The requests list must support:

- filtering by status
- filtering by request type
- filtering by target faculty member
- filtering by target batch or department
- sorting by age, status, or priority

The request row must show:

- title
- request type
- requester
- owner
- target entity
- current status
- created date

The request detail must show:

- full description
- status history
- notes
- linked target entities
- requested change
- approval and implementation actions
- audit trail

The sysadmin must be able to:

- claim a request
- move it into review
- approve it
- mark it implemented
- close it
- add notes at any stage

The important request types include:

- permanent timetable change
- mentor reassignment
- assignment ownership change
- policy clarification or correction if needed

Request detail must link to:

- target faculty member
- target department
- target batch
- relevant timetable or mentor relationship

## Timetable and Schedule Rules

The system must respect the operational rule set described for faculty.

Faculty should be allowed to:

- make temporary weekly schedule changes within their own workspace

Sysadmin should be allowed to:

- implement permanent changes only through the request workflow
- inspect the current default timetable
- inspect temporary exceptions
- inspect who requested and approved the permanent change

Sysadmin should not behave like an arbitrary scheduler.

The system must visually communicate:

- temporary exception
- permanent default
- requested change
- approved change
- implemented change

## Policy Inheritance Rules

Policy configuration is one of the most important sysadmin tasks.

The interface must support:

- institution defaults
- academic faculty overrides
- department overrides
- branch overrides
- batch overrides

For every policy value, the sysadmin should be able to see:

- current effective value
- source scope
- whether it is inherited or overridden
- what will happen if the local override is removed

The policy editor must support:

- grade bands
- CE and SEE split
- CE component caps
- working days
- working hours
- SGPA rules
- CGPA rules

The UI should explicitly communicate that:

- course leaders and HoDs may configure detailed internal assessment breakdowns later
- their breakdown must remain within the limits set here

## Editing Rules

Every editable sysadmin surface must follow the same model.

The user flow should always be:

1. locate entity
2. inspect current state
3. enter edit mode
4. make changes in a structured form or editable grid
5. review validation and impact
6. save or cancel

Every edit surface must support:

- save
- cancel
- dirty state warning
- validation errors tied to fields
- clear success feedback
- audit attribution

Do not hide editing behind hover-only affordances.

Do not keep permanent create forms open above every table.

Preferred creation pattern:

- `Add` button opens drawer or modal
- form is focused and structured
- after save, the list refreshes and the new entity is selected

Preferred editing pattern:

- open entity detail
- click `Edit`
- edit in drawer or structured inline section
- save or cancel

## Linking Rules

The workspace must feel like one connected graph.

At minimum, these links must exist:

- academic faculty to its departments
- department to its branches
- branch to its batches
- batch to its terms
- batch to its curriculum
- batch to its students
- batch to its teaching coverage
- student to mentor
- student to batch
- faculty member to primary department
- faculty member to appointments
- faculty member to teaching assignments
- faculty member to requests
- request to every affected entity
- policy override to its scope and effective children

The user should never have to manually re-search an entity that was already visible on screen.

## Audit and Change Visibility

Every important sysadmin-managed entity should expose:

- last updated at
- last updated by
- recent changes
- linked requests if the change came from workflow

For policy and curriculum, the UI should ideally support:

- version label or last-change metadata
- compare previous value versus current value

## Visual and Interaction Guidance For The Specialist

The sysadmin panel should feel like the disciplined operations counterpart to the main teaching UI.

That means:

- use the same visual language family as the main UI
- keep the typography and surfaces premium and intentional
- reduce decorative motion
- increase clarity, alignment, and data density
- prioritize readable tables, drawers, sticky headers, and clear sectioning

Avoid:

- random card hover drift on dense data surfaces
- decorative glows on every data box
- excessive color noise
- hiding actions until hover
- dashboards that replace actual editing tools

Use motion only for:

- page entrance
- drawer open and close
- tab content transitions
- success confirmation
- focused search result reveal

Do not animate:

- table rows on hover
- every card in a data-heavy layout
- form fields unnecessarily

## What Must Exist In Version 1

The redesign is not complete unless the sysadmin can successfully do all of the following:

1. create an academic faculty
2. create a department under it
3. create a branch under that department
4. create a batch under that branch
5. create terms for that batch
6. configure semester-wise curriculum with credits and course codes
7. set policy defaults or overrides and understand inheritance
8. search for a student and inspect full academic context
9. search for a faculty member and inspect permissions plus class ownership
10. process a request for a permanent timetable or mentor change
11. move between all linked records without losing context
12. edit data in a deliberate, validated way

## Final Recommendation

The sysadmin workspace should be rebuilt as a structured data operations tool with coherent entity pages, proper editing surfaces, and linked search-driven navigation.

It should not be treated as a dashboard made of animated cards.

It should be treated as:

- hierarchy manager
- policy manager
- curriculum manager
- people records workspace
- request implementation console
- audit-visible operational control plane

# AirMentor Handoff: Restore Actual UX And Apply Only Targeted Fixes

## Purpose

This document is the implementation handoff for the next agent.

The previous rewrite replaced the existing AirMentor UX instead of preserving it. That was incorrect.

The next implementation must:

- restore the real pre-rewrite AirMentor UX
- keep the existing page structure, visual identity, and interaction style
- implement the requested workflow/data fixes inside that UX
- keep only these two theme families:
  - `material-utility`
  - `frosted-focus`

This is not a greenfield redesign. It is a surgical restoration + targeted product fix pass.

## Hard Constraint

Do not invent a new shell.

Do not replace the existing course detail experience, sidebars, dashboard structure, queue layout, page hierarchy, animation style, or typography system unless a specific requested workflow requires a focused local change.

The user liked the existing UX and did not ask for a product-wide redesign.

## Correct UI Baseline

Use commit `1710c6c` as the visual and interaction baseline.

Why:

- `1710c6c` is the last good checkpoint before the full-shell rewrite commit `f3e6219`
- it preserves the original AirMentor layout and motion system
- it still contains the original pages and mental model the user designed

Relevant commits:

- `1710c6c` - `Fix main content reflow when side panels collapse`
- `390e8b3` - `Stabilize AirMentor mock UX flows`
- `f3e6219` - full rewrite that should not be used as the UX baseline

## Recommended Starting Move

On a fresh branch, restore these files from `1710c6c` first:

- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/data.ts`

Then implement the changes below incrementally, preserving the old shell the whole time.

Recommended restore command:

```bash
git checkout 1710c6c -- src/App.tsx src/App.css src/index.css src/data.ts
```

After that, rebuild the requested behavior on top of the restored UI.

## What Must Be Preserved From The Actual UX

Preserve these UX characteristics from the restored baseline:

- left navigation + right action queue shell
- dashboard as the main operational landing page
- course detail page with tabs
- existing page IDs and navigation model:
  - `dashboard`
  - `course`
  - `calendar`
  - `upload`
  - `entry-workspace`
  - `mentees`
  - `department`
  - `mentee-detail`
  - `student-history`
  - `unlock-review`
  - `scheme-setup`
  - `queue-history`
- existing role switcher placement and model
- existing top bar density/style, but polish it instead of replacing it
- existing card language, gradients, spacing, and motion style
- existing course detail mental model:
  - overview
  - TT tabs
  - quizzes
  - assignments
  - gradebook
- existing mentor flow shape
- existing HoD drill-down pattern
- existing Sora + mono visual language unless a local tweak is necessary

Do not collapse the app into a simplified dashboard + selector architecture.

## Product Decisions That Are Now Locked

These are final and should not be reconsidered:

- multiple faculty may be mapped to the same subject-run and share one evaluation scheme
- the shared scheme is at subject-run level across all sections in the same semester
- TT blueprint publish immediately freezes the scheme
- any marks-entry activity also freezes the scheme if it was approved but not yet frozen
- marks unlock approval applies to one entry kind across all sections of the same subject-run in the same semester only
- HoD cannot directly edit schemes or marks
- HoD acts through review queues only
- recurrence presets required:
  - `daily`
  - `weekly`
  - `monthly`
  - `weekdays`
  - `custom dates`
- scheduled tasks appear in the queue at the start of the date
- selected time is metadata only
- recurring schedules keep their original calendar cadence after completion
- only two theme families should remain:
  - `material-utility`
  - `frosted-focus`

## Source Documents To Follow

Use these docs as the product rules baseline:

- [02-current-mock-ux-audit.md](/home/raed/projects/air-mentor-ui/docs/airmentor/02-current-mock-ux-audit.md)
- [03-roles-permissions-and-workspaces.md](/home/raed/projects/air-mentor-ui/docs/airmentor/03-roles-permissions-and-workspaces.md)
- [07-state-machines.md](/home/raed/projects/air-mentor-ui/docs/airmentor/07-state-machines.md)
- [08-gap-analysis-and-roadmap.md](/home/raed/projects/air-mentor-ui/docs/airmentor/08-gap-analysis-and-roadmap.md)

Use `f3e6219` only as a logic/reference mine for:

- canonical faculty and subject-run modeling ideas
- shared scheme status ideas
- task recurrence ideas
- theme token ideas

Do not copy its app shell, page hierarchy, or high-level UI structure.

## Main Implementation Goal

Restore the old UX, then make the requested changes feel native to that UX.

The right question is:

"How do we fix the broken scheme, blueprint, role, queue, and task flows inside the current AirMentor product?"

Not:

"How do we redesign the whole product around a new navigation model?"

## Scope By Area

### 1. Authentication

Current issue:

- login password entry does not submit on Enter

Required change:

- make login a real `<form>`
- pressing Enter in the password field must trigger the existing mock login
- invalid password behavior must remain intact
- keep the existing visual login style from the restored UX

### 2. Canonical Faculty And Ownership Data

Current issue:

- the old mock split identity across `PROFESSOR`, `TEACHER_ACCOUNTS`, `TEACHERS`, and mentee mappings
- HoD faculty view and actual login role mappings drift apart
- some faculty appear responsible for classes in HoD view but log in as ordinary mentors only

Required change:

- introduce one canonical faculty source of truth in `src/data.ts`
- every faculty record must include:
  - identity fields
  - department
  - role memberships
  - subject-run mappings
  - section mappings
  - mentee mappings
- keep the old UX-facing surfaces, but derive them from canonical data
- if needed, create adapter/selector helpers that transform canonical data into the old UI view models
- HoD faculty cards/detail views must show explicit role chips:
  - `Mentor`
  - `Course Leader`
  - `HoD`

Important implementation note:

Do not force the restored UI to consume the new domain model directly everywhere on day one if that causes another visual rewrite. It is acceptable to keep old-facing component props and feed them from canonical selectors.

### 3. Subject-Run Scheme Ownership

Current issue:

- old mock treated configuration too close to per-offering/per-section behavior
- user wants one shared scheme across all sections of the same subject-run in one semester

Required change:

- introduce `SubjectRun` as the shared scheme scope
- sections remain relevant for marks entry and lock state
- the scheme is shared by all mapped Course Leaders for that subject-run
- a subject-run may have multiple Course Leaders
- scheme editing is collaborative and last-save-wins in the mock
- display `last edited by` and timestamp in the scheme UI

### 4. HoD Permissions And Review Workflow

Current issue:

- HoD could reach editorial surfaces like data entry and scheme setup
- old mock also had self-govern unlock behavior for dual-role faculty

Required change:

- HoD must not directly edit:
  - `upload`
  - `entry-workspace`
  - `scheme-setup`
- HoD remains supervisory only
- HoD actions must happen through queue/review surfaces
- remove self-govern unlock/reset behavior entirely
- even if one faculty account has both Course Leader and HoD roles, the review action must be available only while active as `HoD`

Implementation guidance inside the old UX:

- preserve the old HoD workspace and faculty drill-down style
- repurpose `unlock-review` and queue/history surfaces rather than replacing them with a brand new shell
- if a page is reused for both unlocks and scheme reviews, keep the old page language and visual frame

### 5. Scheme Lifecycle

Replace the old scheme lifecycle with:

```text
Draft
-> Submitted to HoD
-> Changes Requested
-> Approved & Locked
-> Frozen
```

Rules:

- Course Leaders can edit only in `Draft` or `Changes Requested`
- submission creates one HoD review item for the subject-run
- HoD can return with note or approve with note
- once approved, the scheme is locked
- once frozen, the scheme is immutable forever in the mock
- marks unlocks never reopen the scheme

UI requirement:

- keep scheme setup inside the existing scheme/setup experience
- do not move this to a separate new app area
- show clear status messaging in the old page design

### 6. Freeze Rules

These are strict:

- TT blueprint publish freezes the scheme immediately
- any marks-entry activity also freezes the scheme if it is currently `Approved`
- if the course is already underway in mock data, the scheme must not appear open for editing

This addresses the current mismatch where a subject looks active but the UI still implies the evaluation scheme is not locked in.

### 7. Scheme Builder Redesign

This is one of the most important fixes.

Current issues:

- builder is inconsistent
- scheme selector is not refined
- quizzes and assignments are not properly buildable
- mock data and scheme UI disagree

Required redesign, inside the existing scheme/setup surface:

- use one consistent component table for quiz and assignment components
- columns must be:
  - component type
  - label
  - raw max
  - normalized weight
- validation must enforce:
  - at least one component exists
  - total normalized weight equals `30`
  - maximum `2` quizzes
  - maximum `2` assignments
- remove all `quiz3` assumptions from the mock
- use clearer selector language so the user understands they are editing one subject-run scheme shared across sections
- show whether the scheme is:
  - open draft
  - awaiting HoD review
  - returned for changes
  - approved and locked
  - frozen

UX guardrail:

Keep the page shape and visual treatment from the restored scheme setup page. Redesign the form internals, not the entire surrounding page.

### 8. TT Blueprint Builder Redesign

This must be thought through carefully.

Current issues:

- builder feels inconsistent and cooked
- current freeform editing model is not reliable enough
- validation/state is not obvious

Required redesign inside the existing TT/course-detail experience:

- keep blueprint work attached to the course detail / TT workflow, not a brand new standalone shell
- use a structured question builder instead of a loose nested-card editor
- question numbering must be derived from row order, never manually typed
- part lettering must be derived from row order, never manually typed
- every question row should show:
  - question number
  - prompt/intent text
  - CO tags
  - question total
  - actions
- every part row should show:
  - part label
  - part prompt
  - max marks
- totals must auto-sum live
- raw total must equal `25` before publish is enabled
- publish must remain unavailable until the shared scheme is already `Approved`
- publish changes blueprint state to `Published`
- publish freezes the scheme immediately
- published blueprint is read-only in v1

Recommended UX treatment:

- keep the existing TT tab visual language
- add a strong validation/status bar near the builder
- use inline totals and stable row order
- avoid making the builder feel like a separate application

### 9. Data Entry Hub And Section Filtering

Current issues:

- flow is clunky
- scheme status/selector behavior is not refined
- state is inconsistent

Required change:

- preserve the old data-entry hub and entry-workspace model
- refine selection so the user can choose the subject-run immediately
- add section filtering without implying each section owns a different scheme
- all scheme banners and lock banners must reflect the currently selected subject-run and section context correctly
- remove stale derived states that continue showing the wrong scheme state

### 10. Marks Entry And Unlock Workflow

Current issues:

- unlock flow needs subject-run scope
- HoD should review, return, approve, and unlock through queue
- unlock must apply to all sections of the subject-run in the same semester

Required change:

- marks locks remain section-specific in stored state
- unlock request is raised at subject-run + entry-kind + semester scope
- HoD review item must clearly say that approval reopens that entry kind across all sections of that subject-run in that semester
- approval unlocks that entry kind for all mapped sections of that subject-run
- scheme state does not reopen
- HoD can return the request with note for more context

Important:

This should plug into the existing queue/unlock review UX, not replace it.

### 11. Mock Data Corrections

The mock data needs a serious cleanup pass.

Fix these specific mismatches:

- remove `quiz3` from every seed, calendar reference, and student data assumption
- do not seed editable open schemes for offerings that are clearly already underway
- if TT1 paper exists, TT1 marks exist, or evaluation activity has already started, scheme must seed as approved/frozen as appropriate
- faculty responsibility in HoD view must match what those faculty accounts actually see after login
- add more mock entries if needed to cover:
  - one subject-run with multiple Course Leaders
  - one fresh pre-start subject-run
  - one submitted-awaiting-HoD-review subject-run
  - one changes-requested subject-run
  - one approved-but-not-yet-published subject-run
  - one published/frozen subject-run
  - one unlock-pending subject-run

### 12. Mentor Task Composer And Scheduling

Current issues:

- quick add snaps back to `Remedial`
- scheduling is incomplete
- no proper recurring or custom-date support

Required change:

- keep the task composer in the existing UX style
- split creation into:
  - `One-time`
  - `Scheduled`
- scheduled must support:
  - `Daily`
  - `Weekly`
  - `Monthly`
  - `Weekdays`
  - `Custom dates`
- user must be able to set:
  - a single optional time for preset recurrences
  - per-date optional times for custom dates
- queue activation happens at the start of the date
- selected time appears as metadata only
- completing an occurrence affects only that occurrence
- future occurrences keep original cadence
- add controls for:
  - `Pause`
  - `End recurrence`
  - `Edit schedule`
- schedule edits affect only future incomplete occurrences
- fix the task type reset bug so user changes persist

UX guidance:

Do not turn this into a giant settings form. Keep the current composer feel, but make scheduling a first-class second step or mode.

### 13. Theme System

The user only likes these two theme directions:

- `material-utility`
- `frosted-focus`

Do not keep the other theme families.

Required change:

- preserve the old visual identity first
- then add a permanent theme selector in the existing top bar/utility area
- allow:
  - `material-utility` light
  - `material-utility` dark
  - `frosted-focus` light
  - `frosted-focus` dark
- use calmer neutrals and reduce over-saturated accent overload in dark mode
- keep visual distinction, but make dark mode easier on the eyes

Critical UX rule:

Theming is a refinement pass, not an excuse to replace the shell.

## Suggested Technical Strategy

### Step 1. Restore Baseline

Restore the pre-rewrite files from `1710c6c` and get the app building again.

### Step 2. Introduce Canonical Data Behind Adapters

In `src/data.ts`:

- introduce canonical faculty + subject-run types
- derive old UI-facing shapes from that canonical data where helpful
- avoid forcing a broad component rewrite

Possible approach:

- canonical types:
  - `FacultyRecord`
  - `SubjectRun`
  - `SubjectRunScheme`
  - `SchemeReviewEvent`
  - `UnlockRequest`
  - `TaskSeries`
  - `TaskOccurrence`
- adapter selectors:
  - old dashboard/course/mentee compatible selectors
  - old faculty cards compatible selectors
  - old queue-card compatible selectors

### Step 3. Replace Only Broken Workflow Internals

Update the internals of:

- login form
- scheme setup page
- TT builder inside course detail
- upload/data-entry hub selection model
- unlock review logic
- mentor task composer
- theme switcher

Keep the rest intact.

### Step 4. Remove Deprecated Behaviors

Delete or disable:

- self-govern unlock
- direct HoD editing through upload/entry-workspace/scheme-setup
- `quiz3` assumptions
- theme families other than `material-utility` and `frosted-focus`

### Step 5. Validate Against Original UX

Before finalizing, compare the updated app visually against `1710c6c`.

If the shell, page hierarchy, or overall feel changed materially, the implementation has drifted again.

## Acceptance Checklist

### UX Preservation

- original AirMentor layout is visibly intact
- original sidebars and page hierarchy remain
- course detail tabs remain the main course workflow
- mentor and HoD flows still feel like the same product

### Auth

- Enter submits login
- wrong password still errors normally

### Roles And Faculty Data

- login identity, sidebar identity, HoD faculty view, and actual permissions all agree
- faculty cards show correct role tags

### Scheme Governance

- multiple Course Leaders on one subject-run share one scheme
- scheme status is visible and correct
- HoD can request changes and approve through review flow only
- HoD cannot directly edit

### Freeze Behavior

- TT publish freezes scheme immediately
- marks entry also freezes approved scheme
- underway courses do not appear scheme-editable

### Scheme Builder

- can build quizzes and assignments properly
- normalized total must equal `30`
- no third quiz path exists

### Blueprint Builder

- numbering is stable and derived from order
- total must equal `25`
- publish disabled until scheme approved
- publish makes blueprint read-only

### Unlock Workflow

- unlock request is subject-run scoped
- approval unlocks one entry kind across all sections in same semester
- scheme does not reopen

### Task Scheduling

- task type no longer snaps back to `Remedial`
- recurrence presets all exist
- custom dates can each have optional time
- due item appears on the correct date
- future occurrences keep original schedule

### Themes

- only `material-utility` and `frosted-focus` remain
- both support light and dark
- dark mode is calmer and easier to read

## Git And Recovery Notes

- do not touch unrelated deletions unless explicitly asked:
  - `caludeui.jsx`
  - `chatgpt.jsx`
- do not keep `f3e6219` as the UI baseline
- do not ship another shell rewrite

## One-Line Brief For The Next Agent

Restore the AirMentor UI from `1710c6c`, preserve that actual UX, then implement the shared subject-run scheme workflow, HoD review-only permissions, structured TT blueprint builder, corrected mock data, recurring mentor scheduling, Enter-to-login, and only the `material-utility` + `frosted-focus` theme families without redesigning the product shell.

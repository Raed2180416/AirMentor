# Playwright UI Audit

## Purpose

This document captures the rendered audit pass for the current AirMentor mock using the Nix-backed Playwright CLI.

Audit date:

- 2026-03-14

Audit method:

- `nix develop -c playwright screenshot -b firefox --full-page --wait-for-timeout 2000 "<url>" "<file>"`

The audit uses URL-driven mock state so the screenshots are reproducible without backend dependencies.

Stabilization re-check:

- A second rendered pass on 2026-03-14 validated the lock-governance and entry-workspace fixes under `output/playwright/stabilization/`.

## Screenshot Index

- [login.png](../../output/playwright/audit/final/login.png)
- [course-leader-dashboard.png](../../output/playwright/audit/final/course-leader-dashboard.png)
- [course-overview.png](../../output/playwright/audit/final/course-overview.png)
- [course-risk.png](../../output/playwright/audit/final/course-risk.png)
- [course-gradebook.png](../../output/playwright/audit/final/course-gradebook.png)
- [scheme-setup.png](../../output/playwright/audit/final/scheme-setup.png)
- [data-entry-hub.png](../../output/playwright/audit/final/data-entry-hub.png)
- [entry-workspace.png](../../output/playwright/audit/final/entry-workspace.png)
- [student-drawer.png](../../output/playwright/audit/final/student-drawer.png)
- [student-history.png](../../output/playwright/audit/final/student-history.png)
- [mentor-mentees.png](../../output/playwright/audit/final/mentor-mentees.png)
- [mentor-detail.png](../../output/playwright/audit/final/mentor-detail.png)
- [hod-department.png](../../output/playwright/audit/final/hod-department.png)
- [unlock-review.png](../../output/playwright/audit/final/unlock-review.png)
- [queue-history.png](../../output/playwright/audit/final/queue-history.png)
- [calendar.png](../../output/playwright/audit/final/calendar.png)
- [mobile-dashboard.png](../../output/playwright/audit/final/mobile-dashboard.png)
- [mobile-mentor-detail.png](../../output/playwright/audit/final/mobile-mentor-detail.png)
- [course-tt2-firefox.png](../../output/playwright/stabilization/course-tt2-firefox.png)
- [entry-tt2-firefox.png](../../output/playwright/stabilization/entry-tt2-firefox.png)
- [upload-lock-firefox.png](../../output/playwright/stabilization/upload-lock-firefox.png)
- [unlock-review-firefox.png](../../output/playwright/stabilization/unlock-review-firefox.png)
- [student-history-firefox.png](../../output/playwright/stabilization/student-history-firefox.png)

## Summary

The rendered audit confirms that the mock now has complete primary journeys for:

- Course Leader
- Mentor
- HoD

The biggest blockers from the earlier review are now resolved in the UI:

- mentee click path is no longer dead
- student history exists
- unlock review exists
- queue history exists
- scheme setup exists
- course tabs now deep-link into the exact entry workspace
- self-govern unlock appears for faculty who also hold HoD permission
- note-required handoff and unlock flows are represented in the UI contract

## Findings

### Blockers

No current rendered blockers were found in the primary faculty flows.

### Major Issues

- Narrow-width layout is now usable, but the top bar remains visually crowded and some dense pages still feel compressed rather than designed-for-mobile.
- Scheme setup is fully represented, but the seeded Course Leader offerings mostly show the post-entry lock scenario; the pristine pre-entry course-leader setup case is better represented conceptually than operationally in current seed data.
- The mock now computes provisional subject score, band, and predicted CGPA live, but the final academic engine is still frontend-owned and should not be treated as backend-ready truth.

### Polish Issues

- Queue sidebar remains dense on pages with many active tasks, even though the open/close motion is now cleaner.
- Some academic tabs remain obviously mock-representational compared with the more complete queue, history, and unlock flows.
- The mobile screenshots show the content correctly after side panels collapse, but the product still needs a more intentional small-screen top-bar layout.

## Surface Review

### Login

Status:

- good for mock entry

Observation:

- fast and clear, but intentionally simple

### Course Leader Dashboard

Status:

- strong

Observation:

- still one of the best-composed pages in the app
- queue visibility on the right creates immediate operational context

### Course Detail

Status:

- strong

Observation:

- overview and risk remain useful drill-down anchors
- gradebook now benefits from explicit scheme setup rather than standing alone as an implied rules editor

### Scheme Setup

Status:

- newly complete

Observation:

- does a good job separating fixed university rules from configurable inputs
- effectively communicates that post-entry changes require unlock/reset governance

### Data Entry Hub And Entry Workspace

Status:

- operationally coherent

Observation:

- scheme gating and lock messaging are visible
- self-govern unlock appears correctly for multi-role faculty
- term-test entry now matches the editable `25`-mark blueprint model more closely
- HoD no longer reads as a silent override role
- shared runtime propagation means entry edits now affect downstream summaries inside the mock

### Student Drawer

Status:

- materially improved

Observation:

- summary academics for Mentor now feel appropriate
- student-history link removes a major dead end

### Student History

Status:

- newly complete

Observation:

- transcript history, SGPA, CGPA, repeated subjects, and notes are now visible
- this page successfully establishes prior-semester performance as a first-class concept

### Mentor Workspace

Status:

- newly complete

Observation:

- mentee list plus detail page now feels like a real mentor journey
- overdue remedial example adds realism to the mentor queue

### HoD Workspace

Status:

- newly stronger

Observation:

- unlock review makes HoD behavior feel supervisory and auditable
- queue history and department drill-down now support the role better

### Queue History

Status:

- newly complete

Observation:

- transition trail makes the single-owner model legible
- resolved history retention is a meaningful improvement over the earlier disappearing-task behavior
- sender-note retention now makes queue handoff intent auditable

### Calendar

Status:

- adequate

Observation:

- still simple, but enough for mock flow continuity

### Narrow-Width Pass

Status:

- usable with caveats

Observation:

- auto-collapsing side panels fixed the most serious mobile breakage
- mentor detail is now readable on narrow width
- the next round of polish should focus on top-bar density and spacing

# AirMentor UX / UI Audit

## What this area does
This document audits the user experience beyond visuals: information architecture, discoverability, state clarity, workflow progression, feedback quality, and trust.

## Confirmed observations
- The portal landing page is clear and concise. It distinguishes the academic and admin workspaces well.
- The portal is now behaviorally neutral again. `#/` stays on the home selector unless the user explicitly navigates into a workspace.
- The academic workspace and system-admin workspace both expose large amounts of functionality through dense surfaces rather than strongly staged wizard-like flows.
- Proof pages in `src/pages/student-shell.tsx`, `src/pages/risk-explorer.tsx`, and `src/pages/hod-pages.tsx` provide stronger authority framing and disclaimer copy than much of the rest of the product.
- Admin request progression is encoded through a multistage action sequence exercised in both backend routes and Playwright scripts.
- Admin search, faculty detail, and curriculum configuration all depend on hierarchical scope selections and route state in `src/system-admin-live-data.ts` and `src/system-admin-live-app.tsx`.
- The admin faculty planner is intentionally constrained compared with the teaching planner, and timetable editing is governed by a visible-but-underexplained 14-day direct-edit window plus lock state.
- Restored proof playback and narrow admin route context are now visibly surfaced with reset affordances instead of only silently reappearing.
- Proof dashboard UX now includes queue health, worker lease, retry/failure, and checkpoint readiness cues.

## Key workflows and contracts
### UX-critical flows
1. Portal selection and workspace recovery.
2. Login and role context selection.
3. Admin hierarchy drill-down from faculty to department to branch to batch.
4. Request detail and status advancement.
5. Proof playback checkpoint selection and persistence.
6. Course leader movement from faculty proof panel to risk explorer to student shell.
7. HoD filter-based proof exploration.

## Current-state reconciliation (2026-03-28)
- The original UX diagnosis remains directionally correct, but some of the most confusing restore behavior is now improved:
  - home is neutral again
  - proof restore is explicit and resettable
  - blocked-stage reasoning and proof queue state are more visible
  - keyboard regression is now part of the live verification surface
- The main UX debt is now cognitive density and explanation quality, not hidden auto-restore alone.

## Findings
### UX strengths
- The product clearly knows who it is for. Labels such as “Teaching Workspace,” “System Admin Control Plane,” “Student Shell,” and “Risk Explorer” are intentional and domain-specific.
- Proof surfaces communicate authority and boundedness better than the rest of the app.
- Acceptance scripts show that the major admin and proof flows are navigable enough to automate realistically.

### UX weaknesses
- Information density is high, especially in the admin workspace. The UI often assumes the user already understands hierarchy, scope, policy, and workflow semantics.
- Residual persistence still adds cognitive load. Remembered role, identity, route, and checkpoint state are now more visible, but they still assume a fairly expert user mental model.
- The request workflow exposes process verbs without enough embedded explanation of consequences or next-step meaning.
- The system often asks the user to think in internal structures such as faculty, department, branch, batch, section, run, checkpoint, and role context all at once.
- Student shell trust framing is materially better. The UI visibly labels responses as `Guardrail`, `Session Intro`, and `Deterministic Reply`, and the legend now sits adjacent to the deterministic shell surface. The remaining risk is whether low-frequency users interpret those labels correctly on the deployed product.
- Risk explorer and HoD proof surfaces surface blocked-stage state, but that concept is still cognitively heavy for casual users.

## Implications
- **User impact:** the product can feel competent but mentally expensive.
- **Trust impact:** the proof system can look less trustworthy if its context changes are not explained, even when the underlying data is correct.
- **Business impact:** user adoption risk is more about cognitive load and discoverability than about missing features.

## Recommendations
- Add persistent scope banners to admin and proof surfaces that summarize current faculty, branch, batch, role, and checkpoint context in plain language.
- Reframe request progression around outcomes rather than only workflow verbs.
- Make restored state visible with small “restored from your last session” affordances and one-click reset.
- Use progressive disclosure more aggressively in the admin workspace so secondary panels do not compete equally with the current task.
- Explain direct-edit window and timetable lock semantics in plain language at the moment the user encounters them.
- Add adjacent explanation for proof labels, degraded linkage warnings, and queue/checkpoint readiness so low-frequency users can interpret the new diagnostics correctly.

## Confirmed facts vs inference
### Confirmed facts
- Portal copy, proof disclaimers, request verbs, and proof playback persistence are explicit in code.
- The admin workspace includes dense multipanel surfaces and hierarchical selectors.

### Reasonable inference
- The current UX is optimized for power users who repeatedly work inside the system, not for low-frequency users or stakeholders who need lightweight oversight.

## Cross-links
- [01 Product Intent And User Experience Overview](./01-product-intent-and-user-experience-overview.md)
- [03 Frontend Audit](./03-frontend-audit.md)
- [08 State Management And Client Logic Audit](./08-state-management-and-client-logic-audit.md)
- [12 Accessibility Audit](./12-accessibility-audit.md)
- [17 Non-Technical Explanation For Stakeholders](./17-non-technical-explanation-for-stakeholders.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)

# AirMentor Guided Demo Reality Loop Design

## Intent

AirMentor must prove product value in a local simulated world when real institutional data is unavailable. The proof must be honest: it can show that predictions, queues, interventions, and next-stage outcomes are meaningful inside a realistic synthetic MSRUAS B.Tech Mathematics & Computing 2023 environment; it cannot claim production accuracy or real-data validation.

This slice turns the existing seeded demo into a guided product workflow that an evaluator can follow in the browser without reading internal docs or test code.

## Current Truth

- Local-only is the active deployment constraint. Do not switch the frontend to GitHub Pages or backend to Render/Railway in this slice.
- P5-D can provision a seeded demo workspace with demo-bound proof data, sessions, active run, Course Leader surface, HoD surface, and reset invalidation.
- The proof plane has 30 stage-gated checkpoints across 6 semesters and 5 stages.
- Stage evidence gating is proven: future marks do not leak before their stage, and prior-semester carryover appears after Sem1.
- Existing API/client support includes attendance entry, assessment entry, proof risk recompute, proof run advance, HoD proof bundle, student shell, risk explorer, reassessment acknowledge, and reassessment resolve.
- Existing browser evidence proves attendance edit can reach proof projections after recompute, but this is not yet exposed as a cohesive product journey.

## Product Problem

The codebase has many truthful backend/proof pieces, but the evaluator-facing product loop is fragmented:

- The sysadmin can start/provision proof data.
- The teacher can see risk surfaces.
- Editable evidence can affect proof projections.
- Interventions and next-stage outcomes exist.

However, the product does not yet guide a user through one complete story:

1. this student is at risk,
2. this evidence explains why,
3. change this accessible field,
4. recompute risk,
5. observe risk/queue/intervention impact,
6. resolve the action,
7. advance the stage,
8. validate whether the simulated next-stage outcome makes sense.

## Goal

Add a local guided demo reality loop that makes the core AirMentor promise visible:

- predictions are based on stage-authoritative evidence,
- editable academic data can affect risk,
- recommended interventions are tied to queue state,
- the simulated world evolves stage by stage in a plausible way,
- next-stage outcomes validate or challenge the intervention.

## Non-Goals

- Do not claim real-data predictive validity.
- Do not deploy to GitHub Pages, Render, or Railway.
- Do not implement multi-program templates.
- Do not rebuild the ML stack in this slice.
- Do not add broad physical schema routing.
- Do not add a generic no-code scenario editor.

## Recommended User Experience

Add a guided panel named **Demo Reality Loop** in the teacher product, preferably reachable from the Course Leader dashboard and/or Student Shell.

The panel should be explicitly demo-scoped and product-facing. It should not look like an internal test harness.

### Step 1: Select a proof student

Default to a deterministic seeded student with visible risk evidence in the active demo run. Show:

- student name and USN,
- current semester and stage,
- course/offering,
- current risk band and probability,
- queue status,
- top drivers.

If the selected student cannot be resolved, show a typed empty state and do not crash.

### Step 2: Show current evidence

Show the evidence fields that are authoritative at the current stage:

- attendance,
- TT1 when visible,
- TT2 when visible,
- quiz/assignment/CE when visible,
- SEE/overall only at post-SEE,
- prior CGPA/backlog after Sem1.

The UI should say future evidence is intentionally hidden until its stage.

### Step 3: Apply a demo evidence edit

Provide one safe, deterministic edit first:

- lower or raise attendance for the selected student in a real offering through the existing attendance route.

If assessment entry is already stable and easy to wire, also allow a TT/quiz/assignment edit in the same pattern. If not, keep the first slice attendance-only and record assessment edit as the next extension.

### Step 4: Recompute and show before/after delta

After edit, call the existing proof recompute path for the active run. Then refresh proof/student detail and show:

- evidence before -> after,
- risk probability before -> after,
- risk band before -> after,
- queue count/state before -> after,
- whether the student remains on the watchlist.

The UI must avoid claiming magic causality. It should say the delta is a deterministic simulated-world response to changed observed evidence and model rules.

### Step 5: Resolve an intervention

If a matching reassessment/alert exists, allow a guided resolution using existing reassessment resolve API. Show:

- recommended action label,
- who resolved it,
- resolution outcome,
- temporary response credit/recovery state if returned,
- queue state after resolution.

If no matching reassessment exists, show that no open intervention is available for this student/stage.

### Step 6: Advance and validate next-stage outcome

Use existing proof advance/stage controls or route to move to the next stage. Then compare the selected student's next-stage projection against the prior snapshot:

- did marks/risk improve,
- did risk remain high,
- did a new case open,
- did prior semester carryover affect the next stage where relevant.

This is a plausibility check, not proof of real-world accuracy.

## Data Flow

1. User enters a seeded demo workspace locally.
2. Course Leader opens Demo Reality Loop.
3. Frontend loads active run, checkpoint, selected student detail, and reassessment rows.
4. Frontend records a local before snapshot.
5. User applies a supported evidence edit through existing academic API.
6. Sysadmin-scoped or permitted control path recomputes observed-only risk for the active proof run.
7. Frontend reloads checkpoint/student detail and shows delta.
8. User resolves an intervention if one exists.
9. User advances to the next stage.
10. Frontend reloads the next checkpoint/student detail and shows validation summary.

## Component Boundaries

### Frontend guided panel

Responsible for:

- rendering the story,
- orchestrating existing API calls,
- storing before/after snapshots in component state,
- presenting honest explanatory copy,
- surfacing typed failures.

Not responsible for:

- inventing risk values,
- bypassing backend role/scope guards,
- mutating proof rows directly.

### API client additions

Only add methods if existing routes lack typed client wrappers. Prefer using existing `AirMentorApiClient` methods.

### Backend

Avoid backend changes unless a required existing route is missing or returns insufficient data for the product loop. If backend changes are needed, keep them narrow and test them.

## Error Handling

- Missing active run: show "Start/provision a demo run first".
- Missing demo workspace pointer: show "Enter a demo workspace first".
- Missing selected student: show a deterministic fallback or empty state.
- Evidence edit rejected: show API error and keep before snapshot.
- Recompute rejected: show error and do not claim risk changed.
- No intervention: show a neutral state.
- Advance rejected: show stage guard reason.

## Testing

Minimum unit/static coverage:

- Component renders the guided steps from fixture data.
- Delta formatting handles increased, decreased, and unchanged risk.
- Empty/error states render without crashing.

Minimum browser proof:

- Provision seeded demo workspace locally.
- Login as Course Leader in demo scope.
- Open Demo Reality Loop.
- Capture initial student risk/evidence.
- Apply attendance edit.
- Recompute risk.
- Assert UI shows evidence delta and refreshed risk/queue state.
- Resolve an intervention when present, or assert honest no-intervention state.
- Advance one stage.
- Assert next-stage validation summary renders.

Verification must use local frontend/backend and Nix-wrapped Firefox. If repo Playwright and Nix browser revisions differ, pin `PLAYWRIGHT_TEST_IMPORT` to the Nix Playwright module as in P5-D.

## Claim Boundary

After this slice, AirMentor may claim:

- In the local MSRUAS synthetic demo, stage-authoritative evidence drives risk surfaces.
- A user-editable evidence change can be recomputed into proof projections and displayed as a before/after risk story.
- The demo can show queue/intervention handling and next-stage validation in a realistic simulated environment.

AirMentor may not claim:

- real-world predictive accuracy,
- production ML readiness,
- institutional validation,
- multi-program generality,
- deployed readiness.

## Approval State

User approved this direction on 2026-05-11 by saying "go" and clarifying the target: no real data is available, but the project must prove that predictions make sense and are meaningful in a simulated environment that closely mirrors the real world.

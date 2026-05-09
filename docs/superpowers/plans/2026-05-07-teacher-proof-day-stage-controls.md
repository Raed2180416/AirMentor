# Teacher Proof Day/Stage Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make teacher proof controls production-grade: stage progression and persisted day progression are distinct, true-start playback works, and browser behavior proves real queue/date movement.

**Architecture:** Keep `simulationRuns.simulatedDateIso` as day source of truth. Keep stage checkpoints as stage playback source of truth. Teacher profile proof operations must expose enough checkpoint navigation metadata for true-start/latest playback without mocking.

**Tech Stack:** React + TypeScript + Vitest frontend tests; Fastify + Drizzle + Vitest backend tests; Playwright browser smoke.

---

### Task 1: Frontend RED tests

**Files:**
- Modify: `tests/faculty-profile-proof.test.tsx`

- [ ] Add tests proving teacher `Reset Playback` selects first checkpoint and day/stage controls are distinct.
- [ ] Run `npx vitest run tests/faculty-profile-proof.test.tsx --reporter=dot` and confirm failures.

### Task 2: Backend RED tests

**Files:**
- Modify: `air-mentor-api/tests/academic-proof-routes.test.ts`
- Modify: `air-mentor-api/tests/academic-proof-calendar-bridge.test.ts`

- [ ] Add tests proving academic `day` advance changes persisted `simulatedDateIso` and academic bootstrap due labels move with it.
- [ ] Run targeted backend tests and confirm missing/incorrect behavior fails.

### Task 3: Frontend implementation

**Files:**
- Modify: `src/proof-playback.ts`
- Modify: `src/proof-simulation-controls.tsx`
- Modify: `src/academic-faculty-profile-page.tsx`
- Modify: `src/App.tsx`
- Modify: `src/api/types.ts`

- [ ] Add explicit playback directions for `previous-day`, `previous-stage`, `next-checkpoint`, `start`, `end` if needed.
- [ ] Teacher reset writes first checkpoint id.
- [ ] Teacher previous stage writes previous checkpoint id.
- [ ] Teacher previous day does not fake previous stage.

### Task 4: Backend implementation

**Files:**
- Modify: `air-mentor-api/src/modules/academic-proof-routes.ts`
- Modify: `air-mentor-api/src/lib/proof-control-plane-advance-service.ts` if previous-day support is required.
- Modify: `air-mentor-api/src/modules/academic.ts`

- [ ] Ensure academic day advance persists `simulatedDateIso` and projection refresh exposes `proofPlayback.currentDateISO`.
- [ ] Ensure teacher proof operations expose checkpoint chain metadata.

### Task 5: Verification

- [ ] Run frontend targeted tests.
- [ ] Run backend targeted tests.
- [ ] Run TypeScript checks for frontend and backend.
- [ ] Run browser smoke against local dev server and verify teacher proof controls change visible date/queue behavior.

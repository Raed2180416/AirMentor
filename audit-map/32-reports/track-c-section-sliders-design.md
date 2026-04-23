# Track C Design — Per-Section Latent Parameter Sliders

> **Status: Design spec for next-session implementation. Builds on Phase 1-6d pipeline (see `@/home/raed/projects/air-mentor-ui/audit-map/32-reports/phase-1-6d-end-to-end-closeout.md`).**

## 1. Product intent (the why)

MSRUAS HoDs and Course Leaders need to explore counterfactuals on the fresh-sem1 simulation: "what if section B had better study habits?", "what if section A's exam pressure were lower?". The existing proof simulation assigns latent traits per student from a batch-wide prior; it does not let faculty tune per-section distributions interactively.

Track C delivers a **section sliders** UI panel that lets a System Admin / HoD:
1. Pick a section (A, B, etc.)
2. Slide knobs for the section's aggregate latent parameters (e.g., mean `practiceCompliance`, mean `interventionReceptivity`, mean `examPressure`, etc.)
3. See the section's projected risk-band distribution shift in real time
4. Persist the override as part of the run's `sectionOverridesJson` so the next simulation rebuild uses the tuned priors

This closes the counterfactual loop for demo stakeholders: they can see _how_ their section profile assumptions drive the risk spread.

## 2. Feature intent (what ships)

- **New table column**: `simulation_runs.section_overrides_json` (TEXT, nullable JSON). Shape:
  ```ts
  SectionOverrides = {
    [sectionCode: string]: {
      // Mean of each latent scalar in [0,1]. Null = use batch default.
      practiceCompliance: number | null
      interventionReceptivity: number | null
      examPressure: number | null
      helpSeekingTendency: number | null
      attendancePropensity: number | null
      consistency: number | null
      volatility: number | null
      // Spread (stddev) of each scalar. Null = use batch default.
      spread?: Partial<Record<keyof SectionOverrides[string], number>>
    }
  }
  ```
- **New library module** `air-mentor-api/src/lib/proof-section-override-applier.ts` (pure fns):
  - `applySectionOverrideToLatentBase(latentBase, sectionCode, overrides, seed)` → modified `latentBase` for a student. Applies section-specific shifts deterministically (seeded by student ID + section code).
  - Never changes the `archetype` or the structural shape — only shifts scalar means within safe bounds.
- **Integration point**: `seeded-semester-service.ts` → where it builds each student's latent profile, it now calls `applySectionOverrideToLatentBase` if the run has `sectionOverridesJson` set.
- **New React component** `src/pages/hod-section-sliders-panel.tsx`:
  - Renders per-section knob card.
  - Uses `src/repositories.ts` to GET `/api/proof/runs/:id/section-overrides` and PUT the updated overrides.
  - Debounced auto-save + live preview of projected risk distribution shift (via the existing risk-inference endpoint over the tuned priors).
- **New API endpoint** `PUT /api/proof/runs/:runId/section-overrides`:
  - Persists `sectionOverridesJson`.
  - Triggers `rebuildSimulationStagePlayback` if the run is `active` so the downstream UI refreshes.

## 3. Real-world grounding

- MSRUAS sections (A / B) differ in real life: section A traditionally gets higher-merit students, section B is more average. Section-wide latent tuning captures this without requiring individual-student edits.
- Faculty language: "section B struggles more with self-regulation" → slider for `consistency` and `examPressure`.
- Slider ranges are bounded by MSRUAS-realistic priors (per the trajectory-realism report): mean latent scalars stay in [0.2, 0.9]; section mean is typically within ±0.15 of batch mean.
- Per-section spread (stddev) stays in [0.08, 0.3]. Enforce at the API + UI.

## 4. How it ties into the rest of the app

- Upstream: `seeded-semester-service.ts` → `msruas-proof-sandbox.ts` trajectory generation.
- Downstream: every existing pipeline module consumes the tuned latent naturally (no other changes needed because the evidence applier + stage-realization engines take the student's profile as input, not the raw prior).
- Telemetry: add `sectionOverridesJson` to the `simulation_reset_snapshots` payload so restart preserves tuning.
- Audit: emit `section-overrides-updated` entry on every persist.

## 5. Implementation plan (next session)

### Step 1: schema migration
File: `air-mentor-api/src/db/schema.ts` + drizzle-kit generate

Add column:
```ts
export const simulationRuns = pgTable('simulation_runs', {
  // ... existing columns
  sectionOverridesJson: text('section_overrides_json'),
})
```

### Step 2: pure override applier
File: `air-mentor-api/src/lib/proof-section-override-applier.ts`

Exports:
- `parseSectionOverridesJson(json: string | null) -> SectionOverrides | null`
- `applySectionOverrideToLatentBase(input: { latentBase, sectionCode, overrides, studentId, runSeed }) -> LatentBase`
- `BOUND_LATENT_SHIFT = 0.15` constant (MSRUAS prior from Section 3)
- `BOUND_LATENT_MIN = 0.2`, `BOUND_LATENT_MAX = 0.9`

Behavior:
- If overrides[sectionCode] is null → return `latentBase` unchanged.
- Else shift each targeted scalar by `clamp(target_mean - current_mean, -0.15, +0.15)` then jitter by `stableUnit(runSeed, studentId, sectionCode, scalar_name) * spread`.
- Clamp final values to [0.2, 0.9].
- Pure fn, deterministic, no I/O.

**Tests**: 12+ cases covering:
- null / missing sectionCode → identity
- single scalar target → mean shift bounded
- spread applied deterministically by (studentId, scalar) seed
- clamp at bounds
- multi-scalar combined shifts
- out-of-range overrides rejected at parse time (return null fields)
- 20x determinism

### Step 3: seeded-semester-service integration
File: `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts`

At each `input.trajectory.latentBase` lookup, call `applySectionOverrideToLatentBase(...)` with the run's parsed `sectionOverridesJson`. Feature-flag the integration behind `AIRMENTOR_SECTION_OVERRIDES_V1=1` for the same reversible pattern as Phase 6d.

### Step 4: API endpoint
File: `air-mentor-api/src/modules/academic-proof-runs-routes.ts` (or nearest proof-routes module)

`PUT /api/proof/runs/:runId/section-overrides`:
- Auth: System Admin + HoD role
- Body: `SectionOverrides`
- Persist to `simulation_runs.section_overrides_json`
- Emit audit entry
- If `activeFlag === 1`, trigger `rebuildSimulationStagePlayback`

`GET /api/proof/runs/:runId/section-overrides`: returns the parsed overrides or `null`.

### Step 5: UI panel
File: `src/pages/hod-section-sliders-panel.tsx`

Props: `{ runId: string, readOnly?: boolean }`

Layout:
- Header: section picker (A / B) + save-status indicator
- 7 sliders: practiceCompliance, interventionReceptivity, examPressure, helpSeekingTendency, attendancePropensity, consistency, volatility
- Each slider: range [BOUND_LATENT_MIN, BOUND_LATENT_MAX], step 0.01, with live "section mean Δ from batch default" tag
- Below: mini risk-band histogram preview (Low/Medium/High share per section, refreshed from `/api/academic/section-risk-rate` after each debounced slider change)
- Footer: Reset to defaults + Save button

State: React hooks over repository call pattern. TanStack Query for debounced auto-save (500ms throttle).

### Step 6: Playwright flow spec #3
File: `tests-e2e/specs/section-sliders-affects-risk.spec.ts`

Flow:
1. Seed run, login as HoD
2. Navigate to section-sliders panel
3. Capture baseline section-B High-risk %
4. Slide `examPressure` up by 0.15 for section B
5. Wait for debounced save + preview refresh
6. Assert section-B High-risk % strictly increased
7. Assert `section-overrides-updated` audit entry created

### Step 7: Tests and CI gate

- Unit: ≥ 12 tests on `proof-section-override-applier.ts`
- API contract: 3 tests on the new PUT endpoint (auth, schema validation, audit emission)
- Integration: Phase 6d pipeline still byte-identical when `sectionOverridesJson` is null (regression)
- Playwright: the new flow spec above

## 6. Non-negotiables

- Flag-gated: `AIRMENTOR_SECTION_OVERRIDES_V1=1`. Off path is byte-identical to pre-Track-C behavior.
- Pure override applier: no DB I/O, deterministic, replay-safe.
- Slider bounds enforce MSRUAS priors (prevent unrealistic tuning).
- Audit trail: every persist emits an event consumers can render.
- Reuses existing risk-inference + applier pipeline (Phase 6d) — no new engines.

## 7. Out of scope (explicitly deferred)

- Per-student overrides (stay at section-level)
- Historical replay of pre-override trajectories (baseline snapshot is already preserved)
- Animated transitions / advanced UX polish — ship functional first
- Multi-batch overrides (per-batch × per-section) — current demo is single-batch

## 8. Estimated scope (session-count)

- Steps 1–2 (schema + pure applier + unit tests): 1 session, ~4h
- Steps 3–4 (integration + API): 1 session, ~3h
- Steps 5–6 (UI panel + flow spec): 1 session, ~5h
- Step 7 (final tests + CI gate): 1 session, ~2h

Total: ~14h of focused work across ~3 sessions.

## 9. Links

- Parent project closeout: `@/home/raed/projects/air-mentor-ui/audit-map/32-reports/phase-1-6d-end-to-end-closeout.md`
- Feature flag pattern precedent: `AIRMENTOR_STAGE_REALIZATION_V1` in Phase 1-6d
- Pipeline DAG template (reuse for ML-risk-ui-audit + trajectory-realism dispatches): `@/home/raed/projects/air-mentor-ui/pipeline/agents/fresh-sem1-parallel-dispatch-dag.yaml`

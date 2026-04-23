-- Track C Phase 1b — 2026-04-23
-- Adds per-section latent-profile overrides column to simulation_runs.
--
-- Shape (JSON text):
--   { [sectionCode: string]: {
--       practiceCompliance?: number | null
--       interventionReceptivity?: number | null
--       examPressure?: number | null
--       helpSeekingTendency?: number | null
--       attendancePropensity?: number | null
--       consistency?: number | null
--       volatility?: number | null
--     }
--   }
--
-- Interpretation / bounds: proof-section-override-applier.ts
--   - Each scalar must be in [0.2, 0.9] or null (use batch default).
--   - Shift from batch-prior mean capped to +/-0.15.
--   - Per-student jitter +/-0.06 preserves within-section variance.
--
-- Flag-gated by AIRMENTOR_SECTION_OVERRIDES_V1=1 at the applier site.
-- Flag off -> column is ignored, simulation is byte-identical to pre-Track-C.
--
-- Nullable column; existing rows unaffected.

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS section_overrides_json text;

ALTER TABLE simulation_runs
ADD COLUMN IF NOT EXISTS active_stage_key text;

ALTER TABLE simulation_runs
ADD COLUMN IF NOT EXISTS simulated_date_iso text;

ALTER TABLE simulation_runs
ADD COLUMN IF NOT EXISTS setup_config_json text;

ALTER TABLE simulation_runs
ADD COLUMN IF NOT EXISTS scenario_config_json text;

ALTER TABLE simulation_runs
ADD COLUMN IF NOT EXISTS lifecycle_state text;

ALTER TABLE simulation_runs
ADD COLUMN IF NOT EXISTS run_mode text;

ALTER TABLE simulation_runs
ADD COLUMN IF NOT EXISTS stage_boundary_json text;

UPDATE simulation_runs
SET active_stage_key = COALESCE(active_stage_key, 'pre-tt1')
WHERE active_stage_key IS NULL;

UPDATE simulation_runs
SET simulated_date_iso = COALESCE(simulated_date_iso, created_at)
WHERE simulated_date_iso IS NULL;

UPDATE simulation_runs
SET setup_config_json = COALESCE(setup_config_json, '{}')
WHERE setup_config_json IS NULL;

UPDATE simulation_runs
SET scenario_config_json = COALESCE(scenario_config_json, '{}')
WHERE scenario_config_json IS NULL;

UPDATE simulation_runs
SET lifecycle_state = COALESCE(
  lifecycle_state,
  CASE
    WHEN status = 'active' THEN 'active'
    WHEN active_flag = 1 THEN 'completed-inspectable'
    WHEN status = 'archived' THEN 'archived'
    WHEN status = 'running' THEN 'running'
    ELSE 'completed'
  END
)
WHERE lifecycle_state IS NULL;

UPDATE simulation_runs
SET run_mode = COALESCE(run_mode, source_type)
WHERE run_mode IS NULL;

UPDATE simulation_runs
SET stage_boundary_json = COALESCE(stage_boundary_json, '{"strictlyMonotonic":true,"availableSemesters":[],"semesters":[]}')
WHERE stage_boundary_json IS NULL;

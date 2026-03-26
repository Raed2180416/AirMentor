ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS progress_json text;

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS started_at text;

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS completed_at text;

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS failure_code text;

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS failure_message text;

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS worker_lease_token text;

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS worker_lease_expires_at text;

CREATE INDEX IF NOT EXISTS idx_simulation_runs_async_status
  ON simulation_runs(batch_id, status, active_flag, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_worker_lease
  ON simulation_runs(status, worker_lease_expires_at, created_at);

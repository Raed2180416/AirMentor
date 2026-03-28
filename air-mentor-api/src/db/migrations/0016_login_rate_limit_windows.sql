CREATE TABLE IF NOT EXISTS login_rate_limit_windows (
  attempt_key text PRIMARY KEY,
  failure_count integer NOT NULL DEFAULT 0,
  window_started_at text NOT NULL,
  last_failed_at text NOT NULL,
  updated_at text NOT NULL
);

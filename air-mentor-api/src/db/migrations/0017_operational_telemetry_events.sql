CREATE TABLE IF NOT EXISTS operational_telemetry_events (
  operational_telemetry_event_id text PRIMARY KEY,
  source text NOT NULL,
  name text NOT NULL,
  level text NOT NULL,
  event_timestamp text NOT NULL,
  payload_json text NOT NULL,
  created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operational_telemetry_events_timestamp
  ON operational_telemetry_events(event_timestamp DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_telemetry_events_level
  ON operational_telemetry_events(level, event_timestamp DESC);

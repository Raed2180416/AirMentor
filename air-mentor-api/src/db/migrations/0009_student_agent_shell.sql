CREATE TABLE IF NOT EXISTS student_agent_cards (
  student_agent_card_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  card_version integer NOT NULL DEFAULT 1,
  source_snapshot_hash text NOT NULL,
  card_json text NOT NULL,
  citation_map_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_agent_cards_run_student
  ON student_agent_cards(simulation_run_id, student_id, card_version);

CREATE TABLE IF NOT EXISTS student_agent_sessions (
  student_agent_session_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  student_agent_card_id text NOT NULL REFERENCES student_agent_cards(student_agent_card_id),
  viewer_faculty_id text REFERENCES faculty_profiles(faculty_id),
  viewer_role text NOT NULL,
  status text NOT NULL,
  response_mode text NOT NULL,
  card_version integer NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_agent_sessions_viewer
  ON student_agent_sessions(viewer_faculty_id, viewer_role, created_at DESC);

CREATE TABLE IF NOT EXISTS student_agent_messages (
  student_agent_message_id text PRIMARY KEY,
  student_agent_session_id text NOT NULL REFERENCES student_agent_sessions(student_agent_session_id),
  actor_type text NOT NULL,
  message_type text NOT NULL,
  body text NOT NULL,
  citations_json text NOT NULL,
  guardrail_code text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_agent_messages_session
  ON student_agent_messages(student_agent_session_id, created_at ASC);

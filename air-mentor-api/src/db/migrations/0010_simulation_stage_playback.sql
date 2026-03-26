CREATE TABLE IF NOT EXISTS simulation_stage_checkpoints (
  simulation_stage_checkpoint_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  semester_number integer NOT NULL,
  stage_key text NOT NULL,
  stage_label text NOT NULL,
  stage_description text NOT NULL,
  stage_order integer NOT NULL,
  previous_checkpoint_id text,
  next_checkpoint_id text,
  summary_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulation_stage_checkpoints_run_order
  ON simulation_stage_checkpoints(simulation_run_id, semester_number, stage_order);

CREATE TABLE IF NOT EXISTS simulation_stage_student_projections (
  simulation_stage_student_projection_id text PRIMARY KEY,
  simulation_stage_checkpoint_id text NOT NULL REFERENCES simulation_stage_checkpoints(simulation_stage_checkpoint_id),
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text REFERENCES section_offerings(offering_id),
  semester_number integer NOT NULL,
  section_code text NOT NULL,
  course_code text NOT NULL,
  course_title text NOT NULL,
  risk_prob_scaled integer NOT NULL,
  risk_band text NOT NULL,
  no_action_risk_prob_scaled integer NOT NULL,
  no_action_risk_band text NOT NULL,
  recommended_action text,
  simulated_action_taken text,
  queue_state text,
  reassessment_state text,
  evidence_window text NOT NULL,
  projection_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stage_student_projection_checkpoint_student
  ON simulation_stage_student_projections(simulation_stage_checkpoint_id, student_id);

CREATE INDEX IF NOT EXISTS idx_stage_student_projection_run_student
  ON simulation_stage_student_projections(simulation_run_id, student_id, semester_number);

CREATE TABLE IF NOT EXISTS simulation_stage_offering_projections (
  simulation_stage_offering_projection_id text PRIMARY KEY,
  simulation_stage_checkpoint_id text NOT NULL REFERENCES simulation_stage_checkpoints(simulation_stage_checkpoint_id),
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  offering_id text REFERENCES section_offerings(offering_id),
  curriculum_node_id text REFERENCES curriculum_nodes(curriculum_node_id),
  semester_number integer NOT NULL,
  section_code text NOT NULL,
  course_code text NOT NULL,
  course_title text NOT NULL,
  stage integer NOT NULL,
  stage_label text NOT NULL,
  stage_description text NOT NULL,
  pending_action text,
  projection_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stage_offering_projection_checkpoint
  ON simulation_stage_offering_projections(simulation_stage_checkpoint_id, offering_id, curriculum_node_id);

CREATE TABLE IF NOT EXISTS simulation_stage_queue_projections (
  simulation_stage_queue_projection_id text PRIMARY KEY,
  simulation_stage_checkpoint_id text NOT NULL REFERENCES simulation_stage_checkpoints(simulation_stage_checkpoint_id),
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text REFERENCES section_offerings(offering_id),
  semester_number integer NOT NULL,
  section_code text NOT NULL,
  course_code text NOT NULL,
  course_title text NOT NULL,
  assigned_to_role text,
  task_type text NOT NULL,
  status text NOT NULL,
  risk_band text NOT NULL,
  risk_prob_scaled integer NOT NULL,
  no_action_risk_prob_scaled integer NOT NULL,
  recommended_action text,
  simulated_action_taken text,
  detail_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stage_queue_projection_checkpoint
  ON simulation_stage_queue_projections(simulation_stage_checkpoint_id, assigned_to_role, status);

ALTER TABLE student_agent_cards
  ADD COLUMN IF NOT EXISTS simulation_stage_checkpoint_id text REFERENCES simulation_stage_checkpoints(simulation_stage_checkpoint_id);

CREATE INDEX IF NOT EXISTS idx_student_agent_cards_run_student_checkpoint
  ON student_agent_cards(simulation_run_id, student_id, simulation_stage_checkpoint_id, card_version);

ALTER TABLE student_agent_sessions
  ADD COLUMN IF NOT EXISTS simulation_stage_checkpoint_id text REFERENCES simulation_stage_checkpoints(simulation_stage_checkpoint_id);

CREATE INDEX IF NOT EXISTS idx_student_agent_sessions_run_student_checkpoint
  ON student_agent_sessions(simulation_run_id, student_id, simulation_stage_checkpoint_id, created_at DESC);

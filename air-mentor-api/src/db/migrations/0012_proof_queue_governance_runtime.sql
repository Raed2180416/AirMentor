ALTER TABLE simulation_stage_queue_projections
  ADD COLUMN IF NOT EXISTS simulation_stage_queue_case_id text,
  ADD COLUMN IF NOT EXISTS assigned_faculty_id text REFERENCES faculty_profiles(faculty_id);

CREATE TABLE IF NOT EXISTS simulation_stage_queue_cases (
  simulation_stage_queue_case_id text PRIMARY KEY,
  simulation_stage_checkpoint_id text NOT NULL REFERENCES simulation_stage_checkpoints(simulation_stage_checkpoint_id),
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  primary_offering_id text REFERENCES section_offerings(offering_id),
  semester_number integer NOT NULL,
  section_code text NOT NULL,
  stage_key text NOT NULL,
  assigned_to_role text,
  assigned_faculty_id text REFERENCES faculty_profiles(faculty_id),
  status text NOT NULL,
  recommended_action text,
  due_at text,
  counts_toward_capacity integer NOT NULL DEFAULT 0,
  priority_rank integer,
  governance_reason text NOT NULL,
  primary_course_code text NOT NULL,
  primary_course_title text NOT NULL,
  supporting_course_count integer NOT NULL DEFAULT 0,
  supporting_source_keys_json text NOT NULL,
  case_json text NOT NULL,
  detail_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stage_queue_cases_run_checkpoint
  ON simulation_stage_queue_cases(simulation_run_id, simulation_stage_checkpoint_id, student_id);

CREATE INDEX IF NOT EXISTS idx_stage_queue_cases_section_stage
  ON simulation_stage_queue_cases(simulation_run_id, semester_number, section_code, stage_key, status);

ALTER TABLE reassessment_events
  ADD COLUMN IF NOT EXISTS assigned_faculty_id text REFERENCES faculty_profiles(faculty_id);

ALTER TABLE reassessment_resolutions
  ADD COLUMN IF NOT EXISTS resolution_json text;

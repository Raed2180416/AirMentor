CREATE TABLE IF NOT EXISTS risk_evidence_snapshots (
  risk_evidence_snapshot_id text PRIMARY KEY,
  simulation_run_id text REFERENCES simulation_runs(simulation_run_id),
  simulation_stage_checkpoint_id text REFERENCES simulation_stage_checkpoints(simulation_stage_checkpoint_id),
  batch_id text REFERENCES batches(batch_id),
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text REFERENCES section_offerings(offering_id),
  semester_number integer NOT NULL,
  section_code text NOT NULL,
  course_code text NOT NULL,
  course_title text NOT NULL,
  stage_key text,
  evidence_window text NOT NULL,
  feature_schema_version text NOT NULL,
  feature_json text NOT NULL,
  label_json text NOT NULL,
  source_refs_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_evidence_snapshots_run_checkpoint
  ON risk_evidence_snapshots(simulation_run_id, simulation_stage_checkpoint_id, student_id);

CREATE INDEX IF NOT EXISTS idx_risk_evidence_snapshots_batch_course
  ON risk_evidence_snapshots(batch_id, course_code, semester_number);

CREATE TABLE IF NOT EXISTS risk_model_artifacts (
  risk_model_artifact_id text PRIMARY KEY,
  batch_id text REFERENCES batches(batch_id),
  simulation_run_id text REFERENCES simulation_runs(simulation_run_id),
  artifact_type text NOT NULL,
  model_family text NOT NULL,
  artifact_version text NOT NULL,
  feature_schema_version text NOT NULL,
  source_run_ids_json text NOT NULL,
  payload_json text NOT NULL,
  evaluation_json text NOT NULL,
  status text NOT NULL,
  active_flag integer NOT NULL DEFAULT 1,
  created_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_model_artifacts_batch_type_active
  ON risk_model_artifacts(batch_id, artifact_type, active_flag, created_at DESC);

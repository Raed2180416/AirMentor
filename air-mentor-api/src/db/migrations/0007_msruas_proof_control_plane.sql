ALTER TABLE curriculum_import_versions
  ADD COLUMN IF NOT EXISTS source_path text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'workbook',
  ADD COLUMN IF NOT EXISTS compiler_version text NOT NULL DEFAULT 'msruas-proof-compiler-v1',
  ADD COLUMN IF NOT EXISTS output_checksum text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unresolved_mapping_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completeness_certificate_json text NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approved_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  ADD COLUMN IF NOT EXISTS approved_at text;

CREATE TABLE IF NOT EXISTS curriculum_validation_results (
  curriculum_validation_result_id text PRIMARY KEY,
  curriculum_import_version_id text NOT NULL REFERENCES curriculum_import_versions(curriculum_import_version_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  validator_version text NOT NULL,
  status text NOT NULL,
  summary_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_curriculum_validation_results_import
  ON curriculum_validation_results(curriculum_import_version_id, created_at DESC);

CREATE TABLE IF NOT EXISTS official_code_crosswalks (
  official_code_crosswalk_id text PRIMARY KEY,
  curriculum_import_version_id text NOT NULL REFERENCES curriculum_import_versions(curriculum_import_version_id),
  curriculum_node_id text NOT NULL REFERENCES curriculum_nodes(curriculum_node_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  internal_compiler_id text NOT NULL,
  official_web_code text,
  official_web_title text,
  confidence text NOT NULL,
  evidence_source text NOT NULL,
  review_status text NOT NULL,
  override_reason text,
  approved_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  approved_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_official_code_crosswalks_import
  ON official_code_crosswalks(curriculum_import_version_id, review_status, internal_compiler_id);

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS parent_simulation_run_id text,
  ADD COLUMN IF NOT EXISTS active_flag integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'simulation',
  ADD COLUMN IF NOT EXISTS policy_snapshot_json text NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engine_versions_json text NOT NULL DEFAULT '{}';

ALTER TABLE simulation_reset_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_label text NOT NULL DEFAULT 'Baseline snapshot';

CREATE TABLE IF NOT EXISTS simulation_lifecycle_audits (
  simulation_lifecycle_audit_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  action_type text NOT NULL,
  payload_json text NOT NULL,
  created_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulation_lifecycle_audits_run
  ON simulation_lifecycle_audits(simulation_run_id, created_at DESC);

ALTER TABLE risk_assessments
  ADD COLUMN IF NOT EXISTS evidence_snapshot_id text,
  ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'observable-inference-v1',
  ADD COLUMN IF NOT EXISTS policy_version text NOT NULL DEFAULT 'resolved-policy',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'simulation';

ALTER TABLE alert_decisions
  ADD COLUMN IF NOT EXISTS monitoring_policy_version text NOT NULL DEFAULT 'monitoring-v1';

CREATE TABLE IF NOT EXISTS risk_overrides (
  risk_override_id text PRIMARY KEY,
  risk_assessment_id text NOT NULL REFERENCES risk_assessments(risk_assessment_id),
  simulation_run_id text REFERENCES simulation_runs(simulation_run_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text REFERENCES section_offerings(offering_id),
  override_band text NOT NULL,
  override_note text NOT NULL,
  created_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_overrides_assessment
  ON risk_overrides(risk_assessment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
  alert_acknowledgement_id text PRIMARY KEY,
  alert_decision_id text NOT NULL REFERENCES alert_decisions(alert_decision_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  acknowledged_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  status text NOT NULL,
  note text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_acknowledgements_decision
  ON alert_acknowledgements(alert_decision_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reassessment_resolutions (
  reassessment_resolution_id text PRIMARY KEY,
  reassessment_event_id text NOT NULL REFERENCES reassessment_events(reassessment_event_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  resolved_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  resolution_status text NOT NULL,
  note text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reassessment_resolutions_event
  ON reassessment_resolutions(reassessment_event_id, created_at DESC);

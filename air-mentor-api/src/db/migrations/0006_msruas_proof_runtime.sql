CREATE TABLE IF NOT EXISTS curriculum_import_versions (
  curriculum_import_version_id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES batches(batch_id),
  source_label text NOT NULL,
  source_checksum text NOT NULL,
  first_semester integer NOT NULL,
  last_semester integer NOT NULL,
  course_count integer NOT NULL,
  total_credits integer NOT NULL,
  explicit_edge_count integer NOT NULL,
  added_edge_count integer NOT NULL,
  bridge_module_count integer NOT NULL,
  elective_option_count integer NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_curriculum_import_versions_batch
  ON curriculum_import_versions(batch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS curriculum_nodes (
  curriculum_node_id text PRIMARY KEY,
  curriculum_import_version_id text NOT NULL REFERENCES curriculum_import_versions(curriculum_import_version_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  semester_number integer NOT NULL,
  course_id text REFERENCES courses(course_id),
  course_code text NOT NULL,
  title text NOT NULL,
  credits integer NOT NULL,
  internal_compiler_id text NOT NULL,
  official_web_code text,
  official_web_title text,
  match_status text NOT NULL,
  mapping_note text,
  assessment_profile text NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_curriculum_nodes_batch_sem
  ON curriculum_nodes(batch_id, semester_number, course_code);

CREATE TABLE IF NOT EXISTS curriculum_edges (
  curriculum_edge_id text PRIMARY KEY,
  curriculum_import_version_id text NOT NULL REFERENCES curriculum_import_versions(curriculum_import_version_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  source_curriculum_node_id text NOT NULL REFERENCES curriculum_nodes(curriculum_node_id),
  target_curriculum_node_id text NOT NULL REFERENCES curriculum_nodes(curriculum_node_id),
  edge_kind text NOT NULL,
  rationale text NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_curriculum_edges_batch_kind
  ON curriculum_edges(batch_id, edge_kind, target_curriculum_node_id);

CREATE TABLE IF NOT EXISTS bridge_modules (
  bridge_module_id text PRIMARY KEY,
  curriculum_import_version_id text NOT NULL REFERENCES curriculum_import_versions(curriculum_import_version_id),
  curriculum_node_id text NOT NULL REFERENCES curriculum_nodes(curriculum_node_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  module_titles_json text NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS course_topic_partitions (
  course_topic_partition_id text PRIMARY KEY,
  curriculum_import_version_id text NOT NULL REFERENCES curriculum_import_versions(curriculum_import_version_id),
  curriculum_node_id text NOT NULL REFERENCES curriculum_nodes(curriculum_node_id),
  partition_kind text NOT NULL,
  topics_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS elective_baskets (
  elective_basket_id text PRIMARY KEY,
  curriculum_import_version_id text NOT NULL REFERENCES curriculum_import_versions(curriculum_import_version_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  semester_number integer NOT NULL,
  stream text NOT NULL,
  pce_group text NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_elective_baskets_batch_sem
  ON elective_baskets(batch_id, semester_number, stream);

CREATE TABLE IF NOT EXISTS elective_options (
  elective_option_id text PRIMARY KEY,
  elective_basket_id text NOT NULL REFERENCES elective_baskets(elective_basket_id),
  code text NOT NULL,
  title text NOT NULL,
  stream text NOT NULL,
  semester_slot text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS simulation_runs (
  simulation_run_id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES batches(batch_id),
  curriculum_import_version_id text REFERENCES curriculum_import_versions(curriculum_import_version_id),
  run_label text NOT NULL,
  status text NOT NULL,
  seed integer NOT NULL,
  section_count integer NOT NULL,
  student_count integer NOT NULL,
  faculty_count integer NOT NULL,
  semester_start integer NOT NULL,
  semester_end integer NOT NULL,
  metrics_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_batch
  ON simulation_runs(batch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_load_profiles (
  teacher_load_profile_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  semester_number integer NOT NULL,
  section_load_count integer NOT NULL,
  weekly_contact_hours integer NOT NULL,
  assigned_credits integer NOT NULL,
  permissions_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_load_profiles_run_faculty
  ON teacher_load_profiles(simulation_run_id, faculty_id, semester_number);

CREATE TABLE IF NOT EXISTS teacher_allocations (
  teacher_allocation_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  offering_id text REFERENCES section_offerings(offering_id),
  curriculum_node_id text REFERENCES curriculum_nodes(curriculum_node_id),
  semester_number integer NOT NULL,
  section_code text,
  allocation_role text NOT NULL,
  planned_contact_hours integer NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_allocations_run_faculty
  ON teacher_allocations(simulation_run_id, faculty_id, semester_number);

CREATE TABLE IF NOT EXISTS student_latent_states (
  student_latent_state_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  semester_number integer NOT NULL,
  section_code text NOT NULL,
  latent_state_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_latent_states_run_student
  ON student_latent_states(simulation_run_id, student_id, semester_number);

CREATE TABLE IF NOT EXISTS student_observed_semester_states (
  student_observed_semester_state_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  term_id text REFERENCES academic_terms(term_id),
  semester_number integer NOT NULL,
  section_code text NOT NULL,
  observed_state_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_observed_states_run_student
  ON student_observed_semester_states(simulation_run_id, student_id, semester_number);

CREATE TABLE IF NOT EXISTS semester_transition_logs (
  semester_transition_log_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  from_semester integer NOT NULL,
  to_semester integer NOT NULL,
  summary_json text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS simulation_reset_snapshots (
  simulation_reset_snapshot_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  snapshot_json text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_assessments (
  risk_assessment_id text PRIMARY KEY,
  simulation_run_id text REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text NOT NULL REFERENCES section_offerings(offering_id),
  term_id text REFERENCES academic_terms(term_id),
  assessment_scope text NOT NULL,
  risk_prob_scaled integer NOT NULL,
  risk_band text NOT NULL,
  recommended_action text NOT NULL,
  drivers_json text NOT NULL,
  evidence_window text NOT NULL,
  assessed_at text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_student_offering
  ON risk_assessments(student_id, offering_id, assessed_at DESC);

CREATE TABLE IF NOT EXISTS reassessment_events (
  reassessment_event_id text PRIMARY KEY,
  risk_assessment_id text NOT NULL REFERENCES risk_assessments(risk_assessment_id),
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text REFERENCES section_offerings(offering_id),
  assigned_to_role text NOT NULL,
  due_at text NOT NULL,
  status text NOT NULL,
  payload_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reassessment_events_student_due
  ON reassessment_events(student_id, due_at, status);

CREATE TABLE IF NOT EXISTS alert_decisions (
  alert_decision_id text PRIMARY KEY,
  risk_assessment_id text NOT NULL REFERENCES risk_assessments(risk_assessment_id),
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text REFERENCES section_offerings(offering_id),
  decision_type text NOT NULL,
  queue_owner_role text NOT NULL,
  note text NOT NULL,
  reassessment_due_at text,
  cooldown_until text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_decisions_student_created
  ON alert_decisions(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_outcomes (
  alert_outcome_id text PRIMARY KEY,
  alert_decision_id text NOT NULL REFERENCES alert_decisions(alert_decision_id),
  outcome_status text NOT NULL,
  acknowledged_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  acknowledged_at text,
  outcome_note text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS elective_recommendations (
  elective_recommendation_id text PRIMARY KEY,
  simulation_run_id text REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  batch_id text NOT NULL REFERENCES batches(batch_id),
  semester_number integer NOT NULL,
  recommended_code text NOT NULL,
  recommended_title text NOT NULL,
  stream text NOT NULL,
  rationale_json text NOT NULL,
  alternatives_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_elective_recommendations_batch_student
  ON elective_recommendations(batch_id, student_id, semester_number);

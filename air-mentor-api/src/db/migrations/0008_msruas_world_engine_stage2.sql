CREATE TABLE IF NOT EXISTS student_behavior_profiles (
  student_behavior_profile_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  section_code text NOT NULL,
  current_semester integer NOT NULL,
  program_scope_version text NOT NULL,
  profile_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_behavior_profiles_run_student
  ON student_behavior_profiles(simulation_run_id, student_id);

CREATE TABLE IF NOT EXISTS student_topic_states (
  student_topic_state_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  semester_number integer NOT NULL,
  curriculum_node_id text REFERENCES curriculum_nodes(curriculum_node_id),
  offering_id text REFERENCES section_offerings(offering_id),
  section_code text NOT NULL,
  topic_key text NOT NULL,
  topic_name text NOT NULL,
  state_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_topic_states_run_student_semester
  ON student_topic_states(simulation_run_id, student_id, semester_number);

CREATE TABLE IF NOT EXISTS student_co_states (
  student_co_state_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  semester_number integer NOT NULL,
  curriculum_node_id text REFERENCES curriculum_nodes(curriculum_node_id),
  offering_id text REFERENCES section_offerings(offering_id),
  section_code text NOT NULL,
  co_code text NOT NULL,
  co_title text NOT NULL,
  state_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_co_states_run_student_semester
  ON student_co_states(simulation_run_id, student_id, semester_number);

CREATE TABLE IF NOT EXISTS world_context_snapshots (
  world_context_snapshot_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  semester_number integer NOT NULL,
  section_code text,
  context_type text NOT NULL,
  context_key text NOT NULL,
  context_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_context_snapshots_run_semester
  ON world_context_snapshots(simulation_run_id, semester_number, section_code);

CREATE TABLE IF NOT EXISTS simulation_question_templates (
  simulation_question_template_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  semester_number integer NOT NULL,
  curriculum_node_id text REFERENCES curriculum_nodes(curriculum_node_id),
  offering_id text REFERENCES section_offerings(offering_id),
  component_type text NOT NULL,
  question_index integer NOT NULL,
  question_code text NOT NULL,
  question_type text NOT NULL,
  question_marks integer NOT NULL,
  difficulty_scaled integer NOT NULL,
  transfer_demand_scaled integer NOT NULL,
  co_tags_json text NOT NULL,
  topic_tags_json text NOT NULL,
  micro_skill_tags_json text NOT NULL,
  source_type text NOT NULL,
  template_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulation_question_templates_run_component
  ON simulation_question_templates(simulation_run_id, semester_number, component_type);

CREATE TABLE IF NOT EXISTS student_question_results (
  student_question_result_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  semester_number integer NOT NULL,
  curriculum_node_id text REFERENCES curriculum_nodes(curriculum_node_id),
  offering_id text REFERENCES section_offerings(offering_id),
  simulation_question_template_id text NOT NULL REFERENCES simulation_question_templates(simulation_question_template_id),
  component_type text NOT NULL,
  section_code text NOT NULL,
  score integer NOT NULL,
  max_score integer NOT NULL,
  result_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_question_results_run_student_semester
  ON student_question_results(simulation_run_id, student_id, semester_number, component_type);

CREATE TABLE IF NOT EXISTS student_intervention_response_states (
  student_intervention_response_state_id text PRIMARY KEY,
  simulation_run_id text NOT NULL REFERENCES simulation_runs(simulation_run_id),
  student_id text NOT NULL REFERENCES students(student_id),
  semester_number integer NOT NULL,
  section_code text NOT NULL,
  offering_id text REFERENCES section_offerings(offering_id),
  intervention_id text,
  intervention_type text NOT NULL,
  response_state_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_intervention_response_states_run_student
  ON student_intervention_response_states(simulation_run_id, student_id, semester_number);

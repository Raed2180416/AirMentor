CREATE TABLE IF NOT EXISTS student_attendance_snapshots (
  attendance_snapshot_id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text NOT NULL REFERENCES section_offerings(offering_id),
  present_classes integer NOT NULL,
  total_classes integer NOT NULL,
  attendance_percent integer NOT NULL,
  source text NOT NULL,
  captured_at text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_offering_captured
  ON student_attendance_snapshots(student_id, offering_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS student_assessment_scores (
  assessment_score_id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text NOT NULL REFERENCES section_offerings(offering_id),
  term_id text REFERENCES academic_terms(term_id),
  component_type text NOT NULL,
  component_code text,
  score integer NOT NULL,
  max_score integer NOT NULL,
  evaluated_at text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_student_offering_component
  ON student_assessment_scores(student_id, offering_id, component_type, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS student_interventions (
  intervention_id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(student_id),
  faculty_id text REFERENCES faculty_profiles(faculty_id),
  offering_id text REFERENCES section_offerings(offering_id),
  intervention_type text NOT NULL,
  note text NOT NULL,
  occurred_at text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interventions_student_occurred
  ON student_interventions(student_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS transcript_term_results (
  transcript_term_result_id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(student_id),
  term_id text NOT NULL REFERENCES academic_terms(term_id),
  sgpa_scaled integer NOT NULL,
  registered_credits integer NOT NULL,
  earned_credits integer NOT NULL,
  backlog_count integer NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcript_term_student_term
  ON transcript_term_results(student_id, term_id);

CREATE TABLE IF NOT EXISTS transcript_subject_results (
  transcript_subject_result_id text PRIMARY KEY,
  transcript_term_result_id text NOT NULL REFERENCES transcript_term_results(transcript_term_result_id),
  course_code text NOT NULL,
  title text NOT NULL,
  credits integer NOT NULL,
  score integer NOT NULL,
  grade_label text NOT NULL,
  grade_point integer NOT NULL,
  result text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcript_subject_term
  ON transcript_subject_results(transcript_term_result_id);

CREATE TABLE IF NOT EXISTS course_outcome_overrides (
  course_outcome_override_id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(course_id),
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  outcomes_json text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_course_outcomes_course_scope
  ON course_outcome_overrides(course_id, scope_type, scope_id);

CREATE TABLE IF NOT EXISTS offering_assessment_schemes (
  offering_id text PRIMARY KEY REFERENCES section_offerings(offering_id),
  configured_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  scheme_json text NOT NULL,
  policy_snapshot_json text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS offering_question_papers (
  paper_id text PRIMARY KEY,
  offering_id text NOT NULL REFERENCES section_offerings(offering_id),
  kind text NOT NULL,
  blueprint_json text NOT NULL,
  updated_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offering_question_papers_unique
  ON offering_question_papers(offering_id, kind);

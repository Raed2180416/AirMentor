CREATE TABLE IF NOT EXISTS section_offerings (
  offering_id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(course_id),
  term_id text NOT NULL REFERENCES academic_terms(term_id),
  branch_id text NOT NULL REFERENCES branches(branch_id),
  section_code text NOT NULL,
  year_label text NOT NULL,
  attendance integer NOT NULL,
  student_count integer NOT NULL,
  stage integer NOT NULL,
  stage_label text NOT NULL,
  stage_description text NOT NULL,
  stage_color text NOT NULL,
  tt1_done integer NOT NULL DEFAULT 0,
  tt2_done integer NOT NULL DEFAULT 0,
  tt1_locked integer NOT NULL DEFAULT 0,
  tt2_locked integer NOT NULL DEFAULT 0,
  quiz_locked integer NOT NULL DEFAULT 0,
  assignment_locked integer NOT NULL DEFAULT 0,
  pending_action text,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS faculty_offering_ownerships (
  ownership_id text PRIMARY KEY,
  offering_id text NOT NULL REFERENCES section_offerings(offering_id),
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  ownership_role text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS student_academic_profiles (
  student_id text PRIMARY KEY REFERENCES students(student_id),
  prev_cgpa_scaled integer NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_assets (
  asset_key text PRIMARY KEY,
  payload_json text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_runtime_state (
  state_key text PRIMARY KEY,
  payload_json text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at text NOT NULL
);

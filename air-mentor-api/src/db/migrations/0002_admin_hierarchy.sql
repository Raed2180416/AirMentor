CREATE TABLE IF NOT EXISTS academic_faculties (
  academic_faculty_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(institution_id),
  code text NOT NULL,
  name text NOT NULL,
  overview text,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS academic_faculty_id text REFERENCES academic_faculties(academic_faculty_id);

CREATE TABLE IF NOT EXISTS batches (
  batch_id text PRIMARY KEY,
  branch_id text NOT NULL REFERENCES branches(branch_id),
  admission_year integer NOT NULL,
  batch_label text NOT NULL,
  current_semester integer NOT NULL,
  section_labels_json text NOT NULL DEFAULT '[]',
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

ALTER TABLE academic_terms
  ADD COLUMN IF NOT EXISTS batch_id text REFERENCES batches(batch_id);

CREATE TABLE IF NOT EXISTS curriculum_courses (
  curriculum_course_id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES batches(batch_id),
  semester_number integer NOT NULL,
  course_id text REFERENCES courses(course_id),
  course_code text NOT NULL,
  title text NOT NULL,
  credits integer NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_overrides (
  policy_override_id text PRIMARY KEY,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  policy_json text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_departments_academic_faculty_id
  ON departments(academic_faculty_id);

CREATE INDEX IF NOT EXISTS idx_batches_branch_id
  ON batches(branch_id);

CREATE INDEX IF NOT EXISTS idx_academic_terms_batch_id
  ON academic_terms(batch_id);

CREATE INDEX IF NOT EXISTS idx_curriculum_courses_batch_semester
  ON curriculum_courses(batch_id, semester_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_overrides_scope
  ON policy_overrides(scope_type, scope_id);

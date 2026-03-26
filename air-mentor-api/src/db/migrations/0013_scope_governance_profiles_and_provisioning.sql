CREATE TABLE IF NOT EXISTS stage_policy_overrides (
  stage_policy_override_id text PRIMARY KEY,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  policy_json text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stage_policy_overrides_scope
  ON stage_policy_overrides(scope_type, scope_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS curriculum_feature_profiles (
  curriculum_feature_profile_id text PRIMARY KEY,
  name text NOT NULL,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_curriculum_feature_profiles_scope
  ON curriculum_feature_profiles(scope_type, scope_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS curriculum_feature_profile_courses (
  curriculum_feature_profile_course_id text PRIMARY KEY,
  curriculum_feature_profile_id text NOT NULL REFERENCES curriculum_feature_profiles(curriculum_feature_profile_id),
  course_id text REFERENCES courses(course_id),
  course_code text NOT NULL,
  title text NOT NULL,
  assessment_profile text NOT NULL,
  outcomes_json text NOT NULL,
  prerequisites_json text NOT NULL,
  bridge_modules_json text NOT NULL,
  topic_partitions_json text NOT NULL,
  feature_fingerprint text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_curriculum_feature_profile_courses_profile
  ON curriculum_feature_profile_courses(curriculum_feature_profile_id, status, course_code);

CREATE TABLE IF NOT EXISTS batch_curriculum_feature_bindings (
  batch_id text PRIMARY KEY REFERENCES batches(batch_id),
  curriculum_feature_profile_id text REFERENCES curriculum_feature_profiles(curriculum_feature_profile_id),
  binding_mode text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_curriculum_feature_overrides (
  batch_curriculum_feature_override_id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES batches(batch_id),
  curriculum_course_id text NOT NULL REFERENCES curriculum_courses(curriculum_course_id),
  course_id text REFERENCES courses(course_id),
  course_code text NOT NULL,
  title text NOT NULL,
  override_json text NOT NULL,
  feature_fingerprint text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_curriculum_feature_overrides_batch
  ON batch_curriculum_feature_overrides(batch_id, status, curriculum_course_id);

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS curriculum_feature_profile_id text REFERENCES curriculum_feature_profiles(curriculum_feature_profile_id);

ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS curriculum_feature_profile_fingerprint text;

ALTER TABLE risk_model_artifacts
  ADD COLUMN IF NOT EXISTS curriculum_feature_profile_id text REFERENCES curriculum_feature_profiles(curriculum_feature_profile_id);

ALTER TABLE risk_model_artifacts
  ADD COLUMN IF NOT EXISTS curriculum_feature_profile_fingerprint text;

ALTER TABLE section_offerings
  ADD COLUMN IF NOT EXISTS finals_locked integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS offering_stage_advancement_audits (
  offering_stage_advancement_audit_id text PRIMARY KEY,
  offering_id text NOT NULL REFERENCES section_offerings(offering_id),
  batch_id text REFERENCES batches(batch_id),
  term_id text REFERENCES academic_terms(term_id),
  advanced_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  from_stage_key text NOT NULL,
  to_stage_key text NOT NULL,
  audit_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offering_stage_advancement_audits_offering
  ON offering_stage_advancement_audits(offering_id, created_at DESC);

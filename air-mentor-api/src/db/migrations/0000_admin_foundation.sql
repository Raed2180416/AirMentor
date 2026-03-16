CREATE TABLE IF NOT EXISTS institutions (
  institution_id text PRIMARY KEY,
  name text NOT NULL,
  timezone text NOT NULL,
  academic_year_start_month integer NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  department_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(institution_id),
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  branch_id text PRIMARY KEY,
  department_id text NOT NULL REFERENCES departments(department_id),
  code text NOT NULL,
  name text NOT NULL,
  program_level text NOT NULL,
  semester_count integer NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_terms (
  term_id text PRIMARY KEY,
  branch_id text NOT NULL REFERENCES branches(branch_id),
  academic_year_label text NOT NULL,
  semester_number integer NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS user_accounts (
  user_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(institution_id),
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  phone text,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS user_password_credentials (
  user_id text PRIMARY KEY REFERENCES user_accounts(user_id),
  password_hash text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES user_accounts(user_id),
  active_role_grant_id text,
  expires_at text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  last_seen_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS ui_preferences (
  user_id text PRIMARY KEY REFERENCES user_accounts(user_id),
  theme_mode text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS faculty_profiles (
  faculty_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES user_accounts(user_id),
  employee_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  designation text NOT NULL,
  joined_on text,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS faculty_appointments (
  appointment_id text PRIMARY KEY,
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  department_id text NOT NULL REFERENCES departments(department_id),
  branch_id text REFERENCES branches(branch_id),
  is_primary integer NOT NULL DEFAULT 0,
  start_date text NOT NULL,
  end_date text,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS role_grants (
  grant_id text PRIMARY KEY,
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  role_code text NOT NULL,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  start_date text NOT NULL,
  end_date text,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  student_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(institution_id),
  usn text NOT NULL,
  roll_number text,
  name text NOT NULL,
  email text,
  phone text,
  admission_date text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS student_enrollments (
  enrollment_id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(student_id),
  branch_id text NOT NULL REFERENCES branches(branch_id),
  term_id text NOT NULL REFERENCES academic_terms(term_id),
  section_code text NOT NULL,
  roster_order integer NOT NULL DEFAULT 0,
  academic_status text NOT NULL,
  start_date text NOT NULL,
  end_date text,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS mentor_assignments (
  assignment_id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(student_id),
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  effective_from text NOT NULL,
  effective_to text,
  source text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  course_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(institution_id),
  course_code text NOT NULL UNIQUE,
  title text NOT NULL,
  default_credits integer NOT NULL,
  department_id text NOT NULL REFERENCES departments(department_id),
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_requests (
  admin_request_id text PRIMARY KEY,
  request_type text NOT NULL,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  target_entity_refs_json text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  requested_by_role text NOT NULL,
  requested_by_faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  owned_by_role text NOT NULL,
  owned_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  summary text NOT NULL,
  details text NOT NULL,
  notes_thread_id text NOT NULL,
  due_at text NOT NULL,
  sla_policy_code text NOT NULL,
  decision text,
  payload_json text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_request_notes (
  note_id text PRIMARY KEY,
  admin_request_id text NOT NULL REFERENCES admin_requests(admin_request_id),
  author_role text NOT NULL,
  author_faculty_id text REFERENCES faculty_profiles(faculty_id),
  visibility text NOT NULL,
  note_type text NOT NULL,
  body text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_request_transitions (
  transition_id text PRIMARY KEY,
  admin_request_id text NOT NULL REFERENCES admin_requests(admin_request_id),
  previous_status text,
  next_status text NOT NULL,
  actor_role text NOT NULL,
  actor_faculty_id text REFERENCES faculty_profiles(faculty_id),
  note_id text,
  affected_entity_refs_json text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_event_id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  actor_role text NOT NULL,
  actor_id text,
  before_json text,
  after_json text,
  metadata_json text,
  created_at text NOT NULL
);

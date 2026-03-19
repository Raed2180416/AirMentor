CREATE TABLE IF NOT EXISTS academic_tasks (
  task_id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text NOT NULL REFERENCES section_offerings(offering_id),
  assigned_to_role text NOT NULL,
  task_type text NOT NULL,
  status text NOT NULL,
  title text NOT NULL,
  due_label text NOT NULL,
  due_date_iso text,
  risk_prob_scaled integer NOT NULL,
  risk_band text NOT NULL,
  priority integer NOT NULL,
  payload_json text NOT NULL,
  created_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  updated_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_tasks_offering_role
  ON academic_tasks(offering_id, assigned_to_role, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_academic_tasks_student
  ON academic_tasks(student_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS academic_task_transitions (
  transition_id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES academic_tasks(task_id),
  actor_role text NOT NULL,
  actor_faculty_id text REFERENCES faculty_profiles(faculty_id),
  action text NOT NULL,
  from_owner text,
  to_owner text NOT NULL,
  note text NOT NULL,
  occurred_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_task_transitions_task
  ON academic_task_transitions(task_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS academic_task_placements (
  task_id text PRIMARY KEY REFERENCES academic_tasks(task_id),
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  date_iso text NOT NULL,
  placement_mode text NOT NULL,
  start_minutes integer,
  end_minutes integer,
  slot_id text,
  start_time text,
  end_time text,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_task_placements_faculty_date
  ON academic_task_placements(faculty_id, date_iso, updated_at DESC);

CREATE TABLE IF NOT EXISTS faculty_calendar_workspaces (
  faculty_id text PRIMARY KEY REFERENCES faculty_profiles(faculty_id),
  template_json text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_calendar_audit_events (
  audit_event_id text PRIMARY KEY,
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  payload_json text NOT NULL,
  created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_audit_faculty_created
  ON academic_calendar_audit_events(faculty_id, created_at DESC);

CREATE TABLE IF NOT EXISTS academic_meetings (
  meeting_id text PRIMARY KEY,
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  student_id text NOT NULL REFERENCES students(student_id),
  offering_id text REFERENCES section_offerings(offering_id),
  title text NOT NULL,
  notes text,
  date_iso text NOT NULL,
  start_minutes integer NOT NULL,
  end_minutes integer NOT NULL,
  status text NOT NULL,
  created_by_faculty_id text REFERENCES faculty_profiles(faculty_id),
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_meetings_faculty_date
  ON academic_meetings(faculty_id, date_iso, start_minutes);

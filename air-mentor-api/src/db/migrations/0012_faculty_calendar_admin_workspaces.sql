CREATE TABLE IF NOT EXISTS faculty_calendar_admin_workspaces (
  faculty_id text PRIMARY KEY REFERENCES faculty_profiles(faculty_id),
  workspace_json text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

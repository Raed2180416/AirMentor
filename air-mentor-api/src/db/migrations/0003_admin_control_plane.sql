CREATE TABLE IF NOT EXISTS admin_reminders (
  reminder_id text PRIMARY KEY,
  faculty_id text NOT NULL REFERENCES faculty_profiles(faculty_id),
  title text NOT NULL,
  body text NOT NULL,
  due_at text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_reminders_faculty_due
  ON admin_reminders(faculty_id, due_at);

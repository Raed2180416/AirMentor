-- Split faculty calendar template storage into canonical (admin) and local (teacher) layers.
-- facultyCalendarWorkspaces continues to hold teacher-local merged templates.
-- facultyCalendarCanonicalTemplates holds the sysadmin source-of-truth template.

CREATE TABLE IF NOT EXISTS faculty_calendar_canonical_templates (
  faculty_id TEXT PRIMARY KEY REFERENCES faculty_profiles(faculty_id),
  template_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

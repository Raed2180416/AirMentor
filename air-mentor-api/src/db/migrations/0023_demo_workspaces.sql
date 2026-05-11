CREATE TABLE demo_workspaces (
  demo_workspace_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_faculty_id TEXT,
  batch_id TEXT REFERENCES batches(batch_id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE students ADD COLUMN demo_workspace_id TEXT;
ALTER TABLE student_enrollments ADD COLUMN demo_workspace_id TEXT;
ALTER TABLE mentor_assignments ADD COLUMN demo_workspace_id TEXT;
ALTER TABLE section_offerings ADD COLUMN demo_workspace_id TEXT;
ALTER TABLE faculty_offering_ownerships ADD COLUMN demo_workspace_id TEXT;
ALTER TABLE teacher_allocations ADD COLUMN demo_workspace_id TEXT;
ALTER TABLE simulation_runs ADD COLUMN demo_workspace_id TEXT;

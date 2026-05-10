ALTER TABLE demo_workspaces ADD COLUMN scope_kind TEXT NOT NULL DEFAULT 'row_tag';
ALTER TABLE demo_workspaces ADD COLUMN scope_name TEXT;
ALTER TABLE demo_workspaces ADD COLUMN source_batch_id TEXT REFERENCES batches(batch_id);
ALTER TABLE demo_workspaces ADD COLUMN active_simulation_run_id TEXT;
ALTER TABLE demo_workspaces ADD COLUMN created_by_faculty_id TEXT;
ALTER TABLE demo_workspaces ADD COLUMN stopped_at TEXT;
ALTER TABLE demo_workspaces ADD COLUMN reset_at TEXT;
ALTER TABLE demo_workspaces ADD COLUMN metadata_json TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS demo_workspaces_scope_name_unique ON demo_workspaces(scope_name) WHERE scope_name IS NOT NULL;

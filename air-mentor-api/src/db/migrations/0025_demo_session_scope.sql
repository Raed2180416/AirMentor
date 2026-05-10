ALTER TABLE sessions ADD COLUMN demo_workspace_id TEXT REFERENCES demo_workspaces(demo_workspace_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS sessions_demo_workspace_id_idx ON sessions(demo_workspace_id) WHERE demo_workspace_id IS NOT NULL;

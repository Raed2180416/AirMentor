CREATE TABLE IF NOT EXISTS curriculum_linkage_candidates (
  curriculum_linkage_candidate_id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES batches(batch_id),
  curriculum_course_id text NOT NULL REFERENCES curriculum_courses(curriculum_course_id),
  source_curriculum_course_id text REFERENCES curriculum_courses(curriculum_course_id),
  source_course_id text REFERENCES courses(course_id),
  source_course_code text NOT NULL,
  source_title text NOT NULL,
  target_course_code text NOT NULL,
  target_title text NOT NULL,
  edge_kind text NOT NULL,
  rationale text NOT NULL,
  confidence_scaled integer NOT NULL,
  sources_json text NOT NULL,
  signal_summary_json text NOT NULL,
  status text NOT NULL,
  review_note text,
  version integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_curriculum_linkage_candidates_batch
  ON curriculum_linkage_candidates(batch_id, curriculum_course_id, status, created_at DESC);

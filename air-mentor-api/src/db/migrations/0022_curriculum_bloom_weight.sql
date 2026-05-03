-- P3.1: bloom-level mastery targets on curriculum nodes + edge weights
ALTER TABLE curriculum_nodes ADD COLUMN outcome_bloom_level TEXT;
ALTER TABLE curriculum_nodes ADD COLUMN outcome_mastery_target REAL;
ALTER TABLE curriculum_edges ADD COLUMN weight REAL NOT NULL DEFAULT 1.0;
ALTER TABLE curriculum_edges ADD COLUMN weight_override REAL;
-- added edges carry half the signal weight of explicit edges by default
UPDATE curriculum_edges SET weight = 0.5 WHERE edge_kind = 'added';

CREATE TABLE "curriculum_graph_drafts" (
	"curriculum_graph_draft_id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL REFERENCES "batches"("batch_id"),
	"base_curriculum_import_version_id" text NOT NULL REFERENCES "curriculum_import_versions"("curriculum_import_version_id"),
	"draft_nodes_json" text NOT NULL,
	"draft_edges_json" text NOT NULL,
	"draft_topic_partitions_json" text NOT NULL,
	"draft_bridge_modules_json" text NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "curriculum_graph_history" (
	"curriculum_graph_history_id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL REFERENCES "batches"("batch_id"),
	"curriculum_graph_draft_id" text NOT NULL REFERENCES "curriculum_graph_drafts"("curriculum_graph_draft_id"),
	"command_type" text NOT NULL,
	"command_payload_json" text NOT NULL,
	"reverse_payload_json" text NOT NULL,
	"sequence_number" integer NOT NULL,
	"is_undone" integer NOT NULL DEFAULT 0,
	"actor_faculty_id" text,
	"created_at" text NOT NULL
);

CREATE TABLE "curriculum_graph_suggestions" (
	"curriculum_graph_suggestion_id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL REFERENCES "batches"("batch_id"),
	"curriculum_graph_draft_id" text REFERENCES "curriculum_graph_drafts"("curriculum_graph_draft_id"),
	"target_curriculum_node_id" text,
	"source_curriculum_node_id" text,
	"edge_kind" text NOT NULL,
	"rationale" text NOT NULL,
	"confidence_scaled" real NOT NULL DEFAULT 0.5,
	"sources_json" text NOT NULL,
	"status" text NOT NULL,
	"actor_faculty_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE INDEX "risk_evidence_snapshots_run_idx" ON "risk_evidence_snapshots" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "sim_stage_offering_proj_run_idx" ON "simulation_stage_offering_projections" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "sim_stage_student_proj_run_idx" ON "simulation_stage_student_projections" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "sim_stage_checkpoint_run_idx" ON "simulation_stage_checkpoints" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "sim_stage_queue_proj_run_idx" ON "simulation_stage_queue_projections" USING btree ("simulation_run_id");

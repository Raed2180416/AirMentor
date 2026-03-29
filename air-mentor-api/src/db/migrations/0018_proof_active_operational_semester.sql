ALTER TABLE simulation_runs
ADD COLUMN active_operational_semester integer;

UPDATE simulation_runs
SET active_operational_semester = semester_end
WHERE active_operational_semester IS NULL;

ALTER TABLE simulation_runs
ALTER COLUMN active_operational_semester SET NOT NULL;

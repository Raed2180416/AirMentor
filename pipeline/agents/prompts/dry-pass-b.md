# Dry-run pass B

Runs in parallel with dry-pass-a (same parallel_group). Capacity of the group
is 1 by default, so the scheduler serialises them; remove the group to exercise
true parallelism.

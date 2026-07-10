# Architecture guardrails

Air Mentor is being decomposed incrementally. Preserve working behavior while making the next change easier to locate, test, and review.

## Rules enforced locally

Run `npm run architecture:check` before handing off a refactor.

- A new production TypeScript or TSX file under `src/` may contain at most 400 lines.
- A file listed in `architecture-line-ratchet.json` is legacy work and may only shrink. Its cap is the current measured size, never a target to grow toward.
- When a legacy file falls below 400 lines, remove it from the ratchet in the same change so the normal rule applies.

## Organize by purpose

- Keep policy, form/state transforms, routing/scope transforms, and UI rendering in separate modules.
- Keep React section components focused on a single record family or workspace surface.
- Keep API calls and persistence at adapter edges; extract policy decisions into plain, framework-free helpers that can be unit tested.
- Keep compatibility facades only while callers migrate. Re-export stable public contracts from a focused facade instead of forcing a broad import migration.

## Change checklist

1. Use the repository map and code graph to find callers before moving a public contract.
2. Preserve callbacks, error messages, route shapes, and mutation sequencing.
3. Add or retain a behavioral test at the affected boundary.
4. Run targeted tests, `npm run build`, `npm run architecture:check`, and `npm run agent:map`.

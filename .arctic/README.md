# Arctic Project Config

This project config intentionally limits Arctic discovery to the providers selected for the AirMentor audit environment:

- `codex`
- `google`
- `github-copilot`

Credential state is intentionally not stored in this repo.

Use the slot-aware wrappers in `audit-map/16-scripts/` so each account gets an isolated Arctic state directory under your home directory.

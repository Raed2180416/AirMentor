# Tracked Anomaly Cleanup - 2026-06-06

This note records the rationale for removing the escaped Arctic audit paths that were staged for deletion during the agent-map pass.

## Decision

Remove the 42 tracked paths whose names begin with ANSI-colored `xdg_config_home=` or `xdg_data_home=` fragments.

These files are not product source, not runtime model artifacts, not seeded-demo proof artifacts, and not documentation that future agents should treat as a stable product surface. They are leaked local audit/tool state with malformed path names.

## Evidence

| Check | Result |
| --- | --- |
| Deleted path count | 42 |
| Total bytes in `HEAD` | 59,756 bytes |
| Approximate size | 0.057 MiB |
| File types | 2 `.gitignore`, 22 `.json`, 16 `.log`, 2 migration sentinel paths |
| Product-code match | None |
| Runtime model-contract match | None |
| Recovery path | Git history and the pre-cleanup git bundle archive |

## Example Path Shapes

```text
xdg_config_home='/home/raed/.config/air-mentor-audit/arctic-slots/antigravity-main/config'/arctic/.gitignore
xdg_data_home='/home/raed/.local/share/air-mentor-audit/arctic-slots/antigravity-main/data'/arctic/log/2026-04-18T180934.log
xdg_data_home=/home/raed/.local/share/air-mentor-audit/arctic-slots/codex-01/data/arctic/storage/message/.../msg_*.json
```

## Why This Is Safe

These paths are malformed local-environment spillover, not normal repository content. Keeping them in `main` makes future map generation noisier and forces agents to reason about impossible source paths.

The storage win is tiny, so this is not a disk-space optimization. It is a repository correctness cleanup.

## Future-Agent Instruction

If these files are ever needed for forensic archaeology, recover them from git history or the archived pre-cleanup bundle. Do not recreate these path shapes in the working tree.

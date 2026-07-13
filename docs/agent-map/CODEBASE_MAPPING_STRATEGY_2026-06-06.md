# Agent Codebase Mapping Strategy

**Decision date:** 2026-06-06

## Goal

Build a deterministic, refreshable memory layer that future agents can use before reading raw source. The layer must be useful for line-by-line and block-by-block documentation later, but it must not turn the active repository back into a bulk artifact dump.

## SOTA Scan Summary

- Repomix is good for packing a repository into an AI-friendly file, with git-aware filtering and security checks. Use it only on demand and store outputs outside Git.
- Sourcegraph precise code navigation relies on the open SCIP protocol and CI/build-backed indexes. This is the most credible future path for precise semantic navigation.
- Semgrep is useful for SAST, supply-chain, and secret scanning across TypeScript, JavaScript, Python, SQL-adjacent configs, and more. Use it as a security layer, not as the primary architecture map.
- Recent Codebase-Memory research supports persistent Tree-sitter knowledge graphs over repeated grep-only exploration, but the repo still needs a deterministic local artifact that does not depend on external MCP cache freshness.
- Knip is a strong candidate for JS/TS unused files, exports, and dependency hints. Treat its output as a deletion queue, never as automatic deletion authority.

## Chosen Baseline

The committed baseline is `scripts/generate-agent-repo-map.mjs`. It uses only Node built-ins and Git, so it can run immediately after clone without installing dependencies.

It emits:

- file inventory with hashes and line counts;
- symbol/block spans with start and end lines;
- local import graph edges;
- slash-prefixed API route registrations;
- test case inventory;
- directory and role summaries;
- high fan-in/high fan-out hotspots;
- known MCP freshness caveats.

## Why Not Heavy Comments Yet

Line-by-line comments should come after this map is stable. Commenting first risks baking misunderstandings into source. The correct sequence is map, verify, generate docs, then add comments only where the map and tests show durable behavior.

## Tool Policy

- Prefer repo-owned generated indexes over hidden MCP state.
- Keep generated indexes compact and queryable with `rg` and `jq`.
- Store large one-shot context packs, browser recordings, model runs, and graph databases outside Git.
- When using CTXO, Codegraph, LogicStamp, Repomix, Knip, Semgrep, or SCIP, record freshness, command, output location, and deletion policy.
- Do not delete code based only on static unused-code findings; require product-intent review and test evidence.

## Refresh Command

```bash
npm run agent:map
```

## Source Links

- Repomix guide: https://repomix.com/guide/
- SCIP protocol: https://github.com/sourcegraph/scip
- Semgrep docs: https://docs.semgrep.dev/
- Codebase-Memory paper: https://arxiv.org/abs/2603.27277
- Knip docs: https://knip.dev/
- Tree-sitter parse CLI: https://tree-sitter.github.io/tree-sitter/cli/parse.html
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser

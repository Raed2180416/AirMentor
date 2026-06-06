#!/bin/bash
set -euo pipefail
cd /home/raed/Projects/air-mentor-ui
PASSED=0; FAILED=0
test_fn() { local n="$1"; local c="$2"; echo -n "Testing $n... "; if eval "$c" >/dev/null 2>&1; then echo "PASS"; ((PASSED++)); else echo "FAIL"; ((FAILED++)); fi; }
echo "=== AirMentor Agentic OS Integration Test v3 ==="
# Layer 1
test_fn "Live watcher" "systemctl --user is-active airmentor-live-watcher"
test_fn "Deterministic index" "test -f .audit/deterministic-index/knowledge-graph.json"
# Layer 2
test_fn "Prompt compressor" "test -x scripts/prompt-compressor.mjs"
test_fn "CoT templates" "test -f scripts/cot-prompt-templates.md"
test_fn "Self-consistency voter" "test -x scripts/self-consistency-voter.mjs"
test_fn "Reflection loop" "test -x scripts/reflection-loop.sh"
test_fn "Ollama ephemeral" "test -x scripts/ollama-ephemeral-orchestrator.sh"
test_fn "Ollama config" "test -f scripts/ollama-quality.conf"
# Layer 3
test_fn "Circuit breaker" "test -x scripts/circuit-breaker.mjs"
test_fn "Semantic cache" "test -x scripts/semantic-cache.mjs"
test_fn "MCP pruner" "test -x scripts/mcp-tool-pruner.mjs"
test_fn "Daily auditor" "test -x scripts/daily-auditor.mjs"
# Layer 4
test_fn "Subagent orchestrator" "test -x scripts/subagent-orchestrator.mjs"
# Layer 5 NEW
test_fn "Task heartbeat" "test -x scripts/task-heartbeat.mjs"
test_fn "Skills registry" "test -x scripts/skills-registry.mjs"
test_fn "Agent memory" "test -x scripts/agent-memory.mjs"
test_fn "Auto code review" "test -x scripts/auto-code-review.mjs"
# Layer 6 NEW
test_fn "Model handoff" "test -x scripts/model-handoff.mjs"
test_fn "Durable checkpoint" "test -x scripts/durable-checkpoint.mjs"
test_fn "Mixture of agents" "test -x scripts/mixture-of-agents.mjs"
# Layer 7
test_fn "Quality benchmark" "test -x scripts/quality-benchmark.mjs"
# Layer 8
test_fn "Quality doc" "test -f docs/QUALITY_ENHANCEMENT_SUITE.md"
test_fn "API pool doc" "test -f docs/agent-map/API_POOL_WITH_AWS_AZURE.md"
echo ""
echo "Passed: $PASSED / Failed: $FAILED"
[ $FAILED -eq 0 ] && { echo "All 25 components operational."; exit 0; } || { echo "Some need setup."; exit 1; }

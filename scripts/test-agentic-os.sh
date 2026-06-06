#!/bin/bash
# AirMentor Agentic OS Integration Test v2
# Verifies all components are installed and functional

set -euo pipefail

cd /home/raed/Projects/air-mentor-ui
REPO_ROOT="$(pwd)"
PASSED=0
FAILED=0

test_fn() {
  local name="$1"
  local cmd="$2"
  echo -n "Testing $name... "
  if eval "$cmd" >/dev/null 2>&1; then
    echo "PASS"
    ((PASSED++)) || true
  else
    echo "FAIL"
    ((FAILED++)) || true
  fi
}

echo "=== AirMentor Agentic OS Integration Test v2 ==="
echo ""

# Layer 1: Deterministic Codebase Intelligence
test_fn "Live watcher service" "systemctl --user is-active airmentor-live-watcher"
test_fn "Deterministic index" "test -f .audit/deterministic-index/knowledge-graph.json"
test_fn "LLM navigation guide" "test -f .audit/deterministic-index/LLM_NAVIGATION_GUIDE.md"
test_fn "Watcher status JSON" "test -f .audit/watcher-status.json"

# Layer 2: Quality Multipliers
test_fn "Prompt compressor" "test -x scripts/prompt-compressor.mjs"
test_fn "CoT templates" "test -f scripts/cot-prompt-templates.md"
test_fn "Self-consistency voter" "test -x scripts/self-consistency-voter.mjs"
test_fn "Reflection loop" "test -x scripts/reflection-loop.sh"
test_fn "Ollama ephemeral orchestrator" "test -x scripts/ollama-ephemeral-orchestrator.sh"
test_fn "Ollama quality config" "test -f scripts/ollama-quality.conf"

# Layer 3: Token Efficiency
test_fn "Circuit breaker" "test -x scripts/circuit-breaker.mjs"
test_fn "Semantic cache" "test -x scripts/semantic-cache.mjs"
test_fn "MCP tool pruner" "test -x scripts/mcp-tool-pruner.mjs"
test_fn "Daily auditor" "test -x scripts/daily-auditor.mjs"

# Layer 4: Multi-Agent
test_fn "Subagent orchestrator" "test -x scripts/subagent-orchestrator.mjs"

# Layer 5: NEW - Task Heartbeat Monitor
test_fn "Task heartbeat" "test -x scripts/task-heartbeat.mjs"

# Layer 6: NEW - Skills Registry
test_fn "Skills registry" "test -x scripts/skills-registry.mjs"

# Layer 7: NEW - Agent Memory
test_fn "Agent memory" "test -x scripts/agent-memory.mjs"

# Layer 8: NEW - Auto Code Review
test_fn "Auto code review" "test -x scripts/auto-code-review.mjs"

# Layer 9: Quality Measurement
test_fn "Quality benchmark" "test -x scripts/quality-benchmark.mjs"

# Layer 10: Documentation
test_fn "Quality enhancement doc" "test -f docs/QUALITY_ENHANCEMENT_SUITE.md"
test_fn "API pool doc" "test -f docs/agent-map/API_POOL_WITH_AWS_AZURE.md"

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
  echo ""
  echo "All components operational. Agentic OS is ready."
  exit 0
else
  echo ""
  echo "Some components need setup. Run ./scripts/setup-live-watcher.sh if watcher is not active."
  exit 1
fi

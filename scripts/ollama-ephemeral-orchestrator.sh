#!/bin/bash
# Ollama Ephemeral Orchestrator
# Loads a tiny model, routes a task, immediately unloads.
# NEVER keeps models in VRAM. Designed for RTX 4060 (8GB).
# Usage: ./scripts/ollama-ephemeral-orchestrator.sh <task_json_file>

set -euo pipefail

MODEL="qwen3:4b"  # 3-4GB VRAM, loads in ~3s, good enough for routing decisions
TASK_FILE="${1:-/dev/stdin}"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

# Ensure Ollama is running
if ! curl -sf "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
  echo '{"error": "Ollama not running. Start it with: ollama serve"}' >&2
  exit 1
fi

# Pull model if not present (only once)
if ! curl -sf "$OLLAMA_HOST/api/tags" | grep -q "$MODEL"; then
  echo "Pulling $MODEL (one-time)..." >&2
  ollama pull "$MODEL"
fi

# Load model, run task, immediately unload
echo "Loading $MODEL..." >&2
# Send a dummy request to load it into VRAM
curl -sf "$OLLAMA_HOST/api/generate" \
  -d "{\"model\":\"$MODEL\",\"prompt\":\"hi\",\"stream\":false,\"keep_alive\":0}" > /dev/null 2>&1 || true

# Read task
task=$(cat "$TASK_FILE")

# Run actual task with keep_alive=0 (unload immediately after)
response=$(curl -sf "$OLLAMA_HOST/api/generate" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL\",\"prompt\":$task,\"stream\":false,\"keep_alive\":0,\"options\":{\"num_ctx\":8192}}")

# Explicitly unload
curl -sf "$OLLAMA_HOST/api/generate" \
  -d "{\"model\":\"$MODEL\",\"prompt\":\"\",\"stream\":false,\"keep_alive\":0}" > /dev/null 2>&1 || true

echo "$response"

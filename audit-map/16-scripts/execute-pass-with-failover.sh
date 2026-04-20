#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_audit-common.sh"

usage() {
  cat >&2 <<'EOF'
Usage: execute-pass-with-failover.sh
  --pass <name>
  --context <context>
  --prompt-bundle <file>
  --last-message-file <file>
  --provider <native-codex|anthropic|antigravity|codex|google|github-copilot>
  --account <account>
  [--slot <slot>]
  --model <slug>
  --reasoning-effort <low|medium|high|xhigh>
  [--search 0|1]
  [--provider-mode <native-only|auto>]
  [--require-provider <provider>]
  [--wait-timeout-seconds <n>]
  [--wait-poll-seconds <n>]
  [--max-attempts <n>]  # use 0 for unlimited attempts
  [--status-file <file>]
  [--checkpoint-file <file>]
EOF
  exit 64
}

pass_name=""
context="local"
prompt_bundle=""
last_message_file=""
current_provider=""
current_account=""
current_slot=""
current_model=""
reasoning_effort="high"
enable_web_search="0"
provider_mode="auto"
require_provider=""
wait_timeout_seconds="1800"
wait_poll_seconds="60"
max_attempts="${AUDIT_MAX_ROUTE_ATTEMPTS:-0}"
status_file=""
checkpoint_file=""
provider_admission_policy=""
attempt_idle_timeout_seconds="${AUDIT_ATTEMPT_IDLE_TIMEOUT_SECONDS:-1200}"
attempt_monitor_poll_seconds="${AUDIT_ATTEMPT_MONITOR_POLL_SECONDS:-30}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --pass) pass_name="${2:-}"; shift 2 ;;
    --context) context="${2:-}"; shift 2 ;;
    --prompt-bundle) prompt_bundle="${2:-}"; shift 2 ;;
    --last-message-file) last_message_file="${2:-}"; shift 2 ;;
    --provider) current_provider="${2:-}"; shift 2 ;;
    --account) current_account="${2:-}"; shift 2 ;;
    --slot) current_slot="${2:-}"; shift 2 ;;
    --model) current_model="${2:-}"; shift 2 ;;
    --reasoning-effort) reasoning_effort="${2:-}"; shift 2 ;;
    --search) enable_web_search="${2:-0}"; shift 2 ;;
    --provider-mode) provider_mode="${2:-auto}"; shift 2 ;;
    --require-provider) require_provider="${2:-}"; shift 2 ;;
    --wait-timeout-seconds) wait_timeout_seconds="${2:-1800}"; shift 2 ;;
    --wait-poll-seconds) wait_poll_seconds="${2:-60}"; shift 2 ;;
    --max-attempts) max_attempts="${2:-4}"; shift 2 ;;
    --status-file) status_file="${2:-}"; shift 2 ;;
    --checkpoint-file) checkpoint_file="${2:-}"; shift 2 ;;
    --help|-h) usage ;;
    *) usage ;;
  esac
done

[ -n "$pass_name" ] || usage
[ -n "$prompt_bundle" ] || usage
[ -n "$last_message_file" ] || usage
[ -n "$current_provider" ] || usage
[ -n "$current_account" ] || usage
[ -n "$current_model" ] || usage
[ -f "$prompt_bundle" ] || { echo "Prompt bundle not found: $prompt_bundle" >&2; exit 66; }

session_name="$(session_name_for "$context" "$pass_name")"
eval "$("$SCRIPT_DIR/task-classify-route.sh" "$pass_name")"
provider_admission_policy="${provider_admission_policy:-native-first}"

strip_ansi() {
  sed -E 's/\x1B\[[0-9;]*[[:alpha:]]//g'
}

failure_class_for_log() {
  local file="$1"
  local text=""
  text="$(strip_ansi <"$file" | tr -d '\r')"
  if printf '%s\n' "$text" | grep -Eqi 'supervisor=idle-timeout|stalled-no-progress|no-progress timeout'; then
    printf 'stalled-no-progress'
  elif printf '%s\n' "$text" | grep -Eqi 'ProviderModelNotFoundError|Requested model .* is not compatible with provider|Unknown required provider|unexpected argument|Usage: codex exec'; then
    printf 'route-misconfiguration'
  elif printf '%s\n' "$text" | grep -Eqi '401 Unauthorized|authentication failed|not logged in|login required|invalid.*token|unauthorized'; then
    printf 'auth-or-entitlement'
  elif printf '%s\n' "$text" | grep -Eqi '429|rate limit|quota|usage limit|capacity|too many requests'; then
    printf 'quota-or-rate-limit'
  elif printf '%s\n' "$text" | grep -Eqi 'timed out|timeout|temporarily unavailable|connection reset|network error|transport error|websocket.*failed|upstream'; then
    printf 'transient-provider-failure'
  else
    printf 'unknown'
  fi
}

failure_is_recoverable() {
  case "${1:-unknown}" in
    auth-or-entitlement|quota-or-rate-limit|transient-provider-failure|stalled-no-progress) return 0 ;;
    *) return 1 ;;
  esac
}

file_activity_signature() {
  local path="${1:-}"
  [ -n "$path" ] || return 1
  [ -e "$path" ] || return 1
  stat -Lc '%Y:%s' "$path" 2>/dev/null || return 1
}

update_supervisor_metadata() {
  local state="${1:-watching}"
  local detail="${2:-}"
  [ -n "$status_file" ] || return 0
  touch "$status_file"
  upsert_env "$status_file" execution_supervisor_state "$state"
  [ -n "$detail" ] && upsert_env "$status_file" execution_supervisor_detail "$detail"
  upsert_env "$status_file" execution_supervisor_updated_at "$(timestamp_utc)"
}

update_route_metadata() {
  [ -n "$status_file" ] || return 0
  touch "$status_file"
  upsert_env "$status_file" provider "$current_provider"
  upsert_env "$status_file" account "$current_account"
  upsert_env "$status_file" model "$current_model"
  upsert_env "$status_file" route_attempt "$attempt"
  upsert_env "$status_file" route_provider_mode "$provider_mode"
  upsert_env "$status_file" route_selected_slot "${current_slot:-}"
  upsert_env "$status_file" route_selected_account "$current_account"
  upsert_env "$status_file" route_last_changed_at "$(timestamp_utc)"
  upsert_env "$status_file" updated_at "$(timestamp_utc)"
  if [ -n "$checkpoint_file" ]; then
    touch "$checkpoint_file"
    upsert_env "$checkpoint_file" current_provider "$current_provider"
    upsert_env "$checkpoint_file" current_account "$current_account"
    upsert_env "$checkpoint_file" current_model "$current_model"
    upsert_env "$checkpoint_file" current_slot "${current_slot:-}"
    upsert_env "$checkpoint_file" route_attempt "$attempt"
    upsert_env "$checkpoint_file" last_checkpoint_at "$(timestamp_utc)"
  fi
}

run_current_route() {
  local attempt_log="$1"
  local rc="0"
  local model_ref=""
  local cmd_pid=""
  local now_epoch=""
  local last_progress_epoch=""
  local attempt_log_sig=""
  local last_message_sig=""
  local new_sig=""
  local progress_source=""
  printf '[%s] execution-attempt=%s provider=%s slot=%s account=%s model=%s\n' \
    "$(timestamp_utc)" \
    "$attempt" \
    "$current_provider" \
    "${current_slot:-native}" \
    "$current_account" \
    "$current_model"

  : >"$attempt_log"

  if [ "$current_provider" = "native-codex" ]; then
    local -a codex_args
    codex_args=(codex exec -C "$AUDIT_REPO_ROOT" -m "$current_model" -c "model_reasoning_effort=\"$reasoning_effort\"" -o "$last_message_file" --full-auto)
    set +e
    "${codex_args[@]}" - <"$prompt_bundle" > >(tee "$attempt_log") 2>&1 &
    cmd_pid="$!"
    set -e
  else
    model_ref="$(provider_model_ref "$current_provider" "$current_model")"
    set +e
    bash "$SCRIPT_DIR/arctic-session-wrapper.sh" --slot "$current_slot" --model "$model_ref" --message-file "$prompt_bundle" > >(tee "$attempt_log") 2>&1 &
    cmd_pid="$!"
    set -e
  fi

  update_supervisor_metadata "watching" "Monitoring pid=$cmd_pid with idle-timeout=${attempt_idle_timeout_seconds}s."
  [ -n "$status_file" ] && upsert_env "$status_file" execution_supervisor_pid "$cmd_pid"
  [ -n "$checkpoint_file" ] && upsert_env "$checkpoint_file" execution_supervisor_pid "$cmd_pid"

  attempt_log_sig="$(file_activity_signature "$attempt_log" 2>/dev/null || true)"
  last_message_sig="$(file_activity_signature "$last_message_file" 2>/dev/null || true)"
  last_progress_epoch="$(date +%s)"

  while kill -0 "$cmd_pid" 2>/dev/null; do
    sleep "$attempt_monitor_poll_seconds"
    progress_source=""

    new_sig="$(file_activity_signature "$attempt_log" 2>/dev/null || true)"
    if [ -n "$new_sig" ] && [ "$new_sig" != "$attempt_log_sig" ]; then
      attempt_log_sig="$new_sig"
      progress_source="attempt-log"
    fi

    new_sig="$(file_activity_signature "$last_message_file" 2>/dev/null || true)"
    if [ -n "$new_sig" ] && [ "$new_sig" != "$last_message_sig" ]; then
      last_message_sig="$new_sig"
      progress_source="${progress_source:+$progress_source,}last-message"
    fi

    if [ -n "$progress_source" ]; then
      last_progress_epoch="$(date +%s)"
      update_supervisor_metadata "watching" "Latest progress source: $progress_source."
      [ -n "$status_file" ] && upsert_env "$status_file" last_execution_progress_at "$(timestamp_utc)"
      [ -n "$status_file" ] && upsert_env "$status_file" last_execution_progress_source "$progress_source"
      continue
    fi

    if [ "${attempt_idle_timeout_seconds:-0}" -le 0 ]; then
      continue
    fi

    now_epoch="$(date +%s)"
    if [ $(( now_epoch - last_progress_epoch )) -lt "$attempt_idle_timeout_seconds" ]; then
      continue
    fi

    printf '[%s] supervisor=idle-timeout provider=%s slot=%s model=%s pid=%s idle_seconds=%s\n' \
      "$(timestamp_utc)" \
      "$current_provider" \
      "${current_slot:-native}" \
      "$current_model" \
      "$cmd_pid" \
      "$attempt_idle_timeout_seconds" | tee -a "$attempt_log"
    update_supervisor_metadata "idle-timeout" "No progress signal observed for ${attempt_idle_timeout_seconds}s; terminating stuck attempt."
    [ -n "$checkpoint_file" ] && upsert_env "$checkpoint_file" last_event "idle-timeout"
    [ -n "$checkpoint_file" ] && upsert_env "$checkpoint_file" stop_reason "No progress signal observed for ${attempt_idle_timeout_seconds}s."
    kill_process_tree "$cmd_pid" TERM
    sleep 2
    kill_process_tree "$cmd_pid" KILL
    set +e
    wait "$cmd_pid"
    set -e
    return 124
  done

  set +e
  wait "$cmd_pid"
  rc="$?"
  set -e
  update_supervisor_metadata "completed" "Attempt process exited with code=$rc."
  return "$rc"
}

validate_required_artifacts() {
  local rc="0"
  set +e
  bash "$SCRIPT_DIR/validate-pass-artifacts.sh" "$pass_name"
  rc="$?"
  set -e
  return "$rc"
}

recover_next_route() {
  local failure_class="$1"
  local rotation_output=""
  local rotation_rc="0"
  local wait_output=""
  local wait_rc="0"
  local from_provider="$current_provider"
  local from_slot="$current_slot"
  local from_account="$current_account"

  if [ "$provider_mode" != "auto" ] || [ "$provider_admission_policy" = "native-only" ] || [ "$require_provider" = "native-codex" ]; then
    printf '[%s] route-recovery=wait-same-provider failure_class=%s provider=%s\n' "$(timestamp_utc)" "$failure_class" "$current_provider"
    sleep "$wait_poll_seconds"
    return 0
  fi

  set +e
  if [ -n "$current_slot" ]; then
    rotation_output="$(bash "$SCRIPT_DIR/rotate-provider-or-stop.sh" --pass "$pass_name" --reason "Runtime failure class=$failure_class" --from-provider "$current_provider" --from-slot "$current_slot" 2>&1)"
  else
    rotation_output="$(bash "$SCRIPT_DIR/rotate-provider-or-stop.sh" --pass "$pass_name" --reason "Runtime failure class=$failure_class" --from-provider "$current_provider" 2>&1)"
  fi
  rotation_rc="$?"
  set -e

  if [ "$rotation_rc" -eq 0 ]; then
    eval "$rotation_output"
    current_provider="${selected_provider:-$current_provider}"
    current_slot="${selected_slot:-}"
    current_account="${selected_account:-$current_account}"
    current_model="${selected_model:-$current_model}"
    if [ -n "${current_slot:-}" ]; then
      write_rotation_cursor "$current_provider" "$current_slot" || true
      write_rotation_cursor "alternate-global" "$current_slot" || true
      mark_slot_route_selected "$current_slot" "$pass_name" "$current_provider" "$current_account" "$current_model" || true
    fi
    append_switch_history \
      "${from_provider}:${from_slot:-$from_account}" \
      "${selected_provider:-$current_provider}:${selected_slot:-${current_slot:-native}}" \
      "Runtime recovery after $failure_class in pass '$pass_name'." \
      "Retried"
    return 0
  fi

  set +e
  wait_args=(bash "$SCRIPT_DIR/wait-for-provider-readiness.sh" "$pass_name" --requested-model "$current_model" --timeout-seconds "$wait_timeout_seconds" --poll-seconds "$wait_poll_seconds")
  if [ -n "$require_provider" ]; then
    wait_args+=(--require-provider "$require_provider")
    [ -n "$current_slot" ] && wait_args+=(--exclude-slot "$current_slot")
  elif [ -n "$current_slot" ]; then
    wait_args+=(--exclude-slot "$current_slot")
  else
    wait_args+=(--exclude-provider "$current_provider")
  fi
  wait_output="$("${wait_args[@]}" 2>&1)"
  wait_rc="$?"
  set -e

  if [ "$wait_rc" -eq 0 ]; then
    eval "$wait_output"
    current_provider="${selected_provider:-$current_provider}"
    current_slot="${selected_slot:-}"
    current_account="${selected_account:-$current_account}"
    current_model="${selected_model:-$current_model}"
    if [ -n "${current_slot:-}" ]; then
      write_rotation_cursor "$current_provider" "$current_slot" || true
      write_rotation_cursor "alternate-global" "$current_slot" || true
      mark_slot_route_selected "$current_slot" "$pass_name" "$current_provider" "$current_account" "$current_model" || true
    fi
    return 0
  fi

  if [ -n "$status_file" ]; then
    upsert_env "$status_file" execution_last_error_summary "$(printf '%s' "$wait_output" | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-220)"
    upsert_env "$status_file" updated_at "$(timestamp_utc)"
  fi
  return 1
}

attempt="0"
while [ "${max_attempts:-0}" -le 0 ] || [ "$attempt" -lt "$max_attempts" ]; do
  attempt="$((attempt + 1))"
  update_route_metadata
  attempt_log="$(mktemp "$AUDIT_LOG_ROOT/${session_name}.attempt-${attempt}.XXXXXX.log")"
  if run_current_route "$attempt_log"; then
    if ! validate_required_artifacts >>"$attempt_log" 2>&1; then
      failure_class="missing-required-artifacts"
      printf '[%s] execution-failure-class=%s provider=%s slot=%s model=%s attempt=%s log=%s\n' \
        "$(timestamp_utc)" \
        "$failure_class" \
        "$current_provider" \
        "${current_slot:-native}" \
        "$current_model" \
        "$attempt" \
        "$attempt_log"
      if [ -n "$status_file" ]; then
        upsert_env "$status_file" last_execution_failure_class "$failure_class"
        upsert_env "$status_file" last_execution_failure_log "$attempt_log"
        upsert_env "$status_file" updated_at "$(timestamp_utc)"
      fi
      if [ -n "$checkpoint_file" ]; then
        upsert_env "$checkpoint_file" last_event "runtime-failure"
        upsert_env "$checkpoint_file" runtime_failure_class "$failure_class"
        upsert_env "$checkpoint_file" runtime_failure_log "$attempt_log"
        upsert_env "$checkpoint_file" last_checkpoint_at "$(timestamp_utc)"
      fi
      break
    fi
    if [ -n "$status_file" ]; then
      upsert_env "$status_file" last_execution_failure_class ""
      upsert_env "$status_file" state "completed"
      upsert_env "$status_file" execution_supervisor_pid ""
      upsert_env "$status_file" updated_at "$(timestamp_utc)"
    fi
    if [ -n "$checkpoint_file" ]; then
      upsert_env "$checkpoint_file" last_event "completed"
      upsert_env "$checkpoint_file" execution_supervisor_pid ""
      upsert_env "$checkpoint_file" last_checkpoint_at "$(timestamp_utc)"
    fi
    exit 0
  fi

  failure_class="$(failure_class_for_log "$attempt_log")"
  printf '[%s] execution-failure-class=%s provider=%s slot=%s model=%s attempt=%s log=%s\n' \
    "$(timestamp_utc)" \
    "$failure_class" \
    "$current_provider" \
    "${current_slot:-native}" \
    "$current_model" \
    "$attempt" \
    "$attempt_log"

  if [ -n "$status_file" ]; then
    upsert_env "$status_file" last_execution_failure_class "$failure_class"
    upsert_env "$status_file" last_execution_failure_log "$attempt_log"
    upsert_env "$status_file" updated_at "$(timestamp_utc)"
  fi
  if [ -n "$checkpoint_file" ]; then
    upsert_env "$checkpoint_file" last_event "runtime-failure"
    upsert_env "$checkpoint_file" runtime_failure_class "$failure_class"
    upsert_env "$checkpoint_file" runtime_failure_log "$attempt_log"
    upsert_env "$checkpoint_file" last_checkpoint_at "$(timestamp_utc)"
  fi

  if ! failure_is_recoverable "$failure_class"; then
    break
  fi

  if ! recover_next_route "$failure_class"; then
    break
  fi
done

record_manual_action \
  "Execution recovery failed" \
  "Pass '$pass_name' exhausted automatic recovery after provider='${current_provider}' slot='${current_slot:-native}' model='${current_model}'. Inspect the latest attempt log under $AUDIT_LOG_ROOT and resume with 'bash audit-map/16-scripts/recover-from-failure.sh $pass_name $context resume'."
if [ -n "$status_file" ]; then
  upsert_env "$status_file" state "stopped"
  upsert_env "$status_file" execution_supervisor_state "completed"
  upsert_env "$status_file" execution_supervisor_detail "Recovery exhausted; no runnable route succeeded in this cycle."
  upsert_env "$status_file" execution_supervisor_pid ""
  upsert_env "$status_file" updated_at "$(timestamp_utc)"
fi
if [ -n "$checkpoint_file" ]; then
  upsert_env "$checkpoint_file" execution_supervisor_pid ""
  upsert_env "$checkpoint_file" last_checkpoint_at "$(timestamp_utc)"
fi
exit 75

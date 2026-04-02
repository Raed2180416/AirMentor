#!/usr/bin/env bash

resolve_playwright_browsers_path() {
  if [[ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]]; then
    printf '%s\n' "$PLAYWRIGHT_BROWSERS_PATH"
    return 0
  fi

  local nix_browsers_path=""
  if compgen -G '/nix/store/*playwright-browsers' >/dev/null 2>&1; then
    nix_browsers_path="$(ls -d /nix/store/*playwright-browsers 2>/dev/null | LC_ALL=C sort | head -n 1)"
  fi
  if [[ -n "$nix_browsers_path" ]]; then
    printf '%s\n' "$nix_browsers_path"
    return 0
  fi

  local default_cache_path="${HOME:-}/.cache/ms-playwright"
  if [[ -d "$default_cache_path" ]]; then
    printf '%s\n' "$default_cache_path"
    return 0
  fi

  return 1
}

#!/usr/bin/env bash

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

print_size() {
  local path="$1"
  if [[ -e "$path" ]]; then
    du -sh -- "$path"
  fi
}

echo "== Filesystem =="
df -h "$repo_root"

echo
echo "== Major reclaim candidates =="
for path in \
  air-mentor-api/tmp \
  air-mentor-api/output/test-tmp \
  air-mentor-api/.venv \
  air-mentor-api/.tabpfn-venv \
  .venv \
  output/playwright \
  node_modules \
  air-mentor-api/tmp_db \
  air-mentor-api/.eval-db-coverage24 \
  air-mentor-api/output/proof-risk-model/_archive \
  .git
do
  print_size "$path"
done | sort -h

echo
echo "== Git object database =="
git count-objects -vH

echo
echo "== Git temporary garbage =="
find .git/objects -type f -name 'tmp_*' -printf '%s\n' \
  | awk '{ total += $1 } END { print total + 0 }' \
  | numfmt --to=iec-i --suffix=B

echo
echo "== Tracked generated payloads =="
for path in \
  air-mentor-api/.eval-db-coverage24 \
  student_risk_trajectories.csv \
  repomix-output.xml \
  repomix-src-output.xml \
  all_microdata_dump.json \
  detailed_cohort_analysis.json \
  deep_cohort_analysis.json
do
  count="$(git ls-files "$path" "$path/**" | wc -l)"
  bytes="$(
    git ls-files -z "$path" "$path/**" \
      | xargs -0 -r stat -c '%s' 2>/dev/null \
      | awk '{ total += $1 } END { print total + 0 }'
  )"
  printf '%s\t%s files\t%s\n' "$(numfmt --to=iec-i --suffix=B "$bytes")" "$count" "$path"
done | sort -h

echo
echo "== Runtime model vault candidates =="
model_root="air-mentor-api/output/proof-risk-model"
runtime_patterns=(
  'risk-model-bundle*.json'
  'promotion-decision.json'
  'catboost_*_v1.json'
  'v3_*'
  'xgboost_v3_*'
  'metrics.json'
  'evaluation-report.json'
  'evaluation-report.md'
  'meta.txt'
)

missing=0
for required in \
  "$model_root/risk-model-bundle.json" \
  "$model_root/promotion-decision.json" \
  "$model_root/catboost_attendanceRisk_v1.json" \
  "$model_root/catboost_ceRisk_v1.json" \
  "$model_root/catboost_seeRisk_v1.json" \
  "$model_root/catboost_overallCourseRisk_v1.json" \
  "$model_root/catboost_downstreamCarryoverRisk_v1.json"
do
  if [[ ! -f "$required" ]]; then
    echo "MISSING $required"
    missing=1
  fi
done

for pattern in "${runtime_patterns[@]}"; do
  find "$model_root" -maxdepth 1 -type f -name "$pattern" -print
done | sort -u | while IFS= read -r artifact; do
  sha256sum "$artifact"
done

if [[ "$missing" -ne 0 ]]; then
  echo "Runtime model vault is incomplete." >&2
  exit 1
fi

echo
echo "== Local branch divergence from current branch =="
current_branch="$(git branch --show-current)"
while IFS= read -r branch; do
  [[ "$branch" == "$current_branch" ]] && continue
  ahead="$(git rev-list --count "$current_branch..$branch")"
  behind="$(git rev-list --count "$branch..$current_branch")"
  disk_bytes="$(
    git rev-list --disk-usage --objects "$branch" --not "$current_branch" 2>/dev/null \
      | cut -d= -f2
  )"
  printf '%s\tahead=%s\tbehind=%s\tunique=%s\n' \
    "$branch" \
    "$ahead" \
    "$behind" \
    "$(numfmt --to=iec-i --suffix=B "${disk_bytes:-0}")"
done < <(git for-each-ref --format='%(refname:short)' refs/heads) | sort

echo
echo "== Stale embedded PostgreSQL directories =="
while IFS= read -r pid_file; do
  pid="$(sed -n '1p' "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    state="LIVE"
  else
    state="STALE"
  fi
  printf '%s\tpid=%s\t%s\n' "$state" "$pid" "$pid_file"
done < <(
  find \
    air-mentor-api/tmp \
    air-mentor-api/tmp_db \
    air-mentor-api/.eval-db-coverage24 \
    air-mentor-api/output/test-tmp \
    -name postmaster.pid \
    -type f \
    2>/dev/null \
    | sort
)

echo
echo "Audit only: no files or refs were changed."

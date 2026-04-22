"""Slot ledger synchroniser.

Source of truth for slot state = `audit-map/16-scripts/arctic-slot-status.sh`
which emits a TSV over every known slot, cross-checked against
`slot-map.tsv` + `audit-map/29-status/*` verification snapshots.

We run that script, parse its TSV, and upsert the rows into the SQLite
`slots` table. Everything downstream (router, claim_next_ready,
dashboard) reads from the DB; no one re-parses the TSV.

We also inject a `local-dry-run` virtual slot and an `openrouter-free`
virtual slot so tests and free-tier fallback work without any auth.

Expected TSV columns (from arctic-slot-status.sh header):
    slot  provider  auth_source_key  account_label  entered_account_label
    label_policy_state  state  preferred_model  execution_model
    execution_verification_state  execution_route_state
    execution_last_probe_failure_class  usage_access
    primary_remaining_pct  primary_reset_at
    secondary_remaining_pct  secondary_reset_at
    cooldown_state  cooldown_next_eligible_at  xdg_data_home  snapshot
"""
from __future__ import annotations

import datetime as dt
import os
import subprocess
from pathlib import Path
from typing import Iterable

from . import db

REPO_ROOT = Path(__file__).resolve().parents[2]
STATUS_SCRIPT = REPO_ROOT / "audit-map" / "16-scripts" / "arctic-slot-status.sh"


# ---------- helpers ----------

def _iso_or_none(val: str) -> str | None:
    val = (val or "").strip()
    if not val or val == "-":
        return None
    return val


def _float_or_none(val: str) -> float | None:
    val = (val or "").strip()
    if not val or val == "-":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def _bool_from_state(state: str) -> int:
    return 1 if state.lower() in {"verified", "authenticated"} else 0


def _ready_from_states(route_state: str, cooldown_state: str, usage: float | None) -> int:
    if cooldown_state.lower() == "cooling-down":
        return 0
    if route_state.lower() not in {"verified", "ready", ""}:
        # empty route_state is tolerated (some slots haven't been probed
        # recently but still function)
        return 0
    if usage is not None and usage <= 0.5:
        return 0
    return 1


def _run_status_script() -> str:
    if not STATUS_SCRIPT.is_file():
        return ""
    try:
        out = subprocess.check_output(
            ["bash", str(STATUS_SCRIPT)],
            stderr=subprocess.DEVNULL,
            timeout=30,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return ""
    return out.decode("utf-8", errors="replace")


def _parse_tsv(text: str) -> Iterable[dict]:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return
    header = lines[0].split("\t")
    for raw in lines[1:]:
        cells = raw.split("\t")
        while len(cells) < len(header):
            cells.append("")
        yield dict(zip(header, cells))


# ---------- public ----------

def sync_once() -> dict:
    """Run the status script, upsert rows, return a tiny summary."""
    text = _run_status_script()
    seen = 0
    ready = 0
    cooling = 0
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    for row in _parse_tsv(text):
        slot = (row.get("slot") or "").strip()
        if not slot:
            continue
        provider = (row.get("provider") or "").strip() or "unknown"
        account = (row.get("entered_account_label") or row.get("account_label") or "").strip() or None
        account_key = (row.get("auth_source_key") or "").strip() or None
        # special sentinel "-" from TSV
        if account_key == "-":
            account_key = None
        preferred = (row.get("preferred_model") or "").strip() or None
        execution = (row.get("execution_model") or "").strip() or None
        verified = _bool_from_state((row.get("state") or "").strip())
        primary_pct = _float_or_none(row.get("primary_remaining_pct") or "")
        secondary_pct = _float_or_none(row.get("secondary_remaining_pct") or "")
        cooldown_state = (row.get("cooldown_state") or "").strip()
        cooldown_until = _iso_or_none(row.get("cooldown_next_eligible_at") or "")
        cooldown_reason = cooldown_state if cooldown_state and cooldown_state != "clear" else None
        route_state = (row.get("execution_route_state") or "").strip()
        ready_flag = _ready_from_states(route_state, cooldown_state, primary_pct)

        db.upsert_slot(
            slot,
            provider=provider,
            account=account,
            account_key=account_key,
            preferred_model=preferred,
            execution_model=execution,
            verified=verified,
            ready=ready_flag,
            cooldown_until=cooldown_until,
            cooldown_reason=cooldown_reason,
            usage_primary_pct=primary_pct,
            usage_secondary_pct=secondary_pct,
            last_verified_at=now_iso if verified else None,
        )
        seen += 1
        if ready_flag:
            ready += 1
        if cooldown_state.lower() == "cooling-down":
            cooling += 1

    # Virtual slots (always available, bypass arctic auth)
    _ensure_virtual(
        "local-dry-run",
        provider="local-dry",
        account="local-dry",
        account_key=None,
        preferred_model="dry",
        execution_model="dry",
    )
    # OpenRouter free: enabled only if OPENROUTER_API_KEY is set.
    # We only ever use :free-suffixed model IDs, so no credits can be drawn.
    if os.environ.get("OPENROUTER_API_KEY"):
        _ensure_virtual(
            "openrouter-free",
            provider="openrouter",
            account="api-key",
            account_key="openrouter:api",
            preferred_model="qwen/qwen3-coder:free",
            execution_model="qwen/qwen3-coder:free",
            verified=1,
            ready=1,
        )
    return {"seen": seen, "ready": ready, "cooling": cooling}


def _ensure_virtual(slot: str, **fields) -> None:
    fields.setdefault("verified", 1)
    fields.setdefault("ready", 1)
    db.upsert_slot(slot, **fields)

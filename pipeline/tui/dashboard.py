"""Live pipeline TUI.

Panels:
  - Run summary (by_state counts)
  - Tasks table (id, node, state, attempt, slot, provider, model, last_failure)
  - Slots table (slot, provider, ready, cooldown_until, usage %)
  - Event stream (latest N events)
  - Footer: key hints (r = refresh, a = attach tmux, q = quit)

Data source: SQLite DB (pipeline.db). Refreshes every 2s.
Falls back gracefully if `textual` is not installed (prints a plain table loop).
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import subprocess
import sys
import time
from pathlib import Path

from pipeline.orchestrator import db


def _fmt_ago(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        t = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return iso
    now = dt.datetime.now(dt.timezone.utc)
    secs = int((now - t).total_seconds())
    if secs < 60:
        return f"{secs}s"
    if secs < 3600:
        return f"{secs//60}m"
    if secs < 86400:
        return f"{secs//3600}h{(secs%3600)//60}m"
    return f"{secs//86400}d"


def _run_summary(dag_run_id: str) -> dict[str, int]:
    rows = db.list_tasks(dag_run_id)
    out: dict[str, int] = {}
    for r in rows:
        out[r["state"]] = out.get(r["state"], 0) + 1
    return out


def _latest_events(limit: int = 30):
    return list(db.get_conn().execute(
        "SELECT e.*, t.pass_name, t.node_id FROM task_events e "
        "LEFT JOIN tasks t ON t.id = e.task_id "
        "ORDER BY e.id DESC LIMIT ?", (limit,)
    ).fetchall())


# ---------- plain renderer (no textual dep required) ----------

def _plain_once(dag_run_id: str | None) -> str:
    lines: list[str] = []
    lines.append(f"AirMentor Pipeline TUI · {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M:%SZ}")
    lines.append(f"dag_run_id: {dag_run_id or '(none)'}")
    if dag_run_id:
        summary = _run_summary(dag_run_id)
        lines.append("  by_state: " + ", ".join(f"{k}={v}" for k, v in sorted(summary.items())))
        lines.append("")
        lines.append(f"{'ID':>4} {'NODE':<24} {'STATE':<12} {'ATT':>3} {'SLOT':<22} {'MODEL':<22} {'LAST_FAIL':<24}")
        for r in db.list_tasks(dag_run_id):
            lines.append(
                f"{r['id']:>4} {r['node_id'][:24]:<24} {r['state']:<12} "
                f"{r['attempt']:>3} {(r['slot'] or '-')[:22]:<22} "
                f"{(r['model'] or '-')[:22]:<22} {(r['last_failure_class'] or '-')[:24]:<24}"
            )
    lines.append("")
    lines.append("Slots:")
    lines.append(f"  {'SLOT':<28} {'PROVIDER':<16} {'READY':<5} {'USAGE_P':>7} {'COOLDOWN_UNTIL':<24}")
    for s in db.list_slots():
        cooldown = s["cooldown_until"] or ""
        usage = s["usage_primary_pct"]
        usage_str = f"{usage:.0f}%" if isinstance(usage, (int, float)) else "-"
        lines.append(
            f"  {s['slot'][:28]:<28} {(s['provider'] or '-')[:16]:<16} "
            f"{'yes' if s['ready'] else 'no':<5} {usage_str:>7} {cooldown[:24]:<24}"
        )
    lines.append("")
    lines.append("Events (latest):")
    for e in _latest_events(12):
        lines.append(f"  [{e['at']}] {e['pass_name'] or '-'} {e['kind']}: {e['payload'][:100]}")
    return "\n".join(lines)


def run_plain(dag_run_id: str | None, interval: int) -> int:
    try:
        while True:
            subprocess.run(["clear"], check=False)
            print(_plain_once(dag_run_id))
            print(f"\n(plain mode; refresh {interval}s; Ctrl-C to exit)")
            time.sleep(interval)
    except KeyboardInterrupt:
        return 0


# ---------- textual renderer ----------

def run_textual(dag_run_id: str | None, interval: int) -> int:
    try:
        from textual.app import App, ComposeResult
        from textual.binding import Binding
        from textual.containers import Horizontal, Vertical
        from textual.widgets import DataTable, Footer, Header, Static, Log
    except ImportError:
        print("textual not installed; falling back to plain mode", file=sys.stderr)
        return run_plain(dag_run_id, interval)

    class Dashboard(App):
        CSS = """
        #tasks-table, #slots-table { height: 1fr; }
        #events-log { height: 1fr; border: solid gray; }
        Static.banner { background: $boost; padding: 0 1; }
        """
        BINDINGS = [
            Binding("q", "quit", "quit"),
            Binding("r", "refresh", "refresh"),
            Binding("a", "attach", "attach tmux"),
        ]

        def __init__(self, dag_run_id: str | None, interval: int):
            super().__init__()
            self.dag_run_id = dag_run_id
            self.interval = interval
            self._selected_task_id: int | None = None

        def compose(self) -> ComposeResult:
            yield Header()
            yield Static("", id="summary", classes="banner")
            with Horizontal():
                with Vertical():
                    yield Static("Tasks", classes="banner")
                    yield DataTable(id="tasks-table", cursor_type="row")
                with Vertical():
                    yield Static("Slots", classes="banner")
                    yield DataTable(id="slots-table")
            yield Static("Events", classes="banner")
            yield Log(id="events-log", highlight=True)
            yield Footer()

        def on_mount(self) -> None:
            self.title = "AirMentor Pipeline"
            t_tbl = self.query_one("#tasks-table", DataTable)
            t_tbl.add_columns("ID", "NODE", "STATE", "ATT", "SLOT", "MODEL", "LAST_FAIL")
            s_tbl = self.query_one("#slots-table", DataTable)
            s_tbl.add_columns("SLOT", "PROVIDER", "READY", "USAGE", "COOLDOWN_UNTIL")
            self.set_interval(self.interval, self.action_refresh)
            self.action_refresh()

        def action_refresh(self) -> None:
            summary = _run_summary(self.dag_run_id) if self.dag_run_id else {}
            summary_line = (
                f"dag_run_id: {self.dag_run_id or '(none)'} · "
                + ", ".join(f"{k}={v}" for k, v in sorted(summary.items()))
            )
            self.query_one("#summary", Static).update(summary_line)

            t_tbl = self.query_one("#tasks-table", DataTable)
            t_tbl.clear()
            if self.dag_run_id:
                for r in db.list_tasks(self.dag_run_id):
                    t_tbl.add_row(
                        str(r["id"]),
                        r["node_id"][:30],
                        r["state"],
                        str(r["attempt"]),
                        (r["slot"] or "-")[:22],
                        (r["model"] or "-")[:22],
                        (r["last_failure_class"] or "-")[:20],
                        key=str(r["id"]),
                    )
            s_tbl = self.query_one("#slots-table", DataTable)
            s_tbl.clear()
            for s in db.list_slots():
                usage = s["usage_primary_pct"]
                usage_str = f"{usage:.0f}%" if isinstance(usage, (int, float)) else "-"
                s_tbl.add_row(
                    s["slot"][:28],
                    (s["provider"] or "-")[:14],
                    "yes" if s["ready"] else "no",
                    usage_str,
                    (s["cooldown_until"] or "")[:24],
                )
            ev = self.query_one("#events-log", Log)
            ev.clear()
            for e in _latest_events(30):
                ev.write_line(f"[{e['at']}] {e['pass_name'] or '-'} {e['kind']}: {e['payload'][:140]}")

        def on_data_table_row_highlighted(self, event) -> None:
            try:
                self._selected_task_id = int(event.row_key.value)
            except Exception:
                self._selected_task_id = None

        def action_attach(self) -> None:
            tid = self._selected_task_id
            if tid is None:
                return
            t = db.get_task(tid)
            if not t or not t["tmux_session"]:
                return
            # we can't attach from inside textual cleanly; signal outer script
            attach_hint = Path.home() / ".local" / "state" / "airmentor" / "attach-hint"
            attach_hint.write_text(t["tmux_session"] or "", encoding="utf-8")
            self.exit(message=f"attach:{t['tmux_session']}")

    Dashboard(dag_run_id, interval).run()
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dag-run-id")
    ap.add_argument("--interval", type=int, default=2)
    ap.add_argument("--plain", action="store_true")
    args = ap.parse_args()
    if args.plain:
        return run_plain(args.dag_run_id, args.interval)
    return run_textual(args.dag_run_id, args.interval)


if __name__ == "__main__":
    raise SystemExit(main())

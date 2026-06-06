# AirMentor Agentic OS — HEARTBEAT.md

**Version:** 2.1  
**Date:** 2026-06-06  
**Purpose:** Proactive monitoring and self-healing for the agentic coding system

---

## What Heartbeat Checks

This file controls what the AirMentor agentic OS checks automatically on a schedule.

### Check: Live Watcher Health
- **What:** Verify the deterministic codebase watcher is running
- **How:** Check systemd service status, verify recent index updates
- **Interval:** Every 5 minutes
- **Alert if:** Service down or no index update in >10 minutes
- **Action:** Restart watcher, regenerate index

### Check: Long-Running Tasks
- **What:** Monitor training jobs, data generation, benchmark runs
- **How:** Track PID, CPU usage, output file growth, progress keywords
- **Interval:** Every 30 seconds
- **Alert if:** No progress detected for >2 minutes
- **Action:** Log stall warning, suggest kill/restart

### Check: Token Budget Status
- **What:** Daily API spend vs budget
- **How:** Read circuit-breaker state file
- **Interval:** Every 15 minutes
- **Alert if:** Daily spend >$3.50 (80% of $3.50 budget)
- **Action:** Switch to free-tier-only mode

### Check: Semantic Cache Health
- **What:** Cache hit rate and size
- **How:** Read cache stats
- **Interval:** Every hour
- **Alert if:** Hit rate <30% or cache >10MB
- **Action:** Suggest cache warming, prune old entries

### Check: Skills Registry
- **What:** Available skills count, new skill installations
- **How:** Scan skill directories
- **Interval:** On startup + daily
- **Alert if:** New skills installed (informational)
- **Action:** Update SKILLS_INDEX.md

### Check: Agent Memory
- **What:** Memory store size, entity graph health
- **How:** Read memory stats
- **Interval:** Daily
- **Alert if:** >500 memories or entity graph fragmented
- **Action:** Prune old memories, compact storage

### Check: Code Review Queue
- **What:** Unreviewed changed files since last commit
- **How:** Git diff --name-only
- **Interval:** Before every commit
- **Alert if:** Changed files >5 without review
- **Action:** Run auto-code-review, surface issues

---

## State Tracking

Last check times stored in `.audit/heartbeat-state.json`:
```json
{
  "lastCheck": "2026-06-06T19:30:00Z",
  "checks": {
    "watcher": { "lastRun": "...", "status": "ok" },
    "tasks": { "active": 3, "stalled": 0 },
    "budget": { "dailySpend": 1.20, "remaining": 2.30 },
    "cache": { "hitRate": 0.65, "entries": 142 },
    "skills": { "count": 182 },
    "memory": { "memories": 47, "entities": 23 }
  }
}
```

---

## Batching Rules

- Group related checks together (watcher + index health)
- Skip checks during known quiet hours (if configured)
- Track last run time to avoid redundant work
- Only alert on state changes, not every check

---

## Quiet Hours

Default: No alerts between 23:00-07:00 unless critical (stall, timeout, budget exceeded)

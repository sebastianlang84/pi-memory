---
role: Active open work backlog
contains: Open tasks with priority and status
not-contains: Completed history, durable decisions, or implementation notes
write-when: Active work or priorities change
---

# TODO / Active Backlog

Purpose: Active work only.
Rule: Completed items are removed, not checked off.

## P0 (Now)
- Decide V1 runtime boundary: local library vs localhost service.
- Choose embedding strategy: default model plus fallback for weaker machines.
- Draft the first concrete SQL schema for memories, links, sessions, and artifacts.

## P1 (Next)
- Define hybrid retrieval and application-layer ranking.
- Define V1 write policy (manual, assisted, automatic review, session summaries).
- Define the Pi adapter boundary and future MCP/OpenAPI exposure path.

## P2 (Later)
- Evaluate compaction, TTL, and archive behavior for short-lived memories.
- Decide whether repo-local skills are useful once implementation begins.

---
role: Active open work backlog
contains: Open tasks with priority and status
not-contains: Completed history, durable decisions, or implementation notes
write-when: Active work or priorities change
---

# TODO / Active Backlog

Purpose: Active work only.
Rule: Completed items are removed, not checked off.

## Versioned delivery plan

Each step should land as a small, reviewable, testable commit. `v1.0` is explicitly feature-free: only final review, fixes, cleanup, and release closeout.

### v0.5
- Add embedding generation behind a narrow adapter.
- Store embeddings for saved memories.
- Choose and wire the default model plus fallback path for weaker machines.
- Add tests that verify embedding generation/storage behind a mocked or deterministic adapter.

### v0.6
- Implement hybrid retrieval: FTS + vector search + application-layer ranking.
- Add first-pass ranking inputs such as scope match, recency, importance, and confidence.
- Add basic dedupe behavior for near-identical results.
- Add ranking-focused retrieval tests for mixed DE/EN queries.

### v0.7
- Implement the Pi retrieval hook for `before_agent_start`.
- Map current session/repo/project context into search filters.
- Inject a compact memory context block into the turn.
- Add tests proving only a small top-N context is injected.

### v0.8
- Implement `memory_update`, `memory_link`, and `memory_archive`.
- Add `/memory-search` for manual retrieval/debugging.
- Add tests for patch updates, relations, and archive semantics.

### v0.9
- Implement `/memory-review` and `/memory-session-save`.
- Persist compact session summaries.
- Finalize the manual-first write policy and candidate review flow.
- Add end-to-end tests for save -> search -> review -> session summary.

### v1.0
- No new features.
- Final code review pass.
- Fix review findings and polish rough edges.
- Update affected docs/changelog/version metadata.
- Create the release-finish commit only after verification is green.

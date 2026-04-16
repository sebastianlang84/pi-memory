---
role: Primary bootstrap document for follow-up agent sessions
contains: Current state, long-term memory, recent tasks, open decisions, next steps, and durable risks
not-contains: Rules, procedural runbooks, or diary-style work logs
write-when: Stable truth, project state, open decisions, next steps, or durable risks change
---

# MEMORY

last_updated: 2026-04-16
scope: always-loaded bootstrap; keep lean

## 1) Current State
- Repo initialized for `pi-memory`, a lightweight local memory system for coding agents.
- Root living docs and `docs/` baseline were aligned to the `~/agentic-coding` governance structure.
- Product direction for V1 is documented in `docs/prd-lightweight-local-memory-system.md`.
- A working Pi integration plan now exists in `docs/plans/pi-extension-v1.md`.
- Current V1 direction from the PRD and plan: local-first, single-user, SQLite-based, hybrid retrieval, Pi-first extension surface, thin local core boundary, no heavy server infrastructure.

## 2) Long-Term Memory
- Primary product goal: durable, local, structured memory for coding agents rather than raw chat archival.
- V1 must support German and English retrieval.
- V1 target integration is Pi first; later exposure via MCP or OpenAPI should stay possible.
- Retrieval quality matters more than aggressive auto-save volume.

## 3) Recent Tasks
- 2026-04-16 — Bootstrapped repo living-doc structure and added the initial PRD under `docs/`.
- 2026-04-16 — Added `docs/plans/pi-extension-v1.md` with the proposed V1 extension tools, commands, hooks, and write-policy shape.

## 4) Open Decisions
- Whether V1 should ship as a pure local library or as a small localhost service.
- Which embedding default/fallback combination best fits normal developer machines.
- How much memory creation should be manual vs assisted in V1.

## 5) Next Steps
1. Decide library vs localhost-service for V1.
2. Define the concrete SQL schema and migration approach.
3. Specify hybrid retrieval and ranking behavior.
4. Define write policy and Pi integration boundary.

## 6) Known Risks / Blockers
- `sqlite-vec` maturity risk.
- Local embedding latency on weaker machines.
- Memory quality can degrade quickly if write policy is too permissive.

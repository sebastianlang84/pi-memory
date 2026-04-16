---
role: Project guide
contains: What the repo is, why it exists, navigation, setup expectations, and current direction
not-contains: Detailed decision history, durable agent memory, or active task tracking
write-when: Project orientation, setup, usage, or repo structure changes
---

# pi-memory

A lightweight local memory system for coding agents.

Navigation: `AGENTS.md` (rules and routing), `MEMORY.md` (current state), `TODO.md` (active work), `docs/prd-lightweight-local-memory-system.md` (product direction), `docs/plans/pi-extension-v1.md` (working Pi extension plan).

## Why this repo exists
- Build a super-light local memory layer for coding agents.
- Prioritize local persistence, portability, and low operational overhead.
- Support structured memory objects plus hybrid retrieval instead of raw chat archival.
- Start with Pi integration and keep future MCP/OpenAPI exposure possible.

## Current V1 direction
- Local-first, single-user architecture.
- SQLite as the default storage layer.
- Hybrid retrieval with lexical and semantic search.
- German and English retrieval support.
- Pi-first integration via a Pi extension with a thin local core boundary.

## Repo structure
- `AGENTS.md` - normative agent workflow and routing.
- `MEMORY.md` - stable current truth for the next session.
- `TODO.md` - active backlog only.
- `CHANGELOG.md` - user/operator-visible changes.
- `docs/` - PRD, ADRs, plans, runbooks, policies, audits, and archive material.
- `.agents/skills/` - optional repo-local skills.

## Getting started
1. Read `MEMORY.md` for the current state.
2. Read `TODO.md` for active priorities.
3. Read `docs/prd-lightweight-local-memory-system.md` for the V1 product direction.
4. Read `docs/plans/pi-extension-v1.md` for the current proposed Pi integration surface.
5. Add ADRs, plans, or implementation docs under `docs/` as decisions harden.

## Status
- Repo bootstrap complete.
- Product direction documented.
- Implementation not started yet.

## License
See `LICENSE`.

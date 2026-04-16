import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { initializeMemoryStore } from "../../src/core/index.ts";

function createTempDbPath(): string {
  const tempRoot = mkdtempSync(join(tmpdir(), "pi-memory-search-"));
  return join(tempRoot, "memory.sqlite");
}

test("searchMemories returns lexical matches for an exact term", () => {
  const dbPath = createTempDbPath();
  const store = initializeMemoryStore({ dbPath });

  try {
    store.createMemory({
      kind: "fact",
      scope: "repo",
      title: "SQLite lexical baseline",
      summary: "Lexical retrieval should find the exact token alphaindex42 during tests.",
      tags: ["retrieval"],
    });

    store.createMemory({
      kind: "fact",
      scope: "repo",
      title: "Embedding follow-up",
      summary: "This note is about semantic ranking and should not match the lexical token.",
      tags: ["embeddings"],
    });

    const results = store.searchMemories({ query: "alphaindex42" });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.title, "SQLite lexical baseline");
    assert.equal(results[0]?.kind, "fact");
    assert.equal(results[0]?.scope, "repo");
  } finally {
    store.close();
  }
});

test("searchMemories applies kind and scope filters", () => {
  const dbPath = createTempDbPath();
  const store = initializeMemoryStore({ dbPath });

  try {
    store.createMemory({
      kind: "decision",
      scope: "project",
      title: "Project ranking decision",
      summary: "Rankingpilot should stay in the project retrieval path for the current plan.",
      tags: ["ranking"],
    });

    store.createMemory({
      kind: "decision",
      scope: "repo",
      title: "Repo ranking decision",
      summary: "Rankingpilot also appears in repo-scoped notes for another case.",
      tags: ["ranking"],
    });

    store.createMemory({
      kind: "todo",
      scope: "project",
      title: "Project ranking todo",
      summary: "Rankingpilot follow-up testing still needs coverage after lexical search lands.",
      tags: ["ranking"],
    });

    const results = store.searchMemories({
      query: "rankingpilot",
      kind: ["decision"],
      scope: ["project"],
    });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.title, "Project ranking decision");
    assert.equal(results[0]?.kind, "decision");
    assert.equal(results[0]?.scope, "project");
  } finally {
    store.close();
  }
});

test("searchMemories respects result limits", () => {
  const dbPath = createTempDbPath();
  const store = initializeMemoryStore({ dbPath });

  try {
    for (const title of ["First limit result", "Second limit result", "Third limit result"]) {
      store.createMemory({
        kind: "todo",
        scope: "session",
        title,
        summary: `Limitneedle retrieval test keeps ${title.toLowerCase()} in the lexical result set.`,
        tags: ["limit"],
      });
    }

    const results = store.searchMemories({ query: "limitneedle", limit: 2 });

    assert.equal(results.length, 2);
    assert.ok(results.every((result) => result.title.includes("limit result")));
  } finally {
    store.close();
  }
});

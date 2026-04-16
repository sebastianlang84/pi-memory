import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { initializeMemoryStore } from "../../src/core/index.ts";

test("initializeMemoryStore creates a fresh database and applies schema v1", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pi-memory-store-"));
  const dbPath = join(tempRoot, "memory.sqlite");

  const store = initializeMemoryStore({ dbPath });
  store.close();

  assert.equal(existsSync(dbPath), true);
  assert.equal(store.dbPath, dbPath);
  assert.equal(store.schemaVersion, 1);
  assert.equal(store.latestSchemaVersion, 1);

  const db = new DatabaseSync(dbPath);

  try {
    const schemaVersion = db.prepare("PRAGMA user_version;").get() as { user_version: number };
    assert.equal(schemaVersion.user_version, 1);

    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`,
      )
      .all() as Array<{ name: string }>;

    assert.deepEqual(
      tables.map((table) => table.name),
      ["artifacts", "links", "memories", "sessions"],
    );

    const memoryColumns = db.prepare("PRAGMA table_info(memories);").all() as Array<{ name: string }>;
    assert.deepEqual(
      memoryColumns.map((column) => column.name),
      [
        "id",
        "kind",
        "scope",
        "session_id",
        "title",
        "summary",
        "body",
        "tags_json",
        "source_agent",
        "project_id",
        "repo_path",
        "branch",
        "importance",
        "confidence",
        "status",
        "pinned",
        "created_at",
        "updated_at",
        "last_accessed_at",
        "expires_at",
        "metadata_json",
      ],
    );
  } finally {
    db.close();
  }
});

test("initializeMemoryStore is idempotent for an already-migrated database", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pi-memory-store-"));
  const dbPath = join(tempRoot, "memory.sqlite");

  const firstStore = initializeMemoryStore({ dbPath });
  firstStore.close();

  const secondStore = initializeMemoryStore({ dbPath });

  try {
    assert.equal(secondStore.schemaVersion, 1);
    assert.equal(secondStore.latestSchemaVersion, 1);
  } finally {
    secondStore.close();
  }
});

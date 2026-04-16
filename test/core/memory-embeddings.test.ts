import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  initializeMemoryStore,
  type MemoryContentForEmbedding,
  type MemoryEmbeddingAdapter,
} from "../../src/core/index.ts";

function createTempDbPath(): string {
  const tempRoot = mkdtempSync(join(tmpdir(), "pi-memory-embeddings-"));
  return join(tempRoot, "memory.sqlite");
}

test("createMemory stores a deterministic embedding with the default adapter", () => {
  const dbPath = createTempDbPath();
  const store = initializeMemoryStore({ dbPath });

  try {
    const memory = store.createMemory({
      kind: "fact",
      scope: "repo",
      title: "Embedding baseline",
      summary: "Store a deterministic embedding so hybrid retrieval can build on persisted vectors later.",
      tags: ["embeddings", "retrieval"],
    });

    const embedding = store.getMemoryEmbedding(memory.id);

    assert.ok(embedding);
    assert.equal(embedding?.memoryId, memory.id);
    assert.equal(embedding?.model, "builtin-hash-384-v1");
    assert.equal(embedding?.dimensions, 384);
    assert.equal(embedding?.vector.length, 384);
    assert.match(embedding?.contentHash ?? "", /^[0-9a-f]{64}$/);
    assert.ok(embedding?.vector.some((value) => value !== 0));
  } finally {
    store.close();
  }
});

test("initializeMemoryStore accepts a custom embedding adapter for deterministic tests", () => {
  const dbPath = createTempDbPath();
  let capturedContent: MemoryContentForEmbedding | undefined;

  const adapter: MemoryEmbeddingAdapter = {
    getStatus() {
      return {
        strategy: "mock",
        defaultModel: "mock-2d-default",
        fallbackModel: "mock-1d-lite",
        activeModel: "mock-2d-default",
        dimensions: 2,
      };
    },
    generateEmbedding(memory) {
      capturedContent = memory;

      return {
        model: "mock-2d-default",
        dimensions: 2,
        vector: [0.25, -0.75],
        contentHash: "mock-content-hash",
      };
    },
  };

  const store = initializeMemoryStore({ dbPath, embeddingAdapter: adapter });

  try {
    const memory = store.createMemory({
      kind: "decision",
      scope: "project",
      title: "Use injected adapter",
      summary: "Allow deterministic embedding tests without binding the suite to one builtin profile.",
      body: "This verifies the narrow adapter boundary for v0.5.",
      tags: ["embeddings", "tests"],
    });

    const embedding = store.getMemoryEmbedding(memory.id);

    assert.deepEqual(capturedContent, {
      title: "Use injected adapter",
      summary: "Allow deterministic embedding tests without binding the suite to one builtin profile.",
      body: "This verifies the narrow adapter boundary for v0.5.",
      tags: ["embeddings", "tests"],
    });
    assert.equal(store.embeddingModel, "mock-2d-default");
    assert.equal(store.embeddingDimensions, 2);
    assert.equal(embedding?.model, "mock-2d-default");
    assert.equal(embedding?.dimensions, 2);
    assert.deepEqual(embedding?.vector, [0.25, -0.75]);
    assert.equal(embedding?.contentHash, "mock-content-hash");
  } finally {
    store.close();
  }
});

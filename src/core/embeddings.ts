import { createHash } from "node:crypto";

import type { MemoryRecord } from "./memories.ts";

export type BuiltinEmbeddingProfile = "default" | "low-footprint";

export interface MemoryEmbeddingRecord {
  memoryId: string;
  model: string;
  dimensions: number;
  vector: number[];
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedMemoryEmbedding {
  model: string;
  dimensions: number;
  vector: number[];
  contentHash: string;
}

export interface MemoryEmbeddingAdapterStatus {
  strategy: string;
  defaultModel: string;
  fallbackModel: string;
  activeModel: string;
  dimensions: number;
}

export interface MemoryEmbeddingAdapter {
  getStatus(): MemoryEmbeddingAdapterStatus;
  generateEmbedding(memory: MemoryContentForEmbedding): GeneratedMemoryEmbedding;
}

export interface MemoryContentForEmbedding {
  title: string;
  summary: string;
  body?: string;
  tags: string[];
}

export const DEFAULT_EMBEDDING_MODEL = {
  model: "builtin-hash-384-v1",
  dimensions: 384,
} as const;

export const FALLBACK_EMBEDDING_MODEL = {
  model: "builtin-hash-64-v1",
  dimensions: 64,
} as const;

export function createDefaultMemoryEmbeddingAdapter(
  profile: BuiltinEmbeddingProfile = "default",
): MemoryEmbeddingAdapter {
  const activeModel = profile === "low-footprint" ? FALLBACK_EMBEDDING_MODEL : DEFAULT_EMBEDDING_MODEL;

  return {
    getStatus() {
      return {
        strategy: "deterministic-hash",
        defaultModel: DEFAULT_EMBEDDING_MODEL.model,
        fallbackModel: FALLBACK_EMBEDDING_MODEL.model,
        activeModel: activeModel.model,
        dimensions: activeModel.dimensions,
      };
    },
    generateEmbedding(memory) {
      const content = serializeMemoryContent(memory);
      const vector = createDeterministicVector(content, activeModel.dimensions);

      return {
        model: activeModel.model,
        dimensions: activeModel.dimensions,
        vector,
        contentHash: createSha256(content),
      };
    },
  };
}

export function createMemoryContentForEmbedding(memory: Pick<MemoryRecord, "title" | "summary" | "body" | "tags">): MemoryContentForEmbedding {
  return {
    title: memory.title,
    summary: memory.summary,
    body: memory.body,
    tags: memory.tags,
  };
}

function serializeMemoryContent(memory: MemoryContentForEmbedding): string {
  return [memory.title, memory.summary, memory.body ?? "", memory.tags.join(" ")]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join("\n");
}

function createDeterministicVector(content: string, dimensions: number): number[] {
  const vector: number[] = [];
  let counter = 0;

  while (vector.length < dimensions) {
    const digest = createHash("sha256")
      .update(content)
      .update("\0")
      .update(String(counter))
      .digest();

    for (let offset = 0; offset + 4 <= digest.length && vector.length < dimensions; offset += 4) {
      const normalized = digest.readUInt32BE(offset) / 0xffffffff;
      vector.push(normalized * 2 - 1);
    }

    counter += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

function createSha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

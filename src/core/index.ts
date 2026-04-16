export { DEFAULT_EMBEDDING_MODEL, FALLBACK_EMBEDDING_MODEL, createDefaultMemoryEmbeddingAdapter } from "./embeddings.ts";
export { LATEST_MEMORY_SCHEMA_VERSION } from "./migrations.ts";
export { createMemoryCore } from "./memory-core.ts";
export {
  MEMORY_KINDS,
  MEMORY_SCOPES,
  MemoryValidationError,
  normalizeCreateMemoryInput,
  normalizeSearchMemoriesInput,
} from "./memories.ts";
export { initializeMemoryStore } from "./store.ts";
export type {
  BuiltinEmbeddingProfile,
  GeneratedMemoryEmbedding,
  MemoryContentForEmbedding,
  MemoryEmbeddingAdapter,
  MemoryEmbeddingAdapterStatus,
  MemoryEmbeddingRecord,
} from "./embeddings.ts";
export type {
  CreateMemoryInput,
  MemoryKind,
  MemoryRecord,
  MemoryScope,
  MemorySearchResult,
  MemoryStatus,
  SearchMemoriesInput,
} from "./memories.ts";
export type { MemoryCore, MemoryCoreStatus } from "./memory-core.ts";
export type { InitializeMemoryStoreInput, MemoryStore, MemoryStoreStatus } from "./store.ts";

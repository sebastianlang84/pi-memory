import { LATEST_MEMORY_SCHEMA_VERSION } from "./migrations.ts";
import { initializeMemoryStore, type InitializeMemoryStoreInput, type MemoryStore } from "./store.ts";

export interface MemoryCoreStatus {
  version: "v0.4";
  mode: "local-core";
  storage: "sqlite-fts-ready";
  latestSchemaVersion: number;
  availableCommands: string[];
  availableTools: string[];
  nextStep: string;
}

export interface MemoryCore {
  getStatus(): MemoryCoreStatus;
  initializeStore(input: InitializeMemoryStoreInput): MemoryStore;
}

export function createMemoryCore(): MemoryCore {
  return {
    getStatus() {
      return {
        version: "v0.4",
        mode: "local-core",
        storage: "sqlite-fts-ready",
        latestSchemaVersion: LATEST_MEMORY_SCHEMA_VERSION,
        availableCommands: ["/memory-status"],
        availableTools: ["memory_search", "memory_save"],
        nextStep: "Implement embeddings and storage behind a narrow adapter in v0.5.",
      };
    },
    initializeStore(input) {
      return initializeMemoryStore(input);
    },
  };
}

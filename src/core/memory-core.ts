import { LATEST_MEMORY_SCHEMA_VERSION } from "./migrations.ts";
import { initializeMemoryStore, type InitializeMemoryStoreInput, type MemoryStore } from "./store.ts";

export interface MemoryCoreStatus {
  version: "v0.2";
  mode: "local-core";
  storage: "sqlite-ready";
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
        version: "v0.2",
        mode: "local-core",
        storage: "sqlite-ready",
        latestSchemaVersion: LATEST_MEMORY_SCHEMA_VERSION,
        availableCommands: ["/memory-status"],
        availableTools: [],
        nextStep: "Implement memory_save with validation and persisted readback in v0.3.",
      };
    },
    initializeStore(input) {
      return initializeMemoryStore(input);
    },
  };
}

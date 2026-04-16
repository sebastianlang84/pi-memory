export interface MemoryCoreStatus {
  version: "v0.1";
  mode: "bootstrap-stub";
  storage: "not-initialized";
  availableCommands: string[];
  availableTools: string[];
  nextStep: string;
}

export interface MemoryCore {
  getStatus(): MemoryCoreStatus;
}

export function createMemoryCore(): MemoryCore {
  return {
    getStatus() {
      return {
        version: "v0.1",
        mode: "bootstrap-stub",
        storage: "not-initialized",
        availableCommands: ["/memory-status"],
        availableTools: [],
        nextStep: "Implement SQLite store initialization and first migrations in v0.2.",
      };
    },
  };
}

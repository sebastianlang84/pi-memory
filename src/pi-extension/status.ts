import type { MemoryCoreStatus } from "../core/index.ts";

export function formatMemoryStatus(status: MemoryCoreStatus, cwd: string): string {
  return [
    "pi-memory status",
    `version: ${status.version}`,
    `cwd: ${cwd}`,
    `core_mode: ${status.mode}`,
    `storage: ${status.storage}`,
    `latest_schema_version: ${status.latestSchemaVersion}`,
    `commands: ${status.availableCommands.join(", ") || "none"}`,
    `tools: ${status.availableTools.join(", ") || "none"}`,
    `next_step: ${status.nextStep}`,
  ].join("\n");
}

export function formatStatusWidgetLines(status: MemoryCoreStatus, cwd: string): string[] {
  return formatMemoryStatus(status, cwd).split("\n");
}

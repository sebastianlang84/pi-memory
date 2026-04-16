import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createMemoryCore } from "../core/index.ts";
import { formatMemoryStatus, formatStatusWidgetLines } from "./status.ts";

export default function registerPiMemoryExtension(pi: ExtensionAPI) {
  const core = createMemoryCore();

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("pi-memory", "pi-memory v0.2 ready — /memory-status");
  });

  pi.registerCommand("memory-status", {
    description: "Show the current pi-memory bootstrap status",
    handler: async (_args, ctx) => {
      const status = core.getStatus();
      const output = formatMemoryStatus(status, ctx.cwd);

      if (ctx.hasUI) {
        ctx.ui.setWidget("pi-memory-status", formatStatusWidgetLines(status, ctx.cwd));
        ctx.ui.notify("pi-memory status updated", "info");
        return;
      }

      process.stdout.write(`${output}\n`);
    },
  });
}

import { resolve } from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import {
  createMemoryCore,
  MEMORY_KINDS,
  MEMORY_SCOPES,
  type MemoryRecord,
  type MemorySearchResult,
  type MemoryStore,
} from "../core/index.ts";
import { formatMemoryStatus, formatStatusWidgetLines } from "./status.ts";

const DEFAULT_DB_FILE = [".pi", "pi-memory.sqlite"] as const;

export default function registerPiMemoryExtension(pi: ExtensionAPI) {
  const core = createMemoryCore();
  let store: MemoryStore | undefined;

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("pi-memory", "pi-memory v0.6 ready — /memory-status, memory_search, memory_save");
  });

  pi.on("session_shutdown", async () => {
    store?.close();
    store = undefined;
  });

  pi.registerTool({
    name: "memory_search",
    label: "Memory Search",
    description: "Search the local pi-memory store using hybrid lexical + semantic retrieval and compact filters.",
    promptSnippet: "Search local durable memory before guessing when prior decisions, facts, or todos may matter.",
    promptGuidelines: [
      "Keep queries compact and concrete.",
      "Use filters to narrow the result set when kind, scope, project, repo, or tags are known.",
      "Prefer small limits to protect context quality.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      kind: Type.Optional(Type.Array(StringEnum(MEMORY_KINDS, { description: "Memory kind" }))),
      scope: Type.Optional(Type.Array(StringEnum(MEMORY_SCOPES, { description: "Memory scope" }))),
      tags: Type.Optional(Type.Array(Type.String({ description: "Tag" }))),
      projectId: Type.Optional(Type.String({ description: "Optional project identifier filter" })),
      repoPath: Type.Optional(Type.String({ description: "Optional repository path filter" })),
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 20, description: "Max result count" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const activeStore = getStoreForCwd(core, store, ctx.cwd);
      store = activeStore;

      const results = activeStore.searchMemories(params);

      return {
        content: [{ type: "text", text: formatMemorySearchResults(params.query, results, activeStore.dbPath) }],
        details: {
          dbPath: activeStore.dbPath,
          results,
        },
      };
    },
  });

  pi.registerTool({
    name: "memory_save",
    label: "Memory Save",
    description: "Create a structured memory in the local pi-memory store.",
    promptSnippet:
      "Save a durable structured memory when the user explicitly wants something remembered or when a stable decision/fact/todo should be preserved.",
    promptGuidelines: [
      "Use this tool for explicit durable memory writes, not for low-information scratch notes.",
      "Always provide a compact but informative summary.",
    ],
    parameters: Type.Object({
      kind: StringEnum(MEMORY_KINDS, { description: "Memory kind" }),
      scope: StringEnum(MEMORY_SCOPES, { description: "Memory scope" }),
      title: Type.String({ description: "Short title for the memory" }),
      summary: Type.String({ description: "Compact summary with enough detail to be useful later" }),
      body: Type.Optional(Type.String({ description: "Optional longer details" })),
      tags: Type.Optional(Type.Array(Type.String({ description: "Tag" }))),
      importance: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
      confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const activeStore = getStoreForCwd(core, store, ctx.cwd);
      store = activeStore;

      const memory = activeStore.createMemory({
        ...params,
        sourceAgent: "pi",
      });

      return {
        content: [{ type: "text", text: formatMemorySaved(memory, activeStore) }],
        details: {
          dbPath: activeStore.dbPath,
          memory,
        },
      };
    },
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

function getStoreForCwd(
  core: ReturnType<typeof createMemoryCore>,
  currentStore: MemoryStore | undefined,
  cwd: string,
): MemoryStore {
  const dbPath = resolve(cwd, ...DEFAULT_DB_FILE);

  if (currentStore?.dbPath === dbPath) {
    return currentStore;
  }

  currentStore?.close();
  return core.initializeStore({ dbPath });
}

function formatMemorySaved(memory: MemoryRecord, store: MemoryStore): string {
  return [
    `Saved memory ${memory.id}.`,
    `kind: ${memory.kind}`,
    `scope: ${memory.scope}`,
    `title: ${memory.title}`,
    `summary: ${memory.summary}`,
    `tags: ${memory.tags.join(", ") || "none"}`,
    `embedding_model: ${store.embeddingModel}`,
    `embedding_dimensions: ${store.embeddingDimensions}`,
    `db_path: ${store.dbPath}`,
  ].join("\n");
}

function formatMemorySearchResults(query: string, results: MemorySearchResult[], dbPath: string): string {
  if (results.length === 0) {
    return [`No memories matched \"${query}\".`, `db_path: ${dbPath}`].join("\n");
  }

  return [
    `Found ${results.length} memory result${results.length === 1 ? "" : "s"} for \"${query}\".`,
    ...results.map((result, index) => formatMemorySearchResultLine(index + 1, result)),
    `db_path: ${dbPath}`,
  ].join("\n");
}

function formatMemorySearchResultLine(index: number, result: MemorySearchResult): string {
  const metadata: string[] = [`${result.kind}/${result.scope}`];

  if (result.tags.length > 0) {
    metadata.push(`tags=${result.tags.join(",")}`);
  }

  metadata.push(`score=${result.matchScore.toFixed(3)}`);

  if (result.lexicalScore > 0) {
    metadata.push(`lex=${result.lexicalScore.toFixed(3)}`);
  }

  if (result.semanticScore > 0) {
    metadata.push(`sem=${result.semanticScore.toFixed(3)}`);
  }

  return `${index}. [${metadata.join(" | ")}] ${result.title} — ${result.summary}`;
}

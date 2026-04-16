import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  createDefaultMemoryEmbeddingAdapter,
  createMemoryContentForEmbedding,
  type MemoryEmbeddingAdapter,
  type MemoryEmbeddingRecord,
} from "./embeddings.ts";
import {
  type CreateMemoryInput,
  type MemoryRecord,
  type MemorySearchResult,
  type SearchMemoriesInput,
  normalizeCreateMemoryInput,
  normalizeSearchMemoriesInput,
} from "./memories.ts";
import { LATEST_MEMORY_SCHEMA_VERSION, memoryMigrations } from "./migrations.ts";

export interface InitializeMemoryStoreInput {
  dbPath: string;
  embeddingAdapter?: MemoryEmbeddingAdapter;
  preferLowFootprintEmbeddings?: boolean;
}

export interface MemoryStoreStatus {
  dbPath: string;
  schemaVersion: number;
  latestSchemaVersion: number;
  embeddingModel: string;
  fallbackEmbeddingModel: string;
  embeddingDimensions: number;
  embeddingStrategy: string;
}

export interface MemoryStore extends MemoryStoreStatus {
  createMemory(input: CreateMemoryInput): MemoryRecord;
  getMemory(id: string): MemoryRecord | null;
  getMemoryEmbedding(id: string): MemoryEmbeddingRecord | null;
  searchMemories(input: SearchMemoriesInput): MemorySearchResult[];
  close(): void;
}

interface MemoryRow {
  id: string;
  kind: MemoryRecord["kind"];
  scope: MemoryRecord["scope"];
  session_id: string | null;
  title: string;
  summary: string;
  body: string | null;
  tags_json: string;
  source_agent: string | null;
  project_id: string | null;
  repo_path: string | null;
  branch: string | null;
  importance: number;
  confidence: number;
  status: MemoryRecord["status"];
  pinned: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  expires_at: string | null;
  metadata_json: string;
}

interface MemoryEmbeddingRow {
  memory_id: string;
  model: string;
  dimensions: number;
  vector_json: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

interface MemorySearchRow {
  id: string;
  kind: MemoryRecord["kind"];
  scope: MemoryRecord["scope"];
  title: string;
  summary: string;
  tags_json: string;
  project_id: string | null;
  repo_path: string | null;
  importance: number;
  confidence: number;
  created_at: string;
  updated_at: string;
  match_score: number;
}

export function initializeMemoryStore(input: InitializeMemoryStoreInput): MemoryStore {
  const dbPath = resolve(input.dbPath);
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  const embeddingAdapter =
    input.embeddingAdapter ??
    createDefaultMemoryEmbeddingAdapter(input.preferLowFootprintEmbeddings ? "low-footprint" : "default");

  try {
    configureDatabase(db);
    applyMigrations(db);

    const schemaVersion = getSchemaVersion(db);
    const embeddingStatus = embeddingAdapter.getStatus();
    let isClosed = false;

    return {
      dbPath,
      schemaVersion,
      latestSchemaVersion: LATEST_MEMORY_SCHEMA_VERSION,
      embeddingModel: embeddingStatus.activeModel,
      fallbackEmbeddingModel: embeddingStatus.fallbackModel,
      embeddingDimensions: embeddingStatus.dimensions,
      embeddingStrategy: embeddingStatus.strategy,
      createMemory(input) {
        assertStoreOpen(isClosed);

        const memory = normalizeCreateMemoryInput(input);
        const embedding = embeddingAdapter.generateEmbedding(createMemoryContentForEmbedding(memory));
        const timestamp = new Date().toISOString();

        db.exec("BEGIN IMMEDIATE;");

        try {
          db.prepare(`
            INSERT INTO memories (
              id,
              kind,
              scope,
              session_id,
              title,
              summary,
              body,
              tags_json,
              source_agent,
              project_id,
              repo_path,
              branch,
              importance,
              confidence,
              status,
              pinned,
              created_at,
              updated_at,
              expires_at,
              metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `).run(
            memory.id,
            memory.kind,
            memory.scope,
            memory.sessionId ?? null,
            memory.title,
            memory.summary,
            memory.body ?? null,
            JSON.stringify(memory.tags),
            memory.sourceAgent ?? null,
            memory.projectId ?? null,
            memory.repoPath ?? null,
            memory.branch ?? null,
            memory.importance,
            memory.confidence,
            memory.status,
            memory.pinned ? 1 : 0,
            memory.createdAt,
            memory.updatedAt,
            memory.expiresAt ?? null,
            JSON.stringify(memory.metadata),
          );

          writeMemoryEmbedding(db, memory.id, embedding, timestamp);
          db.exec("COMMIT;");
        } catch (error) {
          db.exec("ROLLBACK;");
          throw error;
        }

        const persistedMemory = readMemoryById(db, memory.id);
        if (!persistedMemory) {
          throw new Error(`Failed to read back persisted memory ${memory.id}`);
        }

        return persistedMemory;
      },
      getMemory(id) {
        assertStoreOpen(isClosed);

        const normalizedId = id.trim();
        if (normalizedId.length === 0) return null;

        return readMemoryById(db, normalizedId);
      },
      getMemoryEmbedding(id) {
        assertStoreOpen(isClosed);

        const normalizedId = id.trim();
        if (normalizedId.length === 0) return null;

        return readMemoryEmbeddingById(db, normalizedId);
      },
      searchMemories(input) {
        assertStoreOpen(isClosed);

        const normalizedInput = normalizeSearchMemoriesInput(input);
        const filters = ["m.status = 'active'", "memory_fts MATCH ?"];
        const params: Array<string | number> = [normalizedInput.matchQuery];

        if (normalizedInput.kind && normalizedInput.kind.length > 0) {
          filters.push(`m.kind IN (${createPlaceholders(normalizedInput.kind.length)})`);
          params.push(...normalizedInput.kind);
        }

        if (normalizedInput.scope && normalizedInput.scope.length > 0) {
          filters.push(`m.scope IN (${createPlaceholders(normalizedInput.scope.length)})`);
          params.push(...normalizedInput.scope);
        }

        if (normalizedInput.projectId) {
          filters.push("m.project_id = ?");
          params.push(normalizedInput.projectId);
        }

        if (normalizedInput.repoPath) {
          filters.push("m.repo_path = ?");
          params.push(normalizedInput.repoPath);
        }

        if (normalizedInput.tags.length > 0) {
          filters.push(
            `EXISTS (SELECT 1 FROM json_each(m.tags_json) AS tag WHERE tag.value IN (${createPlaceholders(normalizedInput.tags.length)}))`,
          );
          params.push(...normalizedInput.tags);
        }

        params.push(normalizedInput.limit);

        const rows = db
          .prepare(`
            SELECT
              m.id,
              m.kind,
              m.scope,
              m.title,
              m.summary,
              m.tags_json,
              m.project_id,
              m.repo_path,
              m.importance,
              m.confidence,
              m.created_at,
              m.updated_at,
              bm25(memory_fts, 10.0, 5.0, 1.0, 1.0) AS match_score
            FROM memory_fts
            JOIN memories AS m ON m.rowid = memory_fts.rowid
            WHERE ${filters.join(" AND ")}
            ORDER BY match_score ASC, m.importance DESC, m.confidence DESC, m.updated_at DESC
            LIMIT ?;
          `)
          .all(...params) as MemorySearchRow[];

        return rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          scope: row.scope,
          title: row.title,
          summary: row.summary,
          tags: parseStringArray(row.tags_json),
          projectId: row.project_id ?? undefined,
          repoPath: row.repo_path ?? undefined,
          importance: row.importance,
          confidence: row.confidence,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          matchScore: row.match_score,
        }));
      },
      close() {
        if (isClosed) return;
        isClosed = true;
        db.close();
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

function configureDatabase(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
}

function applyMigrations(db: DatabaseSync): void {
  const currentVersion = getSchemaVersion(db);
  const pendingMigrations = memoryMigrations.filter((migration) => migration.version > currentVersion);

  if (pendingMigrations.length === 0) return;

  db.exec("BEGIN IMMEDIATE;");

  try {
    for (const migration of pendingMigrations) {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version};`);
    }

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function getSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version;").get() as { user_version: number };
  return row.user_version;
}

function readMemoryById(db: DatabaseSync, id: string): MemoryRecord | null {
  const row = db
    .prepare(
      `SELECT
        id,
        kind,
        scope,
        session_id,
        title,
        summary,
        body,
        tags_json,
        source_agent,
        project_id,
        repo_path,
        branch,
        importance,
        confidence,
        status,
        pinned,
        created_at,
        updated_at,
        last_accessed_at,
        expires_at,
        metadata_json
      FROM memories
      WHERE id = ?;`,
    )
    .get(id) as MemoryRow | undefined;

  return row ? mapMemoryRow(row) : null;
}

function readMemoryEmbeddingById(db: DatabaseSync, id: string): MemoryEmbeddingRecord | null {
  const row = db
    .prepare(
      `SELECT
        memory_id,
        model,
        dimensions,
        vector_json,
        content_hash,
        created_at,
        updated_at
      FROM memory_embeddings
      WHERE memory_id = ?;`,
    )
    .get(id) as MemoryEmbeddingRow | undefined;

  return row ? mapMemoryEmbeddingRow(row) : null;
}

function writeMemoryEmbedding(
  db: DatabaseSync,
  memoryId: string,
  embedding: ReturnType<MemoryEmbeddingAdapter["generateEmbedding"]>,
  timestamp: string,
): void {
  db.prepare(`
    INSERT INTO memory_embeddings (
      memory_id,
      model,
      dimensions,
      vector_json,
      content_hash,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(memory_id) DO UPDATE SET
      model = excluded.model,
      dimensions = excluded.dimensions,
      vector_json = excluded.vector_json,
      content_hash = excluded.content_hash,
      updated_at = excluded.updated_at;
  `).run(
    memoryId,
    embedding.model,
    embedding.dimensions,
    JSON.stringify(embedding.vector),
    embedding.contentHash,
    timestamp,
    timestamp,
  );
}

function mapMemoryRow(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    kind: row.kind,
    scope: row.scope,
    sessionId: row.session_id ?? undefined,
    title: row.title,
    summary: row.summary,
    body: row.body ?? undefined,
    tags: parseStringArray(row.tags_json),
    sourceAgent: row.source_agent ?? undefined,
    projectId: row.project_id ?? undefined,
    repoPath: row.repo_path ?? undefined,
    branch: row.branch ?? undefined,
    importance: row.importance,
    confidence: row.confidence,
    status: row.status,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    metadata: parseObject(row.metadata_json),
  };
}

function mapMemoryEmbeddingRow(row: MemoryEmbeddingRow): MemoryEmbeddingRecord {
  return {
    memoryId: row.memory_id,
    model: row.model,
    dimensions: row.dimensions,
    vector: parseNumberArray(row.vector_json),
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseNumberArray(value: string): number[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === "number") : [];
  } catch {
    return [];
  }
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function createPlaceholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function assertStoreOpen(isClosed: boolean): void {
  if (isClosed) {
    throw new Error("Memory store is closed");
  }
}

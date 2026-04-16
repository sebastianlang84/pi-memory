import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  type CreateMemoryInput,
  type MemoryRecord,
  normalizeCreateMemoryInput,
} from "./memories.ts";
import { LATEST_MEMORY_SCHEMA_VERSION, memoryMigrations } from "./migrations.ts";

export interface InitializeMemoryStoreInput {
  dbPath: string;
}

export interface MemoryStoreStatus {
  dbPath: string;
  schemaVersion: number;
  latestSchemaVersion: number;
}

export interface MemoryStore extends MemoryStoreStatus {
  createMemory(input: CreateMemoryInput): MemoryRecord;
  getMemory(id: string): MemoryRecord | null;
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

export function initializeMemoryStore(input: InitializeMemoryStoreInput): MemoryStore {
  const dbPath = resolve(input.dbPath);
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);

  try {
    configureDatabase(db);
    applyMigrations(db);

    const schemaVersion = getSchemaVersion(db);
    let isClosed = false;

    return {
      dbPath,
      schemaVersion,
      latestSchemaVersion: LATEST_MEMORY_SCHEMA_VERSION,
      createMemory(input) {
        assertStoreOpen(isClosed);

        const memory = normalizeCreateMemoryInput(input);
        const statement = db.prepare(`
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
        `);

        statement.run(
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

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
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

function assertStoreOpen(isClosed: boolean): void {
  if (isClosed) {
    throw new Error("Memory store is closed");
  }
}

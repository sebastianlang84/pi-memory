import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
  close(): void;
}

export function initializeMemoryStore(input: InitializeMemoryStoreInput): MemoryStore {
  const dbPath = resolve(input.dbPath);
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);

  try {
    configureDatabase(db);
    applyMigrations(db);

    return {
      dbPath,
      schemaVersion: getSchemaVersion(db),
      latestSchemaVersion: LATEST_MEMORY_SCHEMA_VERSION,
      close() {
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

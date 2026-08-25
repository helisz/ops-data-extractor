import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH || 'data/app.db';

function ensureDbFile() {
  const dir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let db: Database.Database | null = null;

/**
 * Initialize (once) and return the shared SQLite connection.
 * Creates the metadata tables on first run.
 */
export function initDb(): Database.Database {
  if (db) return db;

  ensureDbFile();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      headers TEXT NOT NULL DEFAULT '[]',
      active_version_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, version_number),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      sql_text TEXT,
      execution_meta TEXT,
      result_data TEXT,
      session_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_versions_project ON versions(project_id);
    CREATE INDEX IF NOT EXISTS idx_chat_project ON chat_messages(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id, created_at);
  `);

  // Migration: add session_id to existing chat_messages tables.
  const chatCols = db.prepare('PRAGMA table_info(chat_messages)').all() as Array<{ name: string }>;
  if (!chatCols.some((c) => c.name === 'session_id')) {
    db.exec(
      `ALTER TABLE chat_messages
       ADD COLUMN session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE`,
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id)');
  }
  // Migration: add result_data to persist query results in history.
  if (!chatCols.some((c) => c.name === 'result_data')) {
    db.exec('ALTER TABLE chat_messages ADD COLUMN result_data TEXT');
  }

  return db;
}

export function getDb(): Database.Database {
  if (!db) return initDb();
  return db;
}

/** Build the real SQLite table name for a project version's data. */
export function dataTableName(projectId: number, versionNumber: number): string {
  return `data_p${projectId}_v${versionNumber}`;
}

/** Drop a version's data table if it exists. */
export function dropDataTable(projectId: number, versionNumber: number): void {
  const tableName = dataTableName(projectId, versionNumber);
  getDb().exec(`DROP TABLE IF EXISTS "${tableName}"`);
}

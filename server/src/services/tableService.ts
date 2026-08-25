import { getDb, dataTableName } from '../db.js';
import { sanitizeColumnName, inferColumnType, type ParsedExcel } from './excel.js';

export interface ColumnMapping {
  /** Original user-facing header. */
  header: string;
  /** Sanitized SQLite column name. */
  column: string;
  /** Inferred column type. */
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATETIME';
}

export interface ProjectRow {
  id: number;
  name: string;
  description: string;
  headers: string;
  active_version_id: number | null;
  created_at: string;
}

export interface VersionRow {
  id: number;
  project_id: number;
  version_number: number;
  created_at: string;
}

/** Parse a project's stored headers JSON into a column mapping array. */
export function getHeaderMapping(projectId: number): ColumnMapping[] {
  const row = getDb().prepare('SELECT headers FROM projects WHERE id = ?').get(projectId) as
    | { headers: string }
    | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.headers);
    return Array.isArray(parsed) ? (parsed as ColumnMapping[]) : [];
  } catch {
    return [];
  }
}

/** Get a project row by id or undefined. */
export function getProject(projectId: number): ProjectRow | undefined {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as
    | ProjectRow
    | undefined;
}

/** Get all versions of a project, ordered by version number. */
export function getVersions(projectId: number): VersionRow[] {
  return getDb()
    .prepare('SELECT * FROM versions WHERE project_id = ? ORDER BY version_number ASC')
    .all(projectId) as VersionRow[];
}

/** Get the active version row for a project, or undefined. */
export function getActiveVersion(projectId: number): VersionRow | undefined {
  const project = getProject(projectId);
  if (!project || !project.active_version_id) return undefined;
  return getDb()
    .prepare('SELECT * FROM versions WHERE id = ? AND project_id = ?')
    .get(project.active_version_id, projectId) as VersionRow | undefined;
}

/**
 * Create the per-version data table `data_p{projectId}_v{versionNumber}`,
 * insert all rows, and record the header mapping on the project
 * (only when the project has no structure yet, i.e. first version).
 */
export function createDataTable(
  projectId: number,
  versionNumber: number,
  parsed: ParsedExcel,
): ColumnMapping[] {
  const db = getDb();
  const tableName = dataTableName(projectId, versionNumber);

  const taken = new Set<string>();
  const columns: ColumnMapping[] = parsed.headers.map((header) => ({
    header,
    column: sanitizeColumnName(header, taken),
    type: inferColumnType(parsed.rows.map((r) => r[header])),
  }));

  const colDefs = columns.map((c) => `"${c.column}" ${c.type}`).join(', ');
  db.exec(`CREATE TABLE "${tableName}" (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`);

  const insert = db.prepare(
    `INSERT INTO "${tableName}" (${columns.map((c) => `"${c.column}"`).join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})`,
  );
  const insertAll = db.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      insert.run(columns.map((c) => row[c.header] ?? null));
    }
  });
  insertAll(parsed.rows);

  // Record header mapping on the project only for the first version.
  const project = getProject(projectId);
  if (project && project.headers.trim() === '[]') {
    db.prepare('UPDATE projects SET headers = ? WHERE id = ?').run(
      JSON.stringify(columns),
      projectId,
    );
  }

  return columns;
}

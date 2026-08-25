import { Router, type Request, type Response } from 'express';
import { getDb, dataTableName } from '../db.js';
import {
  getProject,
  getActiveVersion,
  getHeaderMapping,
  type ColumnMapping,
} from '../services/tableService.js';

const router = Router();

interface FilterEntry {
  key: string;
  value: string;
}

function parseFilters(raw: unknown): FilterEntry[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, string | number>;
    return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
  } catch {
    return [];
  }
}

/** Resolve a filter key to a valid column mapping (by column name or original header). */
function resolveColumn(mappings: ColumnMapping[], key: string): ColumnMapping | undefined {
  return mappings.find((m) => m.column === key || m.header === key);
}

function buildWhereClause(
  filters: FilterEntry[],
  mappings: ColumnMapping[],
  params: unknown[],
): string {
  const clauses: string[] = [];
  for (const f of filters) {
    if (f.value === '') continue;
    const m = resolveColumn(mappings, f.key);
    if (!m) continue;
    const col = `"${m.column}"`;
    const v = f.value;
    if (m.type === 'INTEGER' || m.type === 'REAL') {
      const num = Number(v);
      if (!Number.isNaN(num)) {
        clauses.push(`${col} = ?`);
        params.push(num);
      }
    } else if (m.type === 'DATETIME') {
      clauses.push(`${col} LIKE ?`);
      params.push(`${v}%`);
    } else {
      clauses.push(`LOWER(CAST(${col} AS TEXT)) LIKE LOWER(?)`);
      params.push(`%${v}%`);
    }
  }
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

function mapRowToHeaders(row: Record<string, unknown>, mappings: ColumnMapping[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of mappings) {
    out[m.header] = row[m.column] ?? null;
  }
  return out;
}

// GET /api/projects/:projectId/data/meta
router.get('/:projectId/data/meta', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const active = getActiveVersion(projectId);
  const mappings = getHeaderMapping(projectId);
  if (!active || mappings.length === 0) {
    res.json({ headers: [], total: 0, activeVersion: null });
    return;
  }
  const table = dataTableName(projectId, active.version_number);
  const total = (getDb().prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c;
  res.json({
    headers: mappings.map((m) => ({ header: m.header, column: m.column, type: m.type })),
    total,
    activeVersion: active.version_number,
  });
});

// GET /api/projects/:projectId/data?sort=&order=&filters=&offset=&limit=
router.get('/:projectId/data', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const active = getActiveVersion(projectId);
  const mappings = getHeaderMapping(projectId);
  if (!active || mappings.length === 0) {
    res.json({ rows: [], total: 0, offset: 0, limit: 0 });
    return;
  }

  const table = dataTableName(projectId, active.version_number);
  const db = getDb();

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c;

  const sort = typeof req.query.sort === 'string' ? req.query.sort : '';
  const order = req.query.order === 'desc' ? 'DESC' : 'ASC';
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));

  let sortClause = '';
  if (sort) {
    const m = resolveColumn(mappings, sort);
    if (!m) {
      res.status(400).json({ error: `Unknown column: ${sort}` });
      return;
    }
    sortClause = ` ORDER BY "${m.column}" ${order} NULLS LAST, id ${order}`;
  }

  const filters = parseFilters(req.query.filters);
  const params: unknown[] = [];
  const whereClause = buildWhereClause(filters, mappings, params);

  const sql = `SELECT * FROM "${table}" ${whereClause}${sortClause} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  let rows: Record<string, unknown>[];
  try {
    rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Query failed.' });
    return;
  }

  res.json({
    rows: rows.map((r) => mapRowToHeaders(r, mappings)),
    total,
    offset,
    limit,
  });
});

export default router;

import { Router, type Request, type Response } from 'express';
import { getDb, dropDataTable } from '../db.js';
import { getVersions, getHeaderMapping } from '../services/tableService.js';

const router = Router();

interface ProjectListItem {
  id: number;
  name: string;
  description: string;
  headers: ReturnType<typeof getHeaderMapping>;
  activeVersion: number | null;
  created_at: string;
}

function toListItem(row: {
  id: number;
  name: string;
  description: string;
  headers: string;
  active_version_id: number | null;
  created_at: string;
}): ProjectListItem {
  let activeVersion: number | null = null;
  if (row.active_version_id != null) {
    const v = getDb()
      .prepare('SELECT version_number FROM versions WHERE id = ?')
      .get(row.active_version_id) as { version_number: number } | undefined;
    activeVersion = v ? v.version_number : null;
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    headers: getHeaderMapping(row.id),
    activeVersion,
    created_at: row.created_at,
  };
}

// GET /api/projects — list all projects
router.get('/', (_req: Request, res: Response) => {
  const rows = getDb()
    .prepare('SELECT * FROM projects ORDER BY created_at DESC, id DESC')
    .all() as Array<{
    id: number;
    name: string;
    description: string;
    headers: string;
    active_version_id: number | null;
    created_at: string;
  }>;
  res.json(rows.map(toListItem));
});

// POST /api/projects — create a project
router.post('/', (req: Request, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'Project name is required.' });
    return;
  }
  const result = getDb()
    .prepare('INSERT INTO projects (name, description) VALUES (?, ?)')
    .run(name, description);
  const row = getDb()
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(result.lastInsertRowid) as {
    id: number;
    name: string;
    description: string;
    headers: string;
    active_version_id: number | null;
    created_at: string;
  };
  res.status(201).json(toListItem(row));
});

// GET /api/projects/:id — project detail + versions
router.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as
    | {
        id: number;
        name: string;
        description: string;
        headers: string;
        active_version_id: number | null;
        created_at: string;
      }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  res.json({
    ...toListItem(row),
    versions: getVersions(id),
  });
});

// PATCH /api/projects/:id — update name / description
router.patch('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as
    | { id: number }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'Project name is required.' });
    return;
  }
  getDb().prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?').run(name, description, id);
  const updated = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as {
    id: number;
    name: string;
    description: string;
    headers: string;
    active_version_id: number | null;
    created_at: string;
  };
  res.json(toListItem(updated));
});

// DELETE /api/projects/:id — delete project (drop data tables first)
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as
    | { id: number }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const versions = getVersions(id);
  const dropAll = getDb().transaction(() => {
    for (const v of versions) {
      dropDataTable(id, v.version_number);
    }
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
  });
  dropAll();
  res.status(204).end();
});

export default router;

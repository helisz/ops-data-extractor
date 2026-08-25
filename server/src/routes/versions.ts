import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { getDb, dataTableName, dropDataTable } from '../db.js';
import { parseExcelFile } from '../services/excel.js';
import {
  createDataTable,
  getProject,
  getVersions,
  getHeaderMapping,
  type ColumnMapping,
} from '../services/tableService.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

/** Order-insensitive set comparison of trimmed header names. */
function headersMatch(parsed: string[], stored: ColumnMapping[]): boolean {
  const a = parsed.map((h) => h.trim()).sort();
  const b = stored.map((h) => h.header.trim()).sort();
  if (a.length !== b.length) return false;
  return a.every((h, i) => h === b[i]);
}

function headerDiff(parsed: string[], stored: ColumnMapping[]): { missing: string[]; extra: string[] } {
  const a = new Set(parsed.map((h) => h.trim()));
  const b = new Set(stored.map((h) => h.header.trim()));
  const missing = [...b].filter((h) => !a.has(h));
  const extra = [...a].filter((h) => !b.has(h));
  return { missing, extra };
}

// POST /api/projects/:projectId/versions — upload an Excel as a new version
router.post('/:projectId/versions', upload.single('file'), (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'An Excel file is required.' });
    return;
  }

  let parsed;
  try {
    parsed = parseExcelFile(req.file.buffer);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to parse the Excel file.' });
    return;
  }

  const db = getDb();
  const existingVersions = getVersions(projectId);
  const stored = getHeaderMapping(projectId);

  const isFirstVersion = existingVersions.length === 0;

  if (!isFirstVersion && !headersMatch(parsed.headers, stored)) {
    const { missing, extra } = headerDiff(parsed.headers, stored);
    const parts: string[] = [];
    if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
    if (extra.length) parts.push(`extra: ${extra.join(', ')}`);
    res.status(400).json({
      error: `Headers do not match the project schema (${parts.join('; ')}). Please re-upload a file with matching headers.`,
    });
    return;
  }

  let requiresActivation = false;

  if (isFirstVersion) {
    const versionNumber = 1;
    const result = db
      .prepare('INSERT INTO versions (project_id, version_number) VALUES (?, ?)')
      .run(projectId, versionNumber);
    const versionId = Number(result.lastInsertRowid);
    createDataTable(projectId, versionNumber, parsed);
    db.prepare('UPDATE projects SET active_version_id = ? WHERE id = ?').run(versionId, projectId);
    const version = db
      .prepare('SELECT * FROM versions WHERE id = ?')
      .get(versionId) as { id: number; project_id: number; version_number: number; created_at: string };
    res.status(201).json({
      version,
      headersMatch: true,
      activeVersion: versionNumber,
      requiresActivation: false,
    });
    return;
  }

  // Subsequent version
  const versionNumber = existingVersions[existingVersions.length - 1].version_number + 1;
  const result = db
    .prepare('INSERT INTO versions (project_id, version_number) VALUES (?, ?)')
    .run(projectId, versionNumber);
  const versionId = Number(result.lastInsertRowid);
  createDataTable(projectId, versionNumber, parsed);
  requiresActivation = true;

  const version = db
    .prepare('SELECT * FROM versions WHERE id = ?')
    .get(versionId) as { id: number; project_id: number; version_number: number; created_at: string };

  res.status(201).json({
    version,
    headersMatch: true,
    activeVersion: project.active_version_id
      ? (db.prepare('SELECT version_number FROM versions WHERE id = ?').get(project.active_version_id) as {
          version_number: number;
        }).version_number
      : null,
    requiresActivation,
  });
});

// POST /api/projects/:projectId/versions/:versionId/activate — set active version
router.post('/:projectId/versions/:versionId/activate', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const versionId = Number(req.params.versionId);

  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const version = getDb()
    .prepare('SELECT * FROM versions WHERE id = ? AND project_id = ?')
    .get(versionId, projectId) as { id: number; project_id: number; version_number: number; created_at: string } | undefined;
  if (!version) {
    res.status(404).json({ error: 'Version not found.' });
    return;
  }

  getDb().prepare('UPDATE projects SET active_version_id = ? WHERE id = ?').run(versionId, projectId);
  const updated = getProject(projectId)!;
  res.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    headers: getHeaderMapping(projectId),
    activeVersion: version.version_number,
    created_at: updated.created_at,
  });
});

// DELETE /api/projects/:projectId/versions/:versionId — delete a version
router.delete('/:projectId/versions/:versionId', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const versionId = Number(req.params.versionId);

  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const version = getDb()
    .prepare('SELECT * FROM versions WHERE id = ? AND project_id = ?')
    .get(versionId, projectId) as { id: number; project_id: number; version_number: number; created_at: string } | undefined;
  if (!version) {
    res.status(404).json({ error: 'Version not found.' });
    return;
  }

  const versions = getVersions(projectId);
  if (versions.length === 1) {
    res.status(400).json({ error: 'The only version of a project cannot be deleted.' });
    return;
  }
  if (project.active_version_id === versionId) {
    res.status(400).json({ error: 'The active version cannot be deleted. Activate another version first.' });
    return;
  }

  const dropAndDelete = getDb().transaction(() => {
    dropDataTable(projectId, version.version_number);
    getDb().prepare('DELETE FROM versions WHERE id = ?').run(versionId);
  });
  dropAndDelete();
  res.status(204).end();
});

export default router;

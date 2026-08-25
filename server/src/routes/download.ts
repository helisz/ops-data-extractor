import { Router, type Request, type Response } from 'express';
import { getDb, dataTableName } from '../db.js';
import {
  getProject,
  getActiveVersion,
  getHeaderMapping,
} from '../services/tableService.js';
import { buildXlsxBuffer } from '../services/excel.js';

const router = Router();

// GET /api/projects/:projectId/download — download the active version data as xlsx
router.get('/:projectId/download', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const active = getActiveVersion(projectId);
  const mappings = getHeaderMapping(projectId);
  if (!active || mappings.length === 0) {
    res.status(400).json({ error: 'This project has no data yet.' });
    return;
  }

  const table = dataTableName(projectId, active.version_number);
  const rows = getDb()
    .prepare(`SELECT * FROM "${table}"`)
    .all() as Record<string, unknown>[];

  const headers = mappings.map((m) => m.header);
  const outRows = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const m of mappings) {
      out[m.header] = r[m.column] ?? '';
    }
    return out;
  });

  const buffer = buildXlsxBuffer(headers, outRows);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="project-${projectId}-v${active.version_number}.xlsx"`,
  );
  res.send(buffer);
});

export default router;

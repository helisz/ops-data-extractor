import { Router, type Request, type Response } from 'express';
import { getDb, dataTableName } from '../db.js';
import {
  getProject,
  getActiveVersion,
  getHeaderMapping,
} from '../services/tableService.js';
import {
  askLlm,
  extractSql,
  validateAndExecuteSql,
  buildSystemPrompt,
  loadLlmSettings,
  type ExecutionResult,
} from '../services/llm.js';

const router = Router();

interface ChatMessageRow {
  id: number;
  project_id: number;
  role: string;
  content: string | null;
  sql_text: string | null;
  execution_meta: string | null;
  created_at: string;
}

function toMessage(row: ChatMessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sql: row.sql_text,
    execution: row.execution_meta ? JSON.parse(row.execution_meta) : null,
    created_at: row.created_at,
  };
}

// GET /api/projects/:projectId/chat — last 100 messages
router.get('/:projectId/chat', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const rows = getDb()
    .prepare(
      `SELECT * FROM chat_messages WHERE project_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 100`,
    )
    .all(projectId) as ChatMessageRow[];
  res.json(rows.reverse().map(toMessage));
});

// POST /api/projects/:projectId/chat — ask a question
router.post('/:projectId/chat', async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const message = String(req.body?.message ?? '').trim();
  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const active = getActiveVersion(projectId);
  const mappings = getHeaderMapping(projectId);
  if (!active || mappings.length === 0) {
    res.status(400).json({ error: 'This project has no data yet. Upload an Excel file first.' });
    return;
  }
  const settings = loadLlmSettings();
  if (!settings) {
    res.status(400).json({ error: 'LLM is not configured. Set base URL, API key and model in Configuration.' });
    return;
  }

  const db = getDb();
  const tableName = dataTableName(projectId, active.version_number);

  // Persist the user message.
  db.prepare('INSERT INTO chat_messages (project_id, role, content) VALUES (?, ?, ?)').run(
    projectId,
    'user',
    message,
  );

  let assistantText = '';
  let sql: string | null = null;
  let execution: { status: string; rowCount?: number; durationMs?: number; error?: string } = {
    status: 'pending',
  };
  let result: ExecutionResult | null = null;

  try {
    const prompt = `${buildSystemPrompt(project.name, tableName, mappings)}\n\nUser question:\n${message}`;
    assistantText = await askLlm(prompt, settings);
    sql = extractSql(assistantText) || extractSql(message) || null;

    if (!sql) {
      execution = { status: 'error', error: 'No SQL could be extracted from the LLM response.' };
    } else {
      const executed = validateAndExecuteSql(sql, tableName, mappings);
      if ('error' in executed) {
        execution = { status: 'error', error: executed.error };
      } else {
        result = executed;
        execution = {
          status: 'ok',
          rowCount: executed.rowCount,
          durationMs: executed.durationMs,
        };
      }
    }
  } catch (err) {
    assistantText = '';
    execution = {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Persist the assistant message.
  db.prepare(
    'INSERT INTO chat_messages (project_id, role, content, sql_text, execution_meta) VALUES (?, ?, ?, ?, ?)',
  ).run(
    projectId,
    'assistant',
    assistantText,
    sql,
    JSON.stringify(execution),
  );

  // Prune to the latest 100 messages for this project.
  db.prepare(
    `DELETE FROM chat_messages WHERE project_id = ? AND id NOT IN (
       SELECT id FROM chat_messages WHERE project_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 100
     )`,
  ).run(projectId, projectId);

  res.json({
    assistantText,
    sql,
    execution,
    result: result ? { columns: result.columns, rows: result.rows } : null,
  });
});

export default router;

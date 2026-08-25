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
  result_data: string | null;
  created_at: string;
}

function toMessage(row: ChatMessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sql: row.sql_text,
    execution: row.execution_meta ? JSON.parse(row.execution_meta) : null,
    result: row.result_data ? JSON.parse(row.result_data) : null,
    created_at: row.created_at,
  };
}

function getProjectOr404(projectId: number, res: Response) {
  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return null;
  }
  return project;
}

// POST /api/projects/:projectId/chat/sessions — start a new chat session
router.post('/:projectId/chat/sessions', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const project = getProjectOr404(projectId, res);
  if (!project) return;
  const result = getDb()
    .prepare('INSERT INTO chat_sessions (project_id) VALUES (?)')
    .run(projectId);
  const row = getDb()
    .prepare('SELECT id, created_at FROM chat_sessions WHERE id = ?')
    .get(result.lastInsertRowid) as { id: number; created_at: string };
  res.status(201).json(row);
});

// GET /api/projects/:projectId/chat/sessions — list chat sessions (newest first)
router.get('/:projectId/chat/sessions', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const project = getProjectOr404(projectId, res);
  if (!project) return;
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.created_at, COUNT(m.id) AS message_count
       FROM chat_sessions s
       LEFT JOIN chat_messages m ON m.session_id = s.id
       WHERE s.project_id = ?
       GROUP BY s.id
       ORDER BY s.created_at DESC, s.id DESC`,
    )
    .all(projectId) as Array<{ id: number; created_at: string; message_count: number }>;
  res.json(rows);
});

// GET /api/projects/:projectId/chat/sessions/:sessionId — messages of one session
router.get('/:projectId/chat/sessions/:sessionId', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const sessionId = Number(req.params.sessionId);
  const project = getProjectOr404(projectId, res);
  if (!project) return;
  const session = getDb()
    .prepare('SELECT id FROM chat_sessions WHERE id = ? AND project_id = ?')
    .get(sessionId, projectId);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  const rows = getDb()
    .prepare(
      `SELECT * FROM chat_messages WHERE session_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .all(sessionId) as ChatMessageRow[];
  res.json(rows.map(toMessage));
});

// DELETE /api/projects/:projectId/chat/sessions/:sessionId — delete a session
router.delete('/:projectId/chat/sessions/:sessionId', (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const sessionId = Number(req.params.sessionId);
  const project = getProjectOr404(projectId, res);
  if (!project) return;
  const session = getDb()
    .prepare('SELECT id FROM chat_sessions WHERE id = ? AND project_id = ?')
    .get(sessionId, projectId);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  // Messages cascade via FK ON DELETE CASCADE.
  getDb().prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);
  res.status(204).end();
});

// GET /api/projects/:projectId/chat — last 100 messages (legacy flat history)
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
  const sessionId = req.body?.sessionId ? Number(req.body.sessionId) : null;
  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  const project = getProjectOr404(projectId, res);
  if (!project) return;
  // Validate the session belongs to this project when provided.
  if (sessionId != null) {
    const session = getDb()
      .prepare('SELECT id FROM chat_sessions WHERE id = ? AND project_id = ?')
      .get(sessionId, projectId);
    if (!session) {
      res.status(400).json({ error: 'Invalid chat session.' });
      return;
    }
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
  db.prepare(
    'INSERT INTO chat_messages (project_id, role, content, session_id) VALUES (?, ?, ?, ?)',
  ).run(projectId, 'user', message, sessionId);

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

  // Persist the assistant message (including query result for history).
  db.prepare(
    'INSERT INTO chat_messages (project_id, role, content, sql_text, execution_meta, result_data, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    projectId,
    'assistant',
    assistantText,
    sql,
    JSON.stringify(execution),
    result ? JSON.stringify({ columns: result.columns, rows: result.rows }) : null,
    sessionId,
  );

  // Prune to the latest 100 messages for this session (or project when no session).
  if (sessionId != null) {
    db.prepare(
      `DELETE FROM chat_messages WHERE session_id = ? AND id NOT IN (
         SELECT id FROM chat_messages WHERE session_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 100
       )`,
    ).run(sessionId, sessionId);
  } else {
    db.prepare(
      `DELETE FROM chat_messages WHERE project_id = ? AND session_id IS NULL AND id NOT IN (
         SELECT id FROM chat_messages WHERE project_id = ? AND session_id IS NULL
         ORDER BY created_at DESC, id DESC LIMIT 100
       )`,
    ).run(projectId, projectId);
  }

  res.json({
    assistantText,
    sql,
    execution,
    result: result ? { columns: result.columns, rows: result.rows } : null,
  });
});

export default router;

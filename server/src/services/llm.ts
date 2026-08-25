import { getDb, dataTableName } from '../db.js';
import type { ColumnMapping } from './tableService.js';

export interface LlmSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ExecutionResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

export interface ExecutionFailure {
  error: string;
}

/**
 * Normalize the configured base URL. A trailing slash is removed; a `/v1`
 * segment is never added or stripped — the endpoint is always
 * `{baseUrl}/chat/completions`.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/**
 * Call an OpenAI-compatible chat completions endpoint and return the
 * assistant's text content.
 */
export async function askLlm(
  prompt: string,
  settings: LlmSettings,
): Promise<string> {
  const { baseUrl, apiKey, model } = settings;
  if (!baseUrl || !apiKey || !model) {
    throw new Error('LLM is not configured. Set base URL, API key and model in Configuration.');
  }

  const url = `${normalizeBaseUrl(baseUrl)}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 1500,
      }),
    });
  } catch (err) {
    throw new Error(
      `Failed to reach the LLM endpoint: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM request failed (HTTP ${res.status}): ${body.slice(0, 500)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error('LLM returned an invalid JSON response.');
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned no content.');
  }
  return content;
}

/** Extract the first SQL statement from an LLM response. */
export function extractSql(content: string): string | null {
  // Fenced sql block
  const fenceMatch = content.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1].trim()) {
    return fenceMatch[1].trim();
  }
  // First line starting with SELECT
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    if (/^SELECT\b/i.test(line)) {
      return line;
    }
  }
  return null;
}

/** Strip string literals and comments so keyword checks don't false-positive. */
function stripLiteralsAndComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``');
}

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|REPLACE)\b/i;

/**
 * Validate that sql is a single SELECT statement, then execute it against
 * the given data table, capped at 1000 result rows.
 */
export function validateAndExecuteSql(
  sql: string,
  tableName: string,
  headers: ColumnMapping[],
): ExecutionResult | ExecutionFailure {
  // LLMs often wrap the statement with a trailing semicolon; strip it before
  // validation so a single SELECT still passes the single-statement check.
  const cleaned = sql.trim().replace(/;+\s*$/, '');
  if (!/^SELECT\b/i.test(cleaned)) {
    return { error: 'The generated SQL is not a SELECT statement.' };
  }
  const stripped = stripLiteralsAndComments(cleaned);
  if (FORBIDDEN_KEYWORDS.test(stripped)) {
    return { error: 'The generated SQL contains a forbidden statement.' };
  }
  if ((stripped.match(/;/g) || []).length > 0) {
    return { error: 'Only a single SQL statement is allowed.' };
  }

  const db = getDb();
  const wrapped = `SELECT * FROM ( ${cleaned} ) LIMIT 1000`;
  const start = performance.now();
  let stmt: ReturnType<typeof db.prepare>;
  try {
    stmt = db.prepare(wrapped);
  } catch (err) {
    return { error: `Invalid SQL: ${err instanceof Error ? err.message : String(err)}` };
  }

  let rows: Record<string, unknown>[];
  try {
    // better-sqlite3 requires `this` bound to the statement; call via bind so
    // the method's receiver is preserved (avoids "Illegal invocation").
    rows = (stmt.all.bind(stmt) as unknown as () => Record<string, unknown>[])();
  } catch (err) {
    return { error: `SQL execution failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  const columns = rows.length > 0 ? Object.keys(rows[0]) : headers.map((h) => h.column);
  return { columns, rows, rowCount: rows.length, durationMs };
}

/** Build the system prompt describing the data table and schema. */
export function buildSystemPrompt(
  projectName: string,
  tableName: string,
  headers: ColumnMapping[],
): string {
  const schema = headers
    .map((h) => `- "${h.column}" (${h.type}) — user-facing header: "${h.header}"`)
    .join('\n');
  return `You are a SQL generation assistant for a data management application.

The active data table is named "${tableName}" and belongs to the project "${projectName}".
Its columns are:
${schema}

Rules:
- Return ONLY a single SELECT SQL statement, with no extra explanation.
- Use the column names exactly as listed (double-quote them).
- The user refers to columns by their user-facing headers; map them to the column names above.
- Do not use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, ATTACH, PRAGMA or multiple statements.
- You may use WHERE, GROUP BY, ORDER BY, JOINs and SQLite functions.
- Wrap the final statement in a markdown code block with \`\`\`sql.`;
}

/**
 * Convenience: load the current LLM settings from the settings table.
 */
export function loadLlmSettings(): LlmSettings | null {
  const db = getDb();
  const get = (key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : '';
  };
  const baseUrl = get('llm_base_url');
  const apiKey = get('llm_api_key');
  const model = get('llm_model');
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl, apiKey, model };
}

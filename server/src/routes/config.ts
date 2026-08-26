import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import { listModels } from '../services/llm.js';

const CONFIG_PASSWORD = process.env.CONFIG_PASSWORD || 'Abc123de';

/** In-memory set of issued config tokens. */
const tokens = new Set<string>();

/**
 * Issue a fresh token for a verified password. Expiry is not enforced
 * server-side (tokens live for the process lifetime).
 */
export function issueToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(token);
  return token;
}

/** Express middleware requiring a valid Bearer token. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !tokens.has(token)) {
    res.status(401).json({ error: 'Unauthorized. A valid configuration token is required.' });
    return;
  }
  next();
}

export { CONFIG_PASSWORD };

const router = Router();

// POST /api/config/verify — verify password, return a token
router.post('/verify', (req: Request, res: Response) => {
  const password = String(req.body?.password ?? '');
  if (password !== CONFIG_PASSWORD) {
    res.status(401).json({ error: 'Incorrect password.' });
    return;
  }
  res.json({ token: issueToken() });
});

// GET /api/config — read settings (never expose the API key)
router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = req.app.locals.db as import('better-sqlite3').Database;
  const get = (key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : '';
  };
  const apiKey = get('llm_api_key');
  res.json({
    baseUrl: get('llm_base_url'),
    model: get('llm_model'),
    hasApiKey: apiKey.length > 0,
  });
});

// PUT /api/config — upsert settings
router.put('/', requireAuth, (req: Request, res: Response) => {
  const db = req.app.locals.db as import('better-sqlite3').Database;
  const { baseUrl, apiKey, model } = (req.body ?? {}) as {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const tx = db.transaction(() => {
    if (typeof baseUrl === 'string') upsert.run('llm_base_url', baseUrl.trim());
    if (typeof model === 'string') upsert.run('llm_model', model.trim());
    if (typeof apiKey === 'string' && apiKey.trim() !== '') upsert.run('llm_api_key', apiKey.trim());
  });
  tx();

  const get = (key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : '';
  };
  res.json({
    baseUrl: get('llm_base_url'),
    model: get('llm_model'),
    hasApiKey: get('llm_api_key').length > 0,
  });
});

// POST /api/config/models — fetch available model IDs from the provider.
// Uses the baseUrl/apiKey supplied in the request body (not the stored
// values), so the user can probe a configuration before saving it.
router.post('/models', requireAuth, async (req: Request, res: Response) => {
  const { baseUrl, apiKey } = (req.body ?? {}) as { baseUrl?: string; apiKey?: string };
  if (!baseUrl || !apiKey) {
    res.status(400).json({ error: 'Base URL and API key are required.' });
    return;
  }
  try {
    const models = await listModels(baseUrl, apiKey);
    res.json({ models });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to fetch models.',
    });
  }
});

export default router;

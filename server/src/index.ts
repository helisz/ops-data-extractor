import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initDb, getDb } from './db.js';
import projectsRouter from './routes/projects.js';
import versionsRouter from './routes/versions.js';
import dataRouter from './routes/data.js';
import downloadRouter from './routes/download.js';
import configRouter from './routes/config.js';
import chatRouter from './routes/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const db = initDb();
  const app = express();
  app.locals.db = db;

  // Disable ETag generation — it causes 304 Not Modified responses which
  // prevent the browser from fetching fresh API data (chat history etc.).
  app.set('etag', false);

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // Disable caching for all API responses — chat data must always be fresh.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Feature routers
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects', versionsRouter);
  app.use('/api/projects', dataRouter);
  app.use('/api/projects', downloadRouter);
  app.use('/api/config', configRouter);
  app.use('/api/projects', chatRouter);

  // Static serving of the built frontend (production)
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA fallback: send index.html for non-/api GET requests
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return app;
}

// Only start listening when run directly (not when imported by tests).
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain) {
  const port = Number(process.env.PORT) || 3001;
  const app = createApp();
  getDb(); // ensure initialized
  app.listen(port, '0.0.0.0', () => {
    console.log(`[server] API listening on http://0.0.0.0:${port}`);
  });
}

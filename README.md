# ops-data-extractor

A data management web application for storing, versioning, browsing and querying Excel data per project.

- **Data Management** — create projects, upload Excel (xls/xlsx) to define the structure and seed the data, manage versions (upload / header validation / activate / delete), sort & filter, key-value filtering, async loading for >100 rows, download the current data as xlsx.
- **Data Query** — open a project in **Browse** mode (sortable/filterable table) or **Ask** mode (AI chat: natural language → SQL → executed result table, with a 100-message history per project).
- **Configuration** — password-protected page (`Abc123de`) for LLM settings (base URL / API key / model) used by Ask mode.

The UI follows a strict **Minimalist Monochrome** design system: pure black & white, zero border radius, no shadows, serif display headlines, self-hosted fonts, instant 100ms transitions, and WCAG AAA focus states.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vue 3 (`<script setup lang="ts">`) + Vite + TypeScript, hand-rolled components (no UI library), SCSS + CSS custom-property design tokens, self-hosted fonts via `@fontsource` |
| Backend | Node.js + TypeScript (ESM) + Express |
| Database | SQLite via `better-sqlite3` (WAL mode; file stored at `data/app.db`, gitignored) |
| Excel | SheetJS (`xlsx`) for parsing and generating xls/xlsx |
| LLM | OpenAI-compatible Chat Completions API (configurable base URL + API key + model) |
| Container | Docker (multi-stage `node:22-slim`, `docker compose up -d --build`) |

---

## Prerequisites

- **Node.js ≥ 22** and **npm ≥ 10** (for local dev; not needed if running via Docker)
- **Docker** (optional, recommended for other environments) — `docker compose up -d --build`
- No other global tooling required — SQLite is embedded via `better-sqlite3` v13 (N-API prebuilt binaries, no native toolchain).

---

## Setup

```bash
npm install
```

This installs dependencies for both `server/` and `web/` workspaces (hoisted to the root `node_modules`).

---

## How to Run

### 1. Development mode (hot reload)

```bash
npm run dev
```

- Starts the backend with `tsx watch` on **http://localhost:3001**
- Starts the Vite dev server on **http://localhost:5173**
- Vite proxies `/api/*` to the backend, so the frontend works out of the box

Open **http://localhost:5173**.

### 2. Production mode

```bash
npm run build   # builds web/ (Vite) and server/ (tsc)
npm start       # NODE_ENV=production node server/dist/index.js
```

The backend serves the built frontend from `web/dist` (with SPA fallback) and the API under `/api`.

Open **http://localhost:3001**.

### 3. Docker (recommended for other environments)

Build and run with Docker Compose:

```bash
docker compose up -d --build
```

Open **http://localhost:3333**.

The container is a self-contained multi-stage build:
- Builder stage installs deps (`--ignore-scripts`, since `better-sqlite3` v13 ships prebuilt binaries) and runs `npm run build`
- Runner stage (`node:22-slim`) runs only `node server/dist/index.js`, serving both the API and the built frontend

Configuration via environment variables in `docker-compose.yml`:

| Variable | Default | Description |
| --- | --- | --- |
| `CONFIG_PASSWORD` | `Abc123de` | Password to unlock the Configuration page |
| `PORT` | `3001` | Port the backend listens on |
| `DB_PATH` | `/app/data/app.db` | SQLite database file path (inside the container) |

SQLite data is persisted in a named volume (`app-data` → `/app/data`).

To build and run without Compose:

```bash
docker build -t ops-data-extractor .
docker run -d -p 3333:3001 -e CONFIG_PASSWORD=yourpass -v ops-data:/app/data ops-data-extractor
```

### 4. Other useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend dev servers concurrently |
| `npm run build` | Build web (`vite build`) then server (`tsc -p tsconfig.json`) |
| `npm start` | Start the production server (serves API + built frontend) |
| `npm run typecheck` | Type-check both workspaces |
| `npm run typecheck -w server` | Type-check the backend only |
| `npm run typecheck -w web` | Type-check the frontend only (`vue-tsc`) |

---

## Configuration (Environment Variables)

Set these in your shell or a `.env` file in the project root (loaded by the backend via `dotenv`).

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Backend HTTP port (production) |
| `DB_PATH` | `data/app.db` | SQLite database file location (created on first run) |
| `CONFIG_PASSWORD` | `Abc123de` | Password for the Configuration page (LLM settings gate) |

Example:

```bash
PORT=3001 DB_PATH=data/app.db CONFIG_PASSWORD=Abc123de npm start
```

> **Note:** LLM credentials (`baseUrl` / `apiKey` / `model`) are **not** environment variables — they are stored in the database and managed from the **Configuration** page in the UI.

---

## Usage Walkthrough

1. **Home** (`/`) — choose **Data Management** (manage projects & data) or **Data Query** (browse/ask), or jump to **Configuration**.

2. **Data Management** (`/manage`)
   - **Create project** → give it a name (optional description).
   - **Upload Excel** → the first upload defines the project structure (headers + inferred column types) and becomes **version 1**, activated automatically.
   - **Upload another version** → headers are validated against the project schema:
     - Mismatched headers → error listing missing/extra columns.
     - Matching headers → activation prompt; **Activate** to make it the active version.
   - **Versions** — delete a non-active version (the active / only version cannot be deleted).
   - The embedded table supports **column sorting**, **per-column filters**, a **key-value filter** panel, **async chunked loading** for >100 rows (scroll to load more with a progress indicator), and **Download** (current active version as xlsx).

3. **Data Query** (`/query`)
   - Select a project, then switch between **Browse** (same sortable/filterable table + download) and **Ask**.
   - **Ask mode**: type a natural-language question. The app calls the configured LLM to generate SQL, validates it (SELECT-only, single statement, forbidden keywords rejected), executes it against the active version's data, and renders the result table. History (last 100 messages per project) persists across reloads.

4. **Configuration** (`/config`)
   - Unlock with the password (`Abc123de` by default; token is kept for the session).
   - Set the LLM **base URL**, **API key**, **model** (OpenAI-compatible). Example: `https://api.openai.com/v1` with model `gpt-4o-mini`. The API key is write-only — it is never returned by the API.
   - **Fetch models** button — after entering base URL and API key, click Fetch models to pull the available model list from the provider's `/models` endpoint and pick from a dropdown instead of typing the model name manually.
   - **Lock** clears the session token.

---

## Project Structure

```
.
├── package.json          # npm workspaces (server + web), root scripts
├── Dockerfile             # multi-stage build (builder + node:22-slim runner)
├── docker-compose.yml     # single-service compose with data volume
├── .dockerignore
├── server/
│   ├── src/
│   │   ├── index.ts          # Express app, static serving + SPA fallback
│   │   ├── db.ts             # SQLite connection + schema (projects/versions/settings/chat_messages)
│   │   ├── routes/           # projects, versions, data, download, config, chat
│   │   └── services/         # excel (parse/build), tableService (schema provisioning), llm (LLM + SQL validation/execution)
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── main.ts           # fonts + global styles, pinia, router
│   │   ├── App.vue           # header/nav, skip-link, router-view
│   │   ├── api/              # typed API client (axios)
│   │   ├── components/       # DataTable, ChatPanel, ui/ primitives (AppButton, AppInput, ...)
│   │   ├── styles/           # tokens.scss (design tokens) + global.scss
│   │   ├── views/            # Home, Manage, Query, Config
│   │   └── router/
│   └── vite.config.ts        # /api proxy → localhost:3001, @ alias
└── data/                     # SQLite database (created at runtime, gitignored)
```

---

## API Overview

All endpoints are under `/api` (the frontend dev proxy forwards them to port 3001).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET / POST | `/api/projects` | List / create projects |
| GET / DELETE | `/api/projects/:id` | Project detail (+versions) / delete project (drops its data tables) |
| POST | `/api/projects/:id/versions` | Upload Excel (`multipart/form-data`, field `file`) — v1 auto-activates; later versions validate headers and require activation |
| POST | `/api/projects/:id/versions/:versionId/activate` | Activate a version |
| DELETE | `/api/projects/:id/versions/:versionId` | Delete a non-active version |
| GET | `/api/projects/:id/data/meta` | Active version headers + total row count |
| GET | `/api/projects/:id/data` | Query: `sort`, `order=asc\|desc`, `filters` (JSON object `{"column":"value"}`), `offset`, `limit` |
| GET | `/api/projects/:id/download` | Download the active version as xlsx |
| POST | `/api/config/verify` | Unlock with `{password}` → token |
| GET / PUT | `/api/config` | Read / save LLM settings (Bearer token required; apiKey never exposed on read) |
| POST | `/api/config/models` | Fetch available model IDs from the provider (Bearer token + `{baseUrl, apiKey}` in body) |
| POST | `/api/projects/:id/chat` | Ask a question `{message}` → LLM → SQL → executed result |
| GET | `/api/projects/:id/chat` | Last 100 chat messages for the project |

---

## Troubleshooting

- **Port already in use (3001 / 5173)** — stop the existing process:
  ```bash
  lsof -ti:3001 | xargs kill    # macOS / Linux
  ```
- **SQLite native module issues after a Node upgrade** — `better-sqlite3` 13.x ships N-API prebuilt binaries bundled in the package, so no native toolchain is required. On older Node, or if you previously pinned 11.x, rebuild/upgrade it:
  ```bash
  npm install better-sqlite3@^13 -w server
  # or, when a prebuilt is already available: npm rebuild better-sqlite3
  ```
  If you still see `node-gyp` / `Could not find any Visual Studio` errors, you are on a version that falls back to source compilation. Either upgrade `better-sqlite3` to 13.x (no compiler needed) or install the "Desktop development with C++" workload of Visual Studio Build Tools.
- **Ask mode reports "LLM is not configured"** — open **Configuration**, unlock with the password, and set base URL / API key / model.
- **Upload says headers don't match** — the project schema is fixed by the first version; subsequent uploads must use the exact same column headers.
- **Data seems missing after a project delete** — deletion intentionally drops the project's data tables and chat history; this is not recoverable.

---

## License

Private/internal project.

# Implementation Tasks: build-data-management-webapp

## Global Requirements (apply to all tasks)
- All user-facing UI text (labels, buttons, dialogs, messages) and all backend error messages MUST be in English.
- No pagination: tables render all rows when total ≤ 100; when > 100 rows, data loads asynchronously in chunks with a loading indicator.
- Every version and every chat message must persist a creation timestamp and display it to the user.
- **Design system (style.md — Minimalist Monochrome, non-negotiable):**
  - Colors: only `#FFFFFF` (background) and `#000000` (foreground/accent); grays `#F5F5F5` (muted), `#525252` (muted-foreground), `#E5E5E5` (light borders) for secondary text/dividers only. No other colors, no gradients.
  - Typography: Playfair Display for display/headlines, Source Serif 4 for body, JetBrains Mono for labels/metadata/SQL/timestamps. All self-hosted via @fontsource. Headlines `tracking-tight`; UI chrome labels uppercase `tracking-widest` mono.
  - `border-radius: 0` everywhere (every element, no exceptions). No box-shadows anywhere.
  - Line-based visuals: hairline `1px #E5E5E5` row/dividers; black borders 1–2px on cards/inputs/buttons; thick 4px black rules between major sections (ultra 8px where maximum impact is needed).
  - Buttons: primary = black bg / white text / uppercase / tracking-widest / rectangular; outline = transparent + 2px black border; ghost = transparent text link with instant underline on hover; hover = color inversion; transitions ≤ 100ms (instant feel). Links: instant underline on hover, border appears/thickens on focus-visible. Focus-visible = 3px solid black outline with 3px offset on all interactive elements.
  - Inputs: white bg, 2px black border (bottom or full), no radius, italic gray placeholder, focus thickens border to 4px.
  - Emphasis via color inversion (black bg / white text) and border-weight variation — never shadows.
  - Subtle texture overlays (very low opacity: horizontal-line, grid, and global noise patterns per style.md) for editorial depth; textures are required to avoid a flat, generic look.
  - Layout: content container max-width 72rem (1152px) with generous whitespace; CSS Grid for layout; thick black rules between major sections.
  - Responsive: sharp corners + pure B&W preserved on mobile; oversized headlines scale down (e.g., 8xl → 5xl); columns stack vertically; borders become full-width horizontal rules.
  - Iconography (if used): outlined thin-stroke icons, always black, ~20/24px, no filled or colored icons.
  - Typography as graphics: at least one oversized display headline (8xl on desktop, 5xl on mobile) on the Home page hero.
  - Motion: instant/binary 0–100ms transitions only; no bouncy/gradient animations.
  - Accessible: WCAG AAA black-on-white, visible focus states, ≥44px touch targets, and a visible skip-link at the top of each page.

## Requirement Traceability (requirement.md → tasks)
| requirement.md | Covered by |
|---|---|
| English UI, maintainable/migratable stack, suitable DB | 1.1–1.3, 1.12 (Global Requirements) |
| Mode selection: Data Management / Data Query / Config page | 1.16 |
| Create projects; set name & description | 1.5, 1.19 |
| Show project name, description, headers on selection | 1.5, 1.19 |
| Excel upload defines structure + initializes data | 1.4, 1.6, 1.19 |
| Open project, show data: sort/filter, no pagination, async >100 rows | 1.7, 1.18 |
| Download current data as xlsx | 1.8, 1.18 |
| Add version: upload Excel, validate headers match, reject & re-upload on mismatch | 1.6, 1.19 |
| Select active version; prompt on new version + remind active version | 1.6, 1.19 |
| Delete version; record version creation time | 1.3, 1.6, 1.19 |
| Key-value filter on current data | 1.7, 1.18 |
| Data Query: open project from list; Browse/Ask mode switch | 1.20 |
| Browse mode: show project, sort/filter, no pagination, async, download | 1.18, 1.20 |
| Ask mode: chat dialog (input bottom, output top) | 1.20 |
| Ask mode: LLM → SQL → execute → table result | 1.10, 1.11, 1.20 |
| Ask mode: show conversion text, SQL, execution, result | 1.20 |
| Ask mode: persist 100 Q&A history records with timestamps | 1.3, 1.11, 1.20 |
| Config: password gate (Abc123de) | 1.9, 1.17 |
| Config: LLM key/URL/model settings | 1.9, 1.17 |
| Minimalist Monochrome design system (style.md) | 1.12–1.21 (Global Requirements) |

## Implementation

- [ ] 1.1 Scaffold monorepo workspace
     [Target] `./package.json`, `./.gitignore`, `./README.md` (repo root)
     [Purpose] Establish npm workspaces monorepo with `server/` and `web/` packages and unified scripts
     [Method] Create root `package.json` with `"workspaces": ["server", "web"]`, private: true, scripts `dev` (run server+web concurrently), `build`, `start`. Add `.gitignore` (node_modules, dist, data/*.db, .env). Add minimal README with setup/run instructions.
     [Dependencies] None
     [Changes]
        - Create root `package.json` with workspaces and scripts
        - Create `.gitignore`
        - Create `README.md`

- [ ] 1.2 Scaffold backend package (Express + TypeScript)
     [Target] `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`
     [Purpose] Bootstrap a runnable Express + TypeScript backend with API prefix `/api`
     [Method] Create server package with deps: express, cors, better-sqlite3, multer, xlsx, dotenv; devDeps: typescript, tsx, @types/express, @types/cors, @types/better-sqlite3, @types/multer, @types/node. tsconfig with strict mode + ESM-compatible output. index.ts creates the Express app, registers `express.json()`, `cors()`, a health route `GET /api/health`, and listens on PORT (default 3001).
     [Dependencies] 1.1
     [Changes]
        - Create `server/package.json`
        - Create `server/tsconfig.json`
        - Create `server/src/index.ts` with app bootstrap + health endpoint

- [ ] 1.3 Implement SQLite database layer
     [Target] `server/src/db.ts` (schema defined inline in this file)
     [Purpose] Provide a single shared SQLite connection and create the metadata tables
     [Method] Use better-sqlite3 to open `data/app.db` (create dir if missing, path from env `DB_PATH` default `data/app.db`). Create tables: `projects(id INTEGER PK AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', headers TEXT NOT NULL DEFAULT '[]', active_version_id INTEGER, created_at TEXT DEFAULT (datetime('now')))`, `versions(id INTEGER PK AUTOINCREMENT, project_id INTEGER NOT NULL, version_number INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(project_id, version_number), FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)`, `settings(key TEXT PRIMARY KEY, value TEXT)`, `chat_messages(id INTEGER PK AUTOINCREMENT, project_id INTEGER NOT NULL, role TEXT NOT NULL, content TEXT, sql_text TEXT, execution_meta TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)`. Enable WAL mode and foreign keys.
     [Dependencies] 1.2
     [Changes]
        - Create `server/src/db.ts` exporting the database instance + init function
        - Define and execute schema creation for projects/versions/settings/chat_messages

- [ ] 1.4 Implement Excel import/export service
     [Target] `server/src/services/excel.ts`
     [Purpose] Parse uploaded xls/xlsx files (headers + rows) and generate xlsx buffers for download; also sanitize headers into safe SQL column names
     [Method] Use SheetJS `xlsx` package. Import: `read` file buffer → first worksheet → `sheet_to_json(header:1)` → return `{ headers: string[], rows: object[] }`; normalize empty/duplicate headers by suffixing. Export: build `aoa_to_sheet` from headers+rows and `write` with `bookType: 'xlsx'`, `type: 'buffer'`. Provide `sanitizeColumnName(header)` that maps header → valid SQLite identifier (replace non [A-Za-z0-9_] with `_`, prefix `c_` if starts with digit, dedupe with numeric suffix) and `inferColumnType(values[])` returning 'TEXT' | 'INTEGER' | 'REAL' | 'DATETIME' by sampling non-empty values.
     [Dependencies] 1.2
     [Changes]
        - Create `server/src/services/excel.ts` with parseExcelFile, buildXlsxBuffer, sanitizeColumnName, inferColumnType functions

- [ ] 1.5 Implement project CRUD routes
     [Target] `server/src/routes/projects.ts`
     [Purpose] Create/list/get/delete projects with their header metadata
     [Method] Routes under `/api/projects`: `GET /` (list all projects with id, name, description, headers, active version number, created_at), `POST /` (body {name, description} → insert project with empty headers, return created project), `GET /:id` (project detail + versions list), `DELETE /:id` (delete project; dependent version data tables must be dropped before row deletion). Register router in index.ts.
     [Dependencies] 1.3, 1.4
     [Changes]
        - Create `server/src/routes/projects.ts` with list/create/get/delete handlers
        - Register the router in `server/src/index.ts`

- [ ] 1.6 Implement version management + data table provisioning
     [Target] `server/src/routes/versions.ts`, `server/src/services/tableService.ts`
     [Purpose] Support uploading an Excel as a new version, validating headers match the project's schema, activating a version, and deleting versions
     [Method] New `tableService.ts` with `createDataTable(projectId, versionNumber, headers, rows)`: builds table `data_p{projectId}_v{versionNumber}` with `id INTEGER PRIMARY KEY AUTOINCREMENT` + one column per sanitized header with inferred type, inserts all rows, and records the header mapping (original header ↔ column name) in `projects.headers` JSON (only set on first version). Versions routes: `POST /:projectId/versions` (multer single file 'file' → parse excel → if project has no versions: create version 1, provision table, set headers, set active_version_id; else compare parsed headers to stored headers (order-insensitive set comparison of trimmed header names); mismatch → 400 with clear error message listing differences; match → create next version number, provision table) returning `{ version, headersMatch: true, activeVersion }`; `POST /:projectId/versions/:versionId/activate` (set active_version_id, return updated project); `DELETE /:projectId/versions/:versionId` (refuse if it is the active version or the only version → 400 with message; else drop the data table and delete the version row). If the new version is created but not activated, response must include `requiresActivation: true` so the UI can prompt.
     [Dependencies] 1.3, 1.4, 1.5
     [Changes]
        - Create `server/src/services/tableService.ts`
        - Create `server/src/routes/versions.ts` with upload/activate/delete handlers
        - Register versions router in `server/src/index.ts`

- [ ] 1.7 Implement data query API (sort/filter/async loading)
     [Target] `server/src/routes/data.ts`
     [Purpose] Serve the active version's rows with column sorting, key-value filtering, and offset-based chunk loading for large datasets
     [Method] Routes under `/api/projects/:projectId/data`: `GET /meta` → `{ headers: [{header, column, type}], total: number, activeVersion: number }`; `GET /` with query params `sort` (column name), `order` ('asc'|'desc'), `filters` (JSON object column→value: TEXT columns matched case-insensitively via LIKE contains, INTEGER/REAL via numeric equality, DATETIME via prefix match), `offset`, `limit` → executes `SELECT` on the active version's table with optional `ORDER BY "col"` and `LIMIT/OFFSET`, maps rows back to original headers, returns `{ rows, total, offset, limit }`. All identifiers must be quoted with double quotes and column names validated against the stored header mapping (reject unknown columns).
     [Dependencies] 1.6
     [Changes]
        - Create `server/src/routes/data.ts` with meta + rows handlers
        - Register data router in `server/src/index.ts`

- [ ] 1.8 Implement data download endpoint
     [Target] `server/src/routes/download.ts`
     [Purpose] Let users download the current (active version) data as an xlsx file
     [Method] `GET /api/projects/:projectId/download` → load all rows of the active version's table, map column names back to original headers, generate an xlsx buffer via excel service, set `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="project-{id}-v{n}.xlsx"`, send buffer.
     [Dependencies] 1.4, 1.6, 1.7
     [Changes]
        - Create `server/src/routes/download.ts` with the download handler
        - Register download router in `server/src/index.ts`

- [ ] 1.9 Implement config routes with password gate
     [Target] `server/src/routes/config.ts`, `server/src/middleware/auth.ts`
     [Purpose] Provide password verification and CRUD for LLM settings (base URL, API key, model)
     [Method] `auth.ts` middleware: checks `Authorization: Bearer <token>` against an in-memory Set of issued tokens (store default password `Abc123de` in env `CONFIG_PASSWORD` with that default). Routes: `POST /api/config/verify` (body {password} → if match, generate random token, add to Set, return {token}); `GET /api/config` (auth required → return {baseUrl, model} without exposing apiKey, plus `hasApiKey: true/false`); `PUT /api/config` (auth required → body {baseUrl, apiKey?, model} → upsert into `settings` table).
     [Dependencies] 1.3
     [Changes]
        - Create `server/src/middleware/auth.ts`
        - Create `server/src/routes/config.ts` with verify/get/put handlers
        - Register config router in `server/src/index.ts`

- [ ] 1.10 Implement LLM service (OpenAI-compatible chat + SQL execution)
     [Target] `server/src/services/llm.ts`
     [Purpose] Convert a natural-language question into validated SELECT SQL and execute it against the project's active data table
     [Method] `askLlm(prompt, {baseUrl, apiKey, model})`: normalize baseUrl (trim trailing `/`; never add or strip a `/v1` segment — the endpoint is always `{baseUrl}/chat/completions`, so a configured `https://api.openai.com/v1` calls `https://api.openai.com/v1/chat/completions` and a bare `https://host` calls `https://host/chat/completions`), POST with JSON body `{model, messages, temperature: 0, max_tokens}` and `Authorization: Bearer <apiKey>`; on network error / non-2xx / missing content, throw descriptive errors. Parse response; extract SQL from content (strip markdown fences if present). `extractSql(content)`: find first ```sql...``` block or first line starting with SELECT. `validateAndExecuteSql(sql, tableName, headers)`: reject unless a single SELECT statement (no `;` splitting into multiple statements, block INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/ATTACH/PRAGMA via regex on uppercase), wrap with `SELECT * FROM ( {sql} ) LIMIT 1000` to cap rows, execute via db.prepare, measure execution time ms, return `{columns, rows, rowCount, durationMs}`; on error return `{error: message}`. Build system prompt describing table name, column mapping (header → type), and instructions to return only SQL.
     [Dependencies] 1.3, 1.6
     [Changes]
        - Create `server/src/services/llm.ts` with askLlm, extractSql, validateAndExecuteSql

- [ ] 1.11 Implement chat/Q&A route with history
     [Target] `server/src/routes/chat.ts`
     [Purpose] Expose the Q&A endpoint (message → LLM → SQL → result) and persist last 100 messages per project
     [Method] `POST /api/projects/:projectId/chat` (body {message}): load config settings (404/400 if not configured), load project active version + headers, build prompt, call LLM, validate+execute SQL, insert assistant message into chat_messages (content = LLM text, sql_text = SQL, execution_meta = JSON {status, rowCount, durationMs, error}), then prune to keep only the latest 100 messages for that project; return `{ assistantText, sql, execution: {status, rowCount, durationMs, error}, result: {columns, rows} | null }`. `GET /api/projects/:projectId/chat` → last 100 messages ordered by created_at (include user messages too). On LLM/execution failure, still persist a message with error info and return 200 with error field set.
     [Dependencies] 1.9, 1.10
     [Changes]
        - Create `server/src/routes/chat.ts` with POST + GET handlers
        - Register chat router in `server/src/index.ts`

- [ ] 1.12 Scaffold frontend package (Vue 3 + Vite + TS, no UI library)
     [Target] `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.ts`, `web/src/App.vue`, `web/src/router/index.ts`
     [Purpose] Bootstrap a Vue 3 + TypeScript SPA with routing, Pinia, SCSS support, and an axios API client — without any component library (custom components per design system)
     [Method] Create package.json with deps: vue, vue-router, pinia, axios; devDeps: vite, @vitejs/plugin-vue, typescript, vue-tsc, sass. vite.config.ts with plugin-vue, `server.proxy: { '/api': 'http://localhost:3001' }`, alias `@` → `src`. main.ts imports global styles (tokens + global), installs router + pinia. App.vue renders router-view. Router defines `/` Home, `/manage`, `/query`, `/config` routes (lazy imports). index.html sets `<html lang="en">` and `<title>`.
     [Dependencies] 1.1
     [Changes]
        - Create frontend config files and entry points
        - Create `web/src/router/index.ts` with 4 routes

- [ ] 1.13 Implement design tokens + global styles + self-hosted fonts
     [Target] `web/src/styles/tokens.scss`, `web/src/styles/global.scss`, `web/src/main.ts` (font imports)
     [Purpose] Centralize the Minimalist Monochrome design system (colors, typography, borders, spacing, motion, focus) as CSS custom properties and global base styles; self-host fonts
     [Method] Add @fontsource packages: `@fontsource/playfair-display`, `@fontsource/source-serif-4`, `@fontsource/jetbrains-mono` (regular + bold + italic variants), imported in main.ts so Vite bundles the woff2 files (offline-capable). tokens.scss defines custom properties on `:root`: `--color-background:#FFFFFF; --color-foreground:#000000; --color-muted:#F5F5F5; --color-muted-foreground:#525252; --color-border:#000000; --color-border-light:#E5E5E5; --color-card:#FFFFFF; --color-card-foreground:#000000; --color-ring:#000000`; font vars `--font-display: 'Playfair Display', Georgia, serif; --font-body: 'Source Serif 4', Georgia, serif; --font-mono: 'JetBrains Mono', monospace`; type scale (xs→9xl per style.md); border widths (hairline 1px #E5E5E5 / thin 1px / medium 2px / thick 4px / ultra 8px black); layout (`--container-max: 72rem`); `--radius: 0`; transition `--duration-fast: 100ms`. global.scss: reset (box-sizing, margin), `body` bg white / text black / font-body; base typography (serif headings, uppercase mono labels `.label`/`.meta` utilities, `tracking-widest`, `tracking-tight`); focus-visible global rules (3px solid black outline + 3px offset on buttons/interactive, 4px border on inputs); hairline/black border utility classes; texture utility classes (horizontal-lines, grid, and global noise patterns at the low opacities from style.md, plus inverted white-based textures for dark/inverted sections); a centered container utility using `--container-max`; a visible skip-link utility (black bar at the very top of the page); no box-shadows anywhere.
     [Dependencies] 1.12
     [Changes]
        - Add @fontsource deps and import them in `web/src/main.ts`
        - Create `web/src/styles/tokens.scss`
        - Create `web/src/styles/global.scss` (reset, typography, focus, utilities, textures)

- [ ] 1.14 Implement monochrome UI primitives
     [Target] `web/src/components/ui/AppButton.vue`, `AppInput.vue`, `AppModal.vue`, `AppTag.vue`, `AppSelect.vue`, `AppCard.vue`, `AppAlert.vue`, `AppSpinner.vue` (plus `ui/index.ts` barrel export)
     [Purpose] Hand-rolled reusable primitives implementing the Minimalist Monochrome style exactly (zero radius, pure B&W, no shadows, instant transitions)
     [Method] Each primitive scoped-styles only, driven by design-token variables from tokens.scss. AppButton: variants `primary` (black bg/white text), `outline` (transparent + 2px black border), `ghost` (text link w/ underline on hover); all uppercase `tracking-widest` mono/medium label, rectangular, `focus-visible` 3px black outline + 3px offset, `transition: background-color 100ms, color 100ms`, hover = color inversion, disabled = muted. AppInput: white bg, 2px black border, `border-radius:0`, italic `#525252` placeholder, focus border 4px, label slot. AppModal: teleport overlay (black 40% scrim), white panel with 1px black border, no shadow, sharp corners, header (serif title + close ×), body slot, footer slot, focus trap basic. AppTag: 1px black border, mono uppercase small, `#F5F5F5` optional muted variant. AppSelect: native `<select>` styled as AppInput (monochrome, sharp). AppCard: white bg, 1px black border, no shadow, optional `inverted` variant (black bg/white text). AppAlert: variants success/error/info rendered monochrome (border + mono label + message; error = black/white inversion not color). AppSpinner: black/white border spinner, no color.
     [Dependencies] 1.13
     [Changes]
        - Create `web/src/components/ui/AppButton.vue` with variants + focus/hover inversion
        - Create `web/src/components/ui/AppInput.vue` (+ textarea prop if needed)
        - Create `web/src/components/ui/AppModal.vue` (teleport + scrim + panel)
        - Create `web/src/components/ui/AppTag.vue`, `AppSelect.vue`, `AppCard.vue`, `AppAlert.vue`, `AppSpinner.vue`
        - Create `web/src/components/ui/index.ts` barrel export

- [ ] 1.15 Implement API client module
     [Target] `web/src/api/index.ts`, `web/src/api/types.ts`
     [Purpose] Provide typed wrappers for all backend endpoints and a shared axios instance
     [Method] Create axios instance with baseURL `/api`. Export functions: getProjects, createProject, getProject, deleteProject, uploadVersion, activateVersion, deleteVersion, getDataMeta, getData, downloadData, verifyConfigPassword, getConfig, updateConfig, postChatMessage, getChatHistory. Types: Project, Version, HeaderMapping, DataMeta, DataResponse, Config, ChatMessage, ChatResponse. Download uses responseType 'blob' and triggers browser download via object URL.
     [Dependencies] 1.12
     [Changes]
        - Create `web/src/api/types.ts` and `web/src/api/index.ts`

- [ ] 1.16 Implement Home page (mode selection)
     [Target] `web/src/views/Home.vue`
     [Purpose] Entry page with cards to choose Data Management, Data Query, and a link to Configuration — rendered in Minimalist Monochrome editorial style
     [Method] Editorial layout: oversized Playfair Display headline (e.g., "Data Management") at 8xl on desktop / 5xl on mobile with `tracking-tight`; thick 4px black rule under the header with a small black-bordered square as visual punctuation; two AppCard mode cards (Data Management, Data Query) with AppButton "Open" each navigating to routes; a ghost AppButton "Configuration →" navigating to `/config`. Cards hover = color inversion (AppCard inverted on hover, 100ms). Mono uppercase labels + serif body descriptions. Responsive: cards stack vertically on mobile; headline scales down. All text English.
     [Dependencies] 1.14, 1.15
     [Changes]
        - Create `web/src/views/Home.vue` using AppCard/AppButton primitives

- [ ] 1.17 Implement Config page
     [Target] `web/src/views/Config.vue`
     [Purpose] Password-protected page to view/edit LLM settings (base URL, API key, model)
     [Method] If no stored token (sessionStorage 'configToken'), show AppCard with AppInput (type password, label "Password") + AppButton "Unlock" → verifyConfigPassword, store token. With token: AppCard form with AppInputs Base URL, API Key (type password, placeholder '••• saved' when hasApiKey and left blank to keep existing), Model; AppButton "Save" calls updateConfig (omit apiKey if blank); AppAlert success/error. AppButton ghost "Lock" clears token. Mono uppercase labels per design system.
     [Dependencies] 1.14, 1.15
     [Changes]
        - Create `web/src/views/Config.vue`

- [ ] 1.18 Implement shared DataTable component (hand-rolled, monochrome)
     [Target] `web/src/components/DataTable.vue`
     [Purpose] Reusable hand-rolled table with column sorting, column filtering, key-value filter panel, async chunked loading for >100 rows, and download button — pure monochrome styling
     [Method] Props: projectId, showDownload (default true). On mount: call getDataMeta → if total ≤ 100, load all rows in one request; else load in chunks (limit 500) appending rows with a loading indicator (AppSpinner + mono "Loading n / total" label) until all fetched. Server-side sort: clickable mono uppercase column headers with ▲/▼ indicators → refetch (reset offset) with sort params. Column filters: per-column AppInput row (collapsible "Filter" toggle) → debounced refetch with filters object. Key-value filter panel (AppCard, collapsible): AppSelect key (column) + AppInput value + AppButton "Add" → builds filters object (displayed as AppTags with remove). Download AppButton calls downloadData. Table markup: native `<table>` with hairline `#E5E5E5` row borders, 1px black header underline, sharp corners, `show-overflow` via ellipsis, mono metadata in table header; empty state (serif message) and error state (AppAlert). No pagination UI, no shadows, no radius.
     [Dependencies] 1.14, 1.15
     [Changes]
        - Create `web/src/components/DataTable.vue` (native table + sort + filters + key-value panel + chunked loading + download)

- [ ] 1.19 Implement Data Management page
     [Target] `web/src/views/Manage.vue`
     [Purpose] Project list + create, project detail (name, description, headers), version management (upload new version, activate, delete), and the data table
     [Method] Two-pane editorial layout: left column = project list (serif titles + mono metadata "v{n} · date" rows, hairline dividers, AppButton "New Project") with AppModal form (AppInputs name + description → createProject); right pane for selected project: header section (project name serif headline, description, headers as AppTags), version section (mono list/table of versions: number, created_at, active badge via AppTag inverted, AppButton Activate/Delete), AppButton "Upload New Version" (native `<input type=file accept=".xls,.xlsx">` or drag-drop; on success AppAlert success; if `requiresActivation`, AppModal confirm "Version v{n} created. Current active version is v{m}. Activate now?" with AppButton Confirm → activateVersion). New project without versions: empty state with upload prompt. Delete version: AppModal confirm; on 400 show error message. Refresh project/versions after each mutation.
     [Dependencies] 1.14, 1.15, 1.18
     [Changes]
        - Create `web/src/views/Manage.vue` (project list/create, detail, version management, DataTable embed)

- [ ] 1.20 Implement Data Query page (Browse + Ask modes)
     [Target] `web/src/views/Query.vue`, `web/src/components/ChatPanel.vue`
     [Purpose] Open a project and switch between Browse mode (data table) and Ask mode (AI Q&A chat with SQL + results display)
     [Method] Query.vue: project selector (left list like Manage), then mode switch (two AppButton segmented: "Browse" / "Ask", active = inverted). Browse tab: serif headline with current project name, renders DataTable (showDownload). Ask tab: renders ChatPanel. ChatPanel.vue: project name shown in header (mono label + serif title); scrollable message list (user bubbles right: black bg/white text; assistant left: white bg/1px black border) with mono timestamp under each; assistant message body = serif text; collapsible SQL block (AppCard with mono `<pre>` of SQL + AppButton "Copy"); execution meta line (mono: status/rowCount/duration or error via AppAlert); if structured result present, an AppCard with a native monochrome table of result rows (headers from result.columns; display the first 100 rows and show a mono "showing 100 of N rows" note if truncated). Input row at bottom: AppInput textarea + AppButton "Send" (disabled while loading, AppSpinner shown). On mount load getChatHistory and render; after send append user + assistant messages; auto-scroll to bottom. Copy uses navigator.clipboard.
     [Dependencies] 1.14, 1.15, 1.18
     [Changes]
        - Create `web/src/views/Query.vue` (project select + Browse/Ask switch)
        - Create `web/src/components/ChatPanel.vue` (chat UI, SQL block, execution meta, result table, history)

- [ ] 1.21 Wire up production build + static serving + end-to-end verification
     [Target] `server/src/index.ts`, root `package.json` scripts, `README.md`
     [Purpose] Serve the built frontend from the backend and provide runnable build/start scripts; verify all features work end to end
     [Method] In index.ts: after API routes, if `web/dist` exists serve it statically (express.static) and add SPA fallback (send index.html for non-/api GET). Root scripts: `dev` runs server (tsx watch) + web (vite) concurrently (use `concurrently` dep), `build` = build web + compile server, `start` = NODE_ENV=production node server/dist/index.js. Manually verify: create project, upload xlsx (version 1 active), upload mismatched headers → error, upload matching → activation prompt, activate, delete non-active version, sort/filter/key-value filter, >100-row async load, download xlsx, config password gate + save settings, chat Q&A returns SQL + result table + history persists across reload (last 100 pruning). Visual check: all pages match Minimalist Monochrome (zero radius, no shadows, B&W only, serif headlines, mono labels).
     [Dependencies] 1.11, 1.20
     [Changes]
        - Update `server/src/index.ts` for static serving + SPA fallback
        - Update root `package.json` scripts and add `concurrently` where needed
        - Update `README.md` with run/build instructions

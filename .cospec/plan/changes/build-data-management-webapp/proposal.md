# Change: Build a data management web application

## Rationale
The workspace is empty (greenfield). Based on `requirement.md`, we need a complete data management web app supporting project-based Excel data storage with versioning, a data query UI (browse + AI Q&A modes), and a password-protected LLM configuration page — all styled per the Minimalist Monochrome design system defined in `style.md`.

## Confirmed Technical Decisions
| Area | Decision |
|---|---|
| Frontend | Vue 3 + Vite + TypeScript, **hand-rolled custom components** (no UI library), SCSS + CSS custom properties design tokens |
| Design system | **Minimalist Monochrome** (`style.md`): pure B&W palette, serif typography, zero border radius, line-based visuals, no shadows, instant 100ms interactions |
| Fonts | **Self-hosted** via `@fontsource` npm packages (Playfair Display / Source Serif 4 / JetBrains Mono) — works fully offline |
| Backend | Node.js + TypeScript + Express |
| Database | SQLite via `better-sqlite3` (file-based, zero-config, easy to back up/migrate) |
| Excel | SheetJS (`xlsx`) for parsing and generating xls/xlsx |
| LLM | OpenAI-compatible chat completions API (configurable base URL + key + model) |
| Deployment | Single instance; Vite dev proxy `/api` → backend; backend serves built frontend in production |
| Auth | Only the Config page requires password (`Abc123de`) via a simple token gate |

## Architecture Overview
- **Monorepo** with npm workspaces: `server/` (backend) and `web/` (frontend).
- **Storage model**: SQLite file in `data/` (gitignored). Each project has a `projects` record storing name, description, header mapping (sanitized column name ↔ original header, with inferred type). Each version has a `versions` record; the version's rows live in a dynamically created table `data_p{projectId}_v{versionNumber}` whose columns are the sanitized header names. One active version per project.
- **Why per-version tables**: the AI Q&A mode executes LLM-generated SQL against real relational tables, so each version's data must be a real SQLite table with a stable, known table name (`data_p{id}_v{n}`). Deleting a version = dropping its table.
- **Data display**: no pagination. If row count ≤ 100, fetch all and use client-side sorting/filtering for instant response. If > 100, load asynchronously in chunks (server-side SQL sort/filter, appended progressively) with a loading indicator.
- **Q&A flow**: user message → server builds a system prompt containing the active version's table name + column names/types → LLM returns SQL (SELECT only, validated) → server executes against that table with a row/time limit → response includes LLM text, generated SQL, execution meta (status/duration/rows), and structured results rendered as a table. History saved per project (last 100, with timestamps).
- **Config page**: password gate (`Abc123de`) returns a token held in frontend memory/sessionStorage; all config API calls carry it. Settings (base URL, API key, model) stored in a SQLite `settings` table.

## Design System Integration (Minimalist Monochrome)
The entire frontend follows `style.md` strictly:
- **Palette**: pure `#FFFFFF` background / `#000000` foreground only. Grays (`#F5F5F5` muted, `#525252` muted-foreground, `#E5E5E5` light borders) only for secondary text and dividers. **No other colors anywhere.**
- **Typography**: Playfair Display (display/headlines), Source Serif 4 (body), JetBrains Mono (labels, metadata, timestamps, SQL, technical detail). All fonts self-hosted via `@fontsource`, bundled by Vite, offline-capable. Dramatic type scale for page/section titles; `tracking-widest` uppercase mono labels for UI chrome; `tracking-tight` serif headlines.
- **Shape**: `border-radius: 0` everywhere — every element has sharp 90° corners. No exceptions.
- **Depth**: zero box-shadows. Emphasis via color inversion (black bg / white text), border-weight variation (hairline 1px `#E5E5E5`, thin/medium/thick black), scale contrast, and negative space.
- **Lines**: hairline dividers (`#E5E5E5` 1px) between table rows; black borders (1–2px) on cards/inputs/buttons; thick 4px black rules between major sections.
- **Buttons**: primary = black bg / white text / uppercase / tracking-widest / rectangular; outline = transparent / 2px black border; hover = color inversion; transitions ≤ 100ms (instant feel).
- **Inputs**: white bg, 2px black border (bottom or full), no radius, italic gray placeholder, focus thickens border to 4px (no colored focus ring).
- **Data table**: hand-rolled `<table>` (no library) — hairline row separators, uppercase mono column headers, black sort/filter affordances, monochrome selection/filter states, mono-font metadata. No pagination UI.
- **Textures**: subtle horizontal-line / grid textures (very low opacity) used sparingly for editorial depth, not flat design.
- **Accessibility**: WCAG AAA black-on-white; `focus-visible` 3px solid black outlines with offset on all interactive elements; minimum 44px touch targets.
- **Motion**: instant/binary state changes only (0–100ms), purposeful — never bouncy or gradient-based.
- **Responsive**: sharp corners + B&W preserved on mobile; headlines scale down; columns stack.

## Changes
- Scaffold npm-workspaces monorepo (root scripts, `server/`, `web/`, gitignore, README).
- Backend: Express + TypeScript app with SQLite schema (projects, versions, settings, chat_messages), Excel import service (header parse, column sanitization, type inference, data table creation), projects/versions/data/config/chat REST APIs, LLM service, and SQL safety validation.
- Frontend: Vue 3 + Vite + TS app with design-token foundation (SCSS custom properties), self-hosted fonts, hand-rolled monochrome UI primitives (Button/Input/Modal/Tag/Select/Card/Alert/Spinner), mode-selection home page, Data Management page, Data Query page (Browse + Ask), Config page, and a hand-rolled DataTable component.
- All UI text in English.

## Impact
- **Affected Specifications**: Data Management (projects, Excel upload, versioning, active version, filtering, download), Data Query (Browse mode, Ask/AI mode with SQL generation and history), Configuration (password gate, LLM settings), UI/Design (Minimalist Monochrome system per style.md).
- **Affected Code**: (new project — no existing code)
    - `server/src/index.ts`: Express app bootstrap, static serving of frontend build.
    - `server/src/db.ts`: SQLite connection + schema creation.
    - `server/src/routes/projects.ts`: project CRUD + version management + header validation + data query/download.
    - `server/src/routes/config.ts`: password verify + settings get/set with token middleware.
    - `server/src/routes/chat.ts`: Q&A endpoint + history.
    - `server/src/services/excel.ts`: xls/xlsx parse + export, column sanitization + type inference.
    - `server/src/services/llm.ts`: OpenAI-compatible client + SQL extraction + SQL safety validation + execution.
    - `web/src/styles/tokens.scss` + `web/src/styles/global.scss`: design tokens + global monochrome styles + texture utilities.
    - `web/src/components/ui/*.vue`: hand-rolled monochrome primitives (AppButton, AppInput, AppModal, AppTag, AppSelect, AppCard, AppAlert, AppSpinner).
    - `web/src/components/DataTable.vue`: hand-rolled sortable/filterable/async-loading monochrome table.
    - `web/src/views/Home.vue`, `Manage.vue`, `Query.vue`, `Config.vue`: mode pages.
    - `web/src/api/*.ts`: typed API client.

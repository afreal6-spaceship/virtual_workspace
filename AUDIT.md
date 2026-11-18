# Initial technical audit

Audit date: 2026-11-17

## Repository and architecture

The repository contains only `frontend/` and `backend/`, with no Git metadata, test suite, lockfile, database configuration, migration setup, deployment configuration, or CI pipeline. The frontend was a single React component; it is now split into an application entry point, `App.tsx`, and an IndexedDB attachment service. The backend remains one FastAPI module with one AI proposal endpoint.

## Existing and implemented behavior

- **Canvas:** tldraw provides the manual editing tools and is the sole canvas state system. Independent boards load separate tldraw snapshots from browser storage; camera position is also stored per board. Fit-selection, fit-board, zoom-in, and zoom-out controls use the SDK editor API.
- **Navigation:** local board tree, nested board creation, rename, duplicate, recursive delete, and full-text board-name search now work. Tree rendering and cascading deletion have recursion guards.
- **Persistence:** canvas snapshots autosave locally after a short debounce. Up to twenty named snapshots can be saved and restored. Boards can be exported to and imported from JSON.
- **Attachments:** files are now stored as actual Blobs in browser IndexedDB, with per-board listing, download, and delete. Each selected file is limited to 20 MB.
- **AI:** generate, modify, and analyze use a preview/approval flow. Backend request and response models are constrained; analyze and generate outputs are restricted by mode, and modify updates are limited to selected unlocked geometry objects. The AI panel can launch the installed Codex CLI's browser-based ChatGPT sign-in and check its connection status. Proposals run through ephemeral `codex exec` with a read-only sandbox.
- **Feedback adaptation:** optional project-scoped accept/reject examples are stored locally, ranked by prompt token overlap, and limited to five examples per AI request. This is in-context personalization, not model fine-tuning or autonomous weight updates.
- **Codex account connection:** the workspace uses the signed-in Codex CLI account rather than collecting an OpenAI Platform API key. Codex CLI credentials remain managed by Codex. This requires network access and an eligible signed-in ChatGPT/Codex account; it is not offline inference.
- **Interface:** responsive three-column workspace, local project dashboard and project views, board search, Unicode font fallbacks, AI connection status, and light/dark UI theme are implemented.

## Partial or unverified behavior

- tldraw supplies the canvas drawing, selection, editing, camera, and undo/redo behavior. SDK-level licensing and production terms still need review against the deployment plan.
- AI output is still limited to rectangle creation and text replacement on selected geometry shapes. It does not create connectors, groups, diagrams, documents, tasks, or reference-linked analysis findings.
- AI context includes current board shape data but not project documents or uploaded file contents. Files remain on the device and are not sent to the backend.
- When feedback adaptation is enabled, the relevant saved prompts/outcomes/labels are also sent to the configured AI provider with the next request; users can turn this off or clear project memory.
- Projects and project membership are browser-local UI organization; there is no server-side project model or cross-device synchronization.
- Attachment storage is browser-local and has no server-side permissions, malware scanning, file preview, versioning, or cross-device access.
- Board snapshots and metadata remain in browser storage. Storage quota, concurrent editing, and recovery across devices are not addressed.
- The theme switch styles the workspace shell; tldraw's own internal theme behavior depends on SDK support and has not been browser-verified.

## Broken or missing production capabilities

- No user authentication, authorization, workspace isolation, server persistence, PostgreSQL schema, migrations, API pagination, or concurrency control.
- No real multi-user collaboration, comments, task system, rich-text documents, dashboard, notifications, or activity history.
- No S3-compatible storage, background jobs, Redis, Docker, Nginx, TLS setup, monitoring, or backup/restore strategy.
- No formal operation registry or dependency-aware partial acceptance; previews currently list proposed new nodes and text updates.
- No complete error boundary, accessibility review, or browser/device compatibility validation.

## Security findings

- The project is local-only and has no identity or permission checks. Do not expose the backend or use it with sensitive data.
- The OpenAI key stays on the backend. The API request/response schemas and provider error messages are bounded/sanitized, but there are no rate limits, user quotas, tenant checks, or robust streaming request-size middleware.
- The AI endpoint sends board context to the configured provider. Prompt text and canvas content are treated as untrusted, but retrieval isolation and prompt-injection-resistant tool execution are not applicable yet because no tools or document retrieval exist.
- Browser-local attachments and board data are available to anyone using the same browser profile.
- External font loading was removed so the UI does not need a third-party font host.

## Dependency and runtime verification

- Frontend declares React 18, tldraw 3.15, Vite 6, and TypeScript 5.7, but has no lockfile. `npm.cmd` is available; project dependencies are not installed and no Vite or TypeScript executable is present.
- Python 3.12 is available. The isolated `backend/.venv` was created, but installing FastAPI dependencies failed because outbound package-index access is blocked (`WinError 10013`). FastAPI, Pydantic, OpenAI, and pytest are not installed in the base interpreter.
- `python -m py_compile backend/main.py` succeeds. Backend startup, API tests, frontend type-check/build, and browser tests therefore could not be run in this environment.
- No performance figures are reported because the application could not be launched or benchmarked.

## Prioritized next work

1. Restore package-index access or provide approved dependency mirrors; generate and check in frontend and backend lockfiles, then run type-check/build and API/browser tests.
2. Replace browser-only persistence with authenticated PostgreSQL-backed workspaces, boards, revisions, and optimistic concurrency, with a safe local-data export/import migration path.
3. Implement authentication, workspace roles, CSRF/session controls, rate limits, secure headers, audit events, and endpoint-level tenant authorization before any public deployment.
4. Add private object storage, safe file parsing, upload validation/scanning, permissions, and retrieval that only exposes authorized project content to AI.
5. Expand the validated AI proposal model to operation types, connectors, deletions, moves, styling, dependency-aware acceptance, and board revisions; add diagram layout and clickable analysis references.
6. Add feature modules for dashboard, projects/tasks, comments, documents, collaboration, and technical diagram templates; validate each as a functional workflow rather than a visual-only screen.
7. Browser-test camera persistence, import/export recovery, storage quota handling, attachment lifecycle, dark mode, keyboard interaction, and 100/1,000/5,000-object performance on supported devices.

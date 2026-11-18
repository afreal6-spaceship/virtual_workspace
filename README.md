# Visual Workspace

A local visual workspace built with React, TypeScript, Vite, tldraw, and a small FastAPI service for AI canvas proposals.

## Run locally

Backend (Python 3.10+):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Install the Codex CLI and sign in with your ChatGPT account (`codex login`) or use **Connect Codex with ChatGPT** in the AI Copilot. The backend checks the CLI sign-in and starts its normal browser sign-in flow when needed. It does not ask for or store an API key. AI requests use the online account linked to Codex; no local model is used.

The AI Copilot uses the signed-in Codex CLI account, not an OpenAI Platform API key. Codex CLI handles browser sign-in and keeps its credentials; the workspace only checks login status and invokes `codex exec` for proposals. The command runs with a read-only sandbox and ephemeral session, and the resulting canvas proposal still requires user review before it changes the board. The model request and board context go to OpenAI online under the signed-in account.

The saved project memory currently consists of up to 30 accepted, partly accepted, or rejected AI feedback examples in browser storage. Relevant examples can guide later requests on this device; this is retrieval/prompt personalization, not automatic machine-learning training. It does not learn from all software edits or architecture files.

Frontend (Node.js):

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Vite proxies `/api` requests to `127.0.0.1:8000`. `GET /api/health` reports whether Codex CLI is installed and signed in.

## Current behavior

- Draw and edit on an infinite tldraw canvas. Each board has its own autosaved browser snapshot and camera position, plus fit and zoom controls.
- Create, nest, rename, duplicate, delete, and search boards.
- Open a workspace dashboard with local projects, project board counts, recent boards, and project-specific board creation.
- Save named local versions, restore a saved version, and import/export a board snapshot as JSON.
- Upload, download, and delete real attachments stored as Blobs in browser IndexedDB (20 MB per file).
- Connect Codex through its normal ChatGPT sign-in flow; request AI generate, modify, or analyze proposals, preview them, and explicitly accept or reject changes.
- Optionally use project-scoped accept/reject history as a few relevant examples in future AI prompts. This is prompt personalization, not model-weight training; examples are stored locally and can be cleared.
- Switch the workspace UI between light and dark themes.

## Data and security limits

This remains a local prototype, not a production-ready multi-user service. Boards, attachments, projects, and optional AI feedback examples remain in the browser; there is no application authentication, database, collaboration, server-side file storage, rate limiting, or tenant isolation. When feedback learning is enabled, relevant saved examples and current board shape context are sent to Codex. Uploaded attachment contents are not sent. Codex runs with read-only file access for proposals, and the app requires review before canvas edits are applied. Keep both services bound to localhost and do not expose the backend publicly.

See [AUDIT.md](AUDIT.md) for the implementation audit, verification limits, and prioritized production work. Review tldraw licensing and deployment requirements before distributing the application.

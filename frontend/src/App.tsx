import { useEffect, useState } from 'react';
import { createShapeId, getSnapshot, loadSnapshot, Tldraw, toRichText } from 'tldraw';
import type { Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import './style.css';
import BoardNavigation from './features/navigation/BoardNavigation';
import { CreateItemMenu } from './features/navigation/BoardNavigation';
import NavigationItemPage from './features/navigation/NavigationItemPage';
import ProjectsPage from './features/projects/ProjectsPage';
import type { Board, NavigationKind } from './types/board';
import { NAVIGATION_KINDS, navigationKind } from './types/board';
import type { Project } from './types/project';
import { listAttachments, removeAttachment, saveAttachment } from './utils/localFiles';
import type { LocalAttachment } from './utils/localFiles';

type Mode = 'generate' | 'modify' | 'analyze';
type Proposal = { summary: string; nodes: { label: string; x: number; y: number }[]; updates: { id: string; label: string }[] };
type StoredVersion = { date: string; name?: string; snapshot: unknown };
type FeedbackMemory = { id: string; mode: Mode; prompt: string; outcome: 'applied' | 'partially_applied' | 'rejected'; changes: string[]; createdAt: string };

const DEFAULT_BOARD: Board = { id: 'home', parent: null, name: 'First board', projectId: 'default', kind: 'board' };
const DEFAULT_PROJECT: Project = { id: 'default', name: 'My workspace', description: '', color: '#6366d9', createdAt: new Date().toISOString() };
const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const safeName = (value: string) => value.trim().slice(0, 100);

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const stored = read<unknown>('projects', [DEFAULT_PROJECT]);
    if (!Array.isArray(stored)) return [DEFAULT_PROJECT];
    const valid = stored.filter((item): item is Project => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.color === 'string');
    return valid.length ? valid : [DEFAULT_PROJECT];
  });
  const [boards, setBoards] = useState<Board[]>(() => {
    const stored = read<unknown>('tree', [DEFAULT_BOARD]);
    if (!Array.isArray(stored)) return [DEFAULT_BOARD];
    const projectIds = new Set(projects.map((project) => project.id));
    const fallbackProjectId = projects[0]?.id ?? DEFAULT_PROJECT.id;
    const valid = stored.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && (typeof item.parent === 'string' || item.parent === null));
    return valid.length ? valid.map((item) => ({ ...item, kind: NAVIGATION_KINDS.some((entry) => entry.kind === item.kind) ? item.kind : 'board', projectId: typeof item.projectId === 'string' && projectIds.has(item.projectId) ? item.projectId : fallbackProjectId })) : [{ ...DEFAULT_BOARD, projectId: fallbackProjectId }];
  });
  const [activeProject, setActiveProject] = useState(() => {
    const stored = read<unknown>('active-project', DEFAULT_PROJECT.id);
    return typeof stored === 'string' && projects.some((project) => project.id === stored) ? stored : projects[0]?.id ?? DEFAULT_PROJECT.id;
  });
  const [view, setView] = useState<'dashboard' | 'project' | 'board' | 'item'>('dashboard');
  const [aiStatus, setAiStatus] = useState<'checking' | 'offline' | 'unconfigured' | 'ready'>('checking');
  const [codexConnected, setCodexConnected] = useState(false);
  const [codexAvailable, setCodexAvailable] = useState(false);
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexMessage, setCodexMessage] = useState('');
  const [active, setActive] = useState(() => {
    const stored = read<unknown>('active-board', DEFAULT_BOARD.id);
    return typeof stored === 'string' && boards.some((item) => item.id === stored) ? stored : boards[0]?.id ?? DEFAULT_BOARD.id;
  });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<Mode>('generate');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalPrompt, setProposalPrompt] = useState('');
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [proposalBase, setProposalBase] = useState('');
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => read<string>('theme', 'light') === 'dark' ? 'dark' : 'light');
  const [rightTab, setRightTab] = useState<'copilot' | 'files'>('copilot');
  const [savedAt, setSavedAt] = useState('');
  const [zoomPercent, setZoomPercent] = useState(100);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [learningEnabled, setLearningEnabled] = useState(() => read<boolean>('ai-learning-enabled', true));
  const [learningMemories, setLearningMemories] = useState<FeedbackMemory[]>(() => read<FeedbackMemory[]>(`ai-feedback:${activeProject}`, []));
  const board = boards.find((item) => item.id === active) ?? boards[0] ?? DEFAULT_BOARD;
  const selectedItem = boards.find((item) => item.id === active) ?? board;
  const project = projects.find((item) => item.id === (view === 'board' ? board.projectId : activeProject)) ?? projects[0] ?? DEFAULT_PROJECT;

  useEffect(() => {
    localStorage.setItem('projects', JSON.stringify(projects));
    localStorage.setItem('active-project', activeProject);
    if (!projects.some((item) => item.id === activeProject)) setActiveProject(projects[0]?.id ?? DEFAULT_PROJECT.id);
  }, [projects, activeProject]);

  useEffect(() => {
    setLearningMemories(read<FeedbackMemory[]>(`ai-feedback:${activeProject}`, []));
  }, [activeProject]);

  useEffect(() => { localStorage.setItem('ai-learning-enabled', JSON.stringify(learningEnabled)); }, [learningEnabled]);

  useEffect(() => {
    localStorage.setItem('tree', JSON.stringify(boards));
    if (!boards.some((item) => item.id === active)) setActive(boards[0]?.id ?? DEFAULT_BOARD.id);
  }, [boards, active]);

  useEffect(() => {
    localStorage.setItem('active-board', active);
    let live = true;
    listAttachments(active).then((files) => live && setAttachments(files)).catch(() => live && setStatus('Could not read local attachments.'));
    return () => { live = false; };
  }, [active]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', JSON.stringify(theme));
  }, [theme]);

  async function checkAI() {
    setAiStatus('checking');
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('offline');
      const health = await response.json();
      setCodexAvailable(Boolean(health.codex_available));
      setCodexConnected(Boolean(health.codex_connected));
      setAiStatus(health.codex_connected ? 'ready' : 'unconfigured');
      setCodexMessage(health.message || '');
    } catch { setAiStatus('offline'); }
  }

  useEffect(() => { void checkAI(); }, []);

  async function connectCodex() {
    if (codexBusy) return;
    setCodexBusy(true); setCodexMessage('Starting Codex sign-in…');
    try {
      const response = await fetch('/api/codex/connect', { method: 'POST' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.detail || `Could not start Codex sign-in (${response.status}).`);
      setCodexMessage(result?.message || 'Complete sign-in in your browser.');
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        const health = await fetch('/api/health');
        if (health.ok) {
          const state = await health.json();
          setCodexAvailable(Boolean(state.codex_available));
          if (state.codex_connected) {
            setCodexConnected(true); setAiStatus('ready');
            setCodexMessage('Codex connected with your ChatGPT account.');
            setStatus('Codex connected.');
            return;
          }
        }
      }
      setCodexMessage('Sign-in has not completed yet. Finish in the Codex window or browser, then click Check connection.');
    } catch (error) {
      setCodexMessage(error instanceof Error ? error.message : 'Could not start Codex sign-in.');
    } finally { setCodexBusy(false); }
  }

  const currentShapes = () => editor?.getCurrentPageShapes().map((shape) => ({
    id: shape.id, type: shape.type, x: shape.x, y: shape.y, props: shape.props, locked: shape.isLocked,
  })) ?? [];

  function recordFeedback(outcome: FeedbackMemory['outcome'], changes: string[]) {
    if (!learningEnabled || !proposalPrompt.trim()) return;
    const id = board.projectId;
    const stored = read<unknown>(`ai-feedback:${id}`, []);
    const memories = Array.isArray(stored) ? stored as FeedbackMemory[] : [];
    const next = [...memories, {
      id: crypto.randomUUID(), mode, prompt: proposalPrompt.slice(0, 1_200), outcome,
      changes: changes.slice(0, 10).map((change) => change.slice(0, 500)), createdAt: new Date().toISOString(),
    }].slice(-30);
    try {
      localStorage.setItem(`ai-feedback:${id}`, JSON.stringify(next));
      setLearningMemories(next);
    } catch { setStatus('Could not save learning feedback in browser storage.'); }
  }

  function clearLearningMemory() {
    if (!window.confirm(`Clear saved AI feedback for "${project.name}"?`)) return;
    localStorage.removeItem(`ai-feedback:${project.id}`);
    setLearningMemories([]);
  }

  function relevantLearningExamples(instruction: string) {
    if (!learningEnabled) return [];
    const stored = read<unknown>(`ai-feedback:${project.id}`, []);
    if (!Array.isArray(stored)) return [];
    const examples = (stored as FeedbackMemory[]).filter((entry) => entry && typeof entry.prompt === 'string' && typeof entry.outcome === 'string');
    const tokens = (value: string) => new Set(value.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []);
    const queryTokens = tokens(instruction);
    const ranked = examples.map((entry, index) => {
      const entryTokens = tokens(entry.prompt);
      const overlap = [...queryTokens].filter((token) => entryTokens.has(token)).length;
      return { entry, score: overlap + index / Math.max(1, examples.length) * 0.2 };
    }).sort((a, b) => b.score - a.score);
    const matched = ranked.filter((item) => item.score > 0).slice(0, 5);
    const chosen = matched.length ? matched : ranked.slice(-3).reverse();
    return chosen.map(({ entry }) => ({ mode: entry.mode, prompt: entry.prompt, outcome: entry.outcome, changes: entry.changes ?? [] }));
  }

  function mount(nextEditor: Editor) {
    setEditor(nextEditor);
    setZoomPercent(Math.round(nextEditor.getZoomLevel() * 100));
    try {
      const saved = read<unknown>(`board:${active}`, null);
      if (saved) loadSnapshot(nextEditor.store, saved as Parameters<typeof loadSnapshot>[1]);
      const savedCamera = read<{ x: number; y: number; z: number } | null>(`camera:${active}`, null);
      if (savedCamera && [savedCamera.x, savedCamera.y, savedCamera.z].every(Number.isFinite)) nextEditor.setCamera(savedCamera);
    } catch {
      setStatus('Saved board data could not be loaded.');
    }
    let saveTimer: number | undefined;
    const stopListening = nextEditor.store.listen(() => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        try {
          localStorage.setItem(`board:${active}`, JSON.stringify(getSnapshot(nextEditor.store)));
          setSavedAt(new Date().toLocaleTimeString());
        } catch {
          setStatus('Browser storage is full. Export this board to keep a copy.');
        }
      }, 450);
    }, { scope: 'document' });
    let cameraTimer: number | undefined;
    let lastCamera = JSON.stringify(nextEditor.getCamera());
    const stopCameraListening = nextEditor.store.listen(() => {
      setZoomPercent(Math.round(nextEditor.getZoomLevel() * 100));
      const camera = nextEditor.getCamera();
      const serializedCamera = JSON.stringify(camera);
      if (serializedCamera !== lastCamera) {
        lastCamera = serializedCamera;
        window.clearTimeout(cameraTimer);
        cameraTimer = window.setTimeout(() => {
          try { localStorage.setItem(`camera:${active}`, serializedCamera); } catch { /* camera state is optional to restore */ }
        }, 450);
      }
    }, { scope: 'session' });
    return () => {
      if (saveTimer !== undefined) {
        window.clearTimeout(saveTimer);
        try { localStorage.setItem(`board:${active}`, JSON.stringify(getSnapshot(nextEditor.store))); } catch { /* the app reports quota errors during normal saves */ }
      }
      if (cameraTimer !== undefined) {
        window.clearTimeout(cameraTimer);
        try { localStorage.setItem(`camera:${active}`, lastCamera); } catch { /* camera state is optional to restore */ }
      }
      stopListening(); stopCameraListening();
    };
  }

  function createNavigationItem(parent: string | null, kind: NavigationKind, projectId?: string) {
    const label = NAVIGATION_KINDS.find((entry) => entry.kind === kind)?.label.toLowerCase() ?? 'item';
    const name = safeName(window.prompt(`Name this ${label}`) ?? '');
    if (!name) return;
    const parentBoard = parent ? boards.find((item) => item.id === parent) : undefined;
    const next = [...boards, { id: crypto.randomUUID(), parent, name, projectId: parentBoard?.projectId ?? projectId ?? activeProject, kind }];
    setBoards(next);
    setActive(next[next.length - 1].id);
    setActiveProject(next[next.length - 1].projectId);
    setView(kind === 'board' ? 'board' : 'item');
    setProposal(null);
  }

  function createBoard(parent: string | null, projectId?: string) { createNavigationItem(parent, 'board', projectId); }

  function createProject() {
    const name = safeName(window.prompt('Name this project') ?? '');
    if (!name) return;
    const palette = ['#6366d9', '#138a83', '#c17d35', '#bd5c7c', '#487dbb'];
    const next: Project = { id: crypto.randomUUID(), name, description: '', color: palette[projects.length % palette.length], createdAt: new Date().toISOString() };
    setProjects((old) => [...old, next]); setActiveProject(next.id); setView('project');
  }

  function renameProject(item: Project) {
    const name = safeName(window.prompt('Project name', item.name) ?? '');
    if (name) setProjects((old) => old.map((project) => project.id === item.id ? { ...project, name } : project));
  }

  function openBoard(id: string) {
    const item = boards.find((candidate) => candidate.id === id);
    if (!item) return;
    setActive(id); setActiveProject(item.projectId); setEditor(null); setProposal(null); setView('board');
  }

  function openNavigationItem(id: string) {
    const item = boards.find((candidate) => candidate.id === id);
    if (!item) return;
    if (navigationKind(item) === 'board') { openBoard(id); return; }
    setActive(id); setActiveProject(item.projectId); setEditor(null); setProposal(null); setView('item');
  }

  function openItemDetails(id: string) {
    const item = boards.find((candidate) => candidate.id === id);
    if (!item) return;
    setActive(id); setActiveProject(item.projectId); setEditor(null); setProposal(null); setView('item');
  }

  function updateNavigationItem(id: string, patch: Partial<Pick<Board, 'assignee' | 'deadline' | 'description' | 'documentText'>>) {
    setBoards((old) => old.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function renameBoard(item: Board) {
    const name = safeName(window.prompt('Rename board', item.name) ?? '');
    if (name) setBoards((old) => old.map((candidate) => candidate.id === item.id ? { ...candidate, name } : candidate));
  }

  function duplicateBoard(item: Board) {
    const copy: Board = { ...item, id: crypto.randomUUID(), name: `${item.name} copy` };
    const snapshot = read<unknown>(`board:${item.id}`, null);
    if (snapshot) localStorage.setItem(`board:${copy.id}`, JSON.stringify(snapshot));
    setBoards((old) => [...old, copy]);
    setActive(copy.id); setActiveProject(copy.projectId); setView(navigationKind(copy) === 'board' ? 'board' : 'item');
  }

  async function deleteBoard(item: Board) {
    if (!window.confirm(`Delete “${item.name}” and its nested boards?`)) return;
    const remove = new Set([item.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of boards) if (candidate.parent && remove.has(candidate.parent) && !remove.has(candidate.id)) {
        remove.add(candidate.id); changed = true;
      }
    }
    try {
      for (const id of remove) await Promise.all((await listAttachments(id)).map((file) => removeAttachment(file.id)));
    } catch {
      setStatus('Could not finish deleting stored attachments. The boards were left in place.');
      return;
    }
    const next = boards.filter((candidate) => !remove.has(candidate.id));
    for (const id of remove) {
      localStorage.removeItem(`board:${id}`);
      localStorage.removeItem(`versions:${id}`);
    }
    const fallback = next[0] ?? DEFAULT_BOARD;
    setBoards(next.length ? next : [fallback]);
    if (remove.has(active)) { setEditor(null); setActive(fallback.id); setView('project'); }
    setProposal(null);
  }

  async function ask() {
    if (!editor || !prompt.trim() || busy) return;
    if (aiStatus !== 'ready') {
      setStatus(aiStatus === 'unconfigured' ? 'Connect Codex with your ChatGPT account before using AI.' : 'AI backend is offline. Start the backend, then check status again.');
      return;
    }
    setBusy(true); setProposal(null);
    const shapes = currentShapes();
    setProposalPrompt(prompt.trim());
    setProposalBase(JSON.stringify(shapes));
    try {
      const response = await fetch('/api/propose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompt: prompt.trim(), shapes, selected: editor.getSelectedShapeIds(), learning_examples: relevantLearningExamples(prompt.trim()) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `AI request failed (${response.status}).`);
      }
      const result = await response.json() as Proposal;
      setProposal(result); setSelectedNodes(result.nodes.map((_, index) => index));
      setStatus('Proposal ready. The canvas has not changed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI request failed.');
    } finally { setBusy(false); }
  }

  function applyProposal(all: boolean) {
    if (!editor || !proposal || mode === 'analyze') return;
    if (proposalBase !== JSON.stringify(currentShapes())) { setStatus('The board changed while this proposal was open. Generate a fresh proposal.'); return; }
    const acceptedChanges = [
      ...proposal.nodes.filter((_, index) => all || selectedNodes.includes(index)).map((node) => node.label),
      ...(all ? proposal.updates.map((update) => update.label) : []),
    ];
    if (!acceptedChanges.length) { setStatus('Select at least one proposed node to apply.'); return; }
    recordFeedback(all ? 'applied' : 'partially_applied', acceptedChanges);
    editor.markHistoryStoppingPoint('AI changes');
    editor.run(() => {
      proposal.nodes.forEach((node, index) => {
        if (all || selectedNodes.includes(index)) editor.createShape({ id: createShapeId(), type: 'geo', x: node.x, y: node.y, props: { geo: 'rectangle', w: 220, h: 100, richText: toRichText(node.label) } });
      });
      if (all) proposal.updates.forEach((update) => {
        const shape = editor.getShape(update.id as never);
        if (shape?.type === 'geo' && !shape.isLocked) editor.updateShape({ id: shape.id, type: 'geo', props: { richText: toRichText(update.label) } });
      });
    });
    setProposal(null); setStatus('Applied. Undo is available.');
  }

  function rejectProposal() {
    if (proposal) recordFeedback('rejected', [...proposal.nodes.map((node) => node.label), ...proposal.updates.map((update) => update.label)]);
    setProposal(null);
  }

  function saveVersion() {
    if (!editor) return;
    const name = safeName(window.prompt('Version name', `Version ${new Date().toLocaleString()}`) ?? '');
    if (!name) return;
    const key = `versions:${active}`;
    const stored = read<unknown>(key, []);
    const versions = Array.isArray(stored) ? stored as StoredVersion[] : [];
    try {
      localStorage.setItem(key, JSON.stringify([...versions, { name, date: new Date().toISOString(), snapshot: getSnapshot(editor.store) }].slice(-20)));
      setStatus(`Saved version “${name}”.`);
    } catch { setStatus('Browser storage is full. Export the board before saving another version.'); }
  }

  function restoreVersion() {
    if (!editor) return;
    const stored = read<unknown>(`versions:${active}`, []);
    const versions = Array.isArray(stored) ? stored as StoredVersion[] : [];
    if (!versions.length) { setStatus('No saved versions for this board yet.'); return; }
    const choices = versions.map((version, index) => `${index + 1}. ${version.name ?? 'Version'} — ${new Date(version.date).toLocaleString()}`).join('\n');
    const answer = window.prompt(`Choose a version number to restore:\n${choices}`, String(versions.length));
    const index = Number(answer) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= versions.length) return;
    if (!window.confirm(`Restore “${versions[index].name ?? 'Version'}”? Current content will be replaced.`)) return;
    try { loadSnapshot(editor.store, versions[index].snapshot as Parameters<typeof loadSnapshot>[1]); setProposal(null); setStatus('Version restored. Undo is available.'); }
    catch { setStatus('That saved version could not be restored.'); }
  }

  function exportBoard() {
    if (!editor) return;
    const exportData = { format: 'visual-workspace-board', version: 1, name: board.name, snapshot: getSnapshot(editor.store) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${board.name.replace(/[^\w.-]+/g, '-') || 'board'}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Board exported as JSON.');
  }

  async function importBoard(file?: File) {
    if (!file || !editor) return;
    try {
      if (file.size > 20_000_000) throw new Error('Board file exceeds the 20 MB import limit.');
      const parsed = JSON.parse(await file.text());
      const snapshot = parsed?.format === 'visual-workspace-board' ? parsed.snapshot : parsed;
      if (!snapshot || typeof snapshot !== 'object' || !snapshot.store) throw new Error('That file is not a supported board export.');
      if (!window.confirm('Import this file into the current board? Current canvas content will be replaced.')) return;
      loadSnapshot(editor.store, snapshot); setProposal(null); setStatus('Board imported.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not import this board.'); }
  }

  async function addAttachments(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    if (incoming.some((file) => file.size > 20 * 1024 * 1024)) { setStatus('Each attachment must be 20 MB or smaller.'); return; }
    try {
      for (const file of incoming) await saveAttachment({ id: crypto.randomUUID(), boardId: active, name: file.name.slice(0, 255), type: file.type, size: file.size, createdAt: new Date().toISOString(), blob: file });
      setAttachments(await listAttachments(active)); setStatus(`${incoming.length} attachment${incoming.length === 1 ? '' : 's'} stored in this browser.`);
    } catch { setStatus('Could not store files. Check available browser storage.'); }
  }

  async function downloadAttachment(file: LocalAttachment) {
    const url = URL.createObjectURL(file.blob); const link = document.createElement('a');
    link.href = url; link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function deleteAttachment(file: LocalAttachment) {
    try { await removeAttachment(file.id); setAttachments((old) => old.filter((item) => item.id !== file.id)); }
    catch { setStatus('Could not delete this attachment.'); }
  }

  return <main className="app-shell">
    <header className="topbar">
      <button className="brand-home" onClick={() => setView('dashboard')} aria-label="Open workspace dashboard"><span className="brand-mark" aria-hidden="true">V</span><strong className="brand-name">Visual Workspace</strong></button>
      <div className="breadcrumb"><button onClick={() => setView('dashboard')}>My workspace</button>{view !== 'dashboard' && <><span className="crumb-sep">/</span><button onClick={() => setView('project')}>{project.name}</button>{(view === 'board' || view === 'item') && <><span className="crumb-sep">/</span><strong>{view === 'board' ? board.name : selectedItem.name}</strong></>}</>}</div>
      <div className="top-actions">
        {view === 'board' && <><span className="save-state"><i />{savedAt ? `Saved ${savedAt}` : 'Local autosave'}</span>
        <button onClick={() => editor?.undo()} title="Undo">↶</button><button onClick={() => editor?.redo()} title="Redo">↷</button>
        <button onClick={saveVersion}>Save version</button><button onClick={restoreVersion}>History</button>
        <button onClick={exportBoard}>Export</button>
        <label className="button-label">Import<input type="file" accept="application/json,.json" onChange={(event) => { void importBoard(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></>}
        <button className="theme-toggle" onClick={() => setTheme((old) => old === 'light' ? 'dark' : 'light')} title="Toggle theme">{theme === 'light' ? '☾' : '☼'}</button>
      </div>
    </header>
    {view !== 'board' && view !== 'item' && <ProjectsPage projects={projects} boards={boards} projectId={view === 'project' ? activeProject : null} onSelectProject={(id) => { if (!id) { setView('dashboard'); return; } setActiveProject(id); setView('project'); }} onCreateProject={createProject} onCreateBoard={(projectId) => createBoard(null, projectId)} onOpenBoard={openNavigationItem} onRenameProject={renameProject} />}
    {(view === 'board' || view === 'item') && <section className="workspace-layout">
      <aside className="left-sidebar">
        <div className="sidebar-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Items</h2></div><CreateItemMenu parent={null} onCreate={createNavigationItem} /></div>
        <BoardNavigation boards={boards.filter((item) => item.projectId === activeProject)} active={active} query={query} onQueryChange={setQuery} onSelect={openNavigationItem} onDetails={openItemDetails} onCreate={createNavigationItem} onRename={renameBoard} onDuplicate={duplicateBoard} onDelete={deleteBoard} />
        <div className="new-subboard"><span>Add inside {selectedItem.name}</span><CreateItemMenu parent={selectedItem.id} onCreate={createNavigationItem} /></div>
        <div className="sidebar-bottom"><span className="status-dot"/>Local workspace <small>Browser storage</small></div>
      </aside>
      <div className="canvas-region">{view === 'board' ? <><div className="canvas-heading"><div><span className="eyebrow">VISUAL BOARD</span><h1>{board.name}</h1></div><span className="canvas-hint">Changes save automatically on this device</span></div><div className="canvas"><Tldraw key={active} onMount={mount} /><div className="canvas-controls" aria-label="Canvas view controls"><button title="Zoom out" onClick={() => editor?.zoomOut()}>−</button><span>{zoomPercent}%</span><button title="Zoom in" onClick={() => editor?.zoomIn()}>＋</button><i/><button title="Fit selection" onClick={() => editor?.zoomToSelection()}>Fit selection</button><button title="Fit board" onClick={() => editor?.zoomToFit()}>Fit board</button></div></div></> : <NavigationItemPage item={selectedItem} items={boards} onUpdate={updateNavigationItem} onCreate={createNavigationItem} onOpen={openNavigationItem} onOpenBoard={openBoard} />}</div>
      <aside className="right-sidebar">
        <div className="panel-tabs"><button className={`panel-tab ${rightTab === 'copilot' ? 'active' : ''}`} onClick={() => setRightTab('copilot')}>AI Copilot</button><button className={`panel-tab ${rightTab === 'files' ? 'active' : ''}`} onClick={() => setRightTab('files')}>Files ({attachments.length})</button></div>
        {rightTab === 'copilot' ? <>
        <div className="copilot-intro"><div className="ai-icon" aria-hidden="true">✳</div><h2>AI Copilot</h2><p>Describe a diagram, refine selected shapes, or ask for an analysis.</p></div>
        <div className={`ai-connection ${aiStatus}`} role="status"><i />{aiStatus === 'ready' ? 'Codex connected' : aiStatus === 'checking' ? 'Checking Codex connection…' : aiStatus === 'unconfigured' ? codexAvailable ? 'Sign in to connect Codex' : 'Codex CLI not found' : 'AI backend is offline'}{aiStatus !== 'ready' && <button onClick={() => void checkAI()}>Check</button>}</div>
        <section className="provider-connect" aria-labelledby="provider-title">
          <div className="provider-heading"><div><span className="eyebrow">CHATGPT ACCOUNT</span><h3 id="provider-title">Connect Codex</h3></div></div>
          <p className="provider-note">Sign in through Codex in the browser with your email, then approve the account connection. No API key is used. The AI model runs online through your ChatGPT/Codex sign-in; the local Codex CLI is only the secure bridge.</p>
          {codexConnected ? <div className="provider-connected"><span>Connected with <strong>Codex / ChatGPT</strong></span><small>To disconnect, use <code>codex logout</code> in a terminal.</small></div> : <button className="primary connect-button" disabled={codexBusy || !codexAvailable} onClick={() => void connectCodex()}>{codexBusy ? 'Waiting for sign-in…' : codexAvailable ? 'Connect Codex with ChatGPT' : 'Codex CLI not installed'}</button>}
          {codexMessage && <p className="provider-message" role="status">{codexMessage}</p>}
        </section>
        <div className="learning-controls"><label><input type="checkbox" checked={learningEnabled} onChange={(event) => setLearningEnabled(event.target.checked)} /> Learn from my feedback</label><p>{learningEnabled ? `${learningMemories.length} feedback examples saved on this device. Relevant examples can guide future AI requests; this does not train model weights.` : 'Feedback examples are not used in AI requests.'}</p>{learningMemories.length > 0 && <button onClick={clearLearningMemory}>Clear project memory</button>}</div>
        <label className="field-label" htmlFor="mode">Mode</label><select id="mode" value={mode} onChange={(event) => { setMode(event.target.value as Mode); setProposal(null); }}><option value="generate">Generate</option><option value="modify">Modify selected</option><option value="analyze">Analyze</option></select>
        <label className="field-label" htmlFor="prompt">Instructions</label><textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="For example: map the steps in a patient check-in workflow…" />
        <button className="primary ask-button" disabled={busy || !prompt.trim() || aiStatus !== 'ready'} onClick={() => void ask()}>{busy ? <><span className="spinner"/>Thinking…</> : '✳  Create proposal'}</button>
        <p className="status-message" role="status">{status}</p>
        {proposal && <div className="proposal-card"><div className="proposal-title"><strong>Proposal preview</strong><button className="text-button" onClick={rejectProposal}>Discard</button></div><p>{proposal.summary}</p>
          {proposal.nodes.map((node, index) => <label className="proposal-change" key={`node-${index}`}><input type="checkbox" checked={selectedNodes.includes(index)} onChange={(event) => setSelectedNodes((old) => event.target.checked ? [...old, index] : old.filter((item) => item !== index))}/><span className="change-tag added">NEW</span><span>{node.label}</span></label>)}
          {proposal.updates.map((update) => <p className="proposal-update" key={update.id}><span className="change-tag edited">EDIT</span>{update.label}</p>)}
          <div className="proposal-actions">{mode !== 'analyze' && <><button className="primary" onClick={() => applyProposal(true)}>Apply all</button><button onClick={() => applyProposal(false)}>Apply selected</button></>}<button onClick={rejectProposal}>Reject all</button></div>
        </div>}
        </> : <div className="attachments-section files-tab"><div className="section-title"><div><span className="eyebrow">BOARD FILES</span><h3>Attachments</h3></div><label className="icon-button upload-button" title="Upload attachments">＋<input type="file" multiple onChange={(event) => { void addAttachments(event.target.files); event.currentTarget.value = ''; }} /></label></div>
          {attachments.length ? <ul className="file-list">{attachments.map((file) => <li key={file.id}><button className="file-name" onClick={() => void downloadAttachment(file)} title="Download file">▤ <span>{file.name}</span><small>{(file.size / 1024).toFixed(0)} KB</small></button><button className="remove-file" onClick={() => void deleteAttachment(file)} aria-label={`Delete ${file.name}`}>×</button></li>)}</ul> : <p className="empty-files">Files you add are stored privately in this browser.</p>}
        </div>}
      </aside>
    </section>}
  </main>;
}

export default App;

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ArchitectureCommand } from './features/architecture/ArchitectureDesigner';
const ArchitectureDesigner = lazy(() => import('./features/architecture/ArchitectureDesigner'));
import { createBindingId, createShapeId, getSnapshot, loadSnapshot, Tldraw, toRichText } from 'tldraw';
import type { Editor, TLShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import './style.css';
import BoardNavigation from './features/navigation/BoardNavigation';
import { CreateItemMenu } from './features/navigation/BoardNavigation';
import NavigationItemPage from './features/navigation/NavigationItemPage';
import ProjectsPage from './features/projects/ProjectsPage';
import TerminalPanel from './features/terminal/TerminalPanel';
import type { Board, NavigationKind } from './types/board';
import { NAVIGATION_KINDS, navigationKind } from './types/board';
import type { Project } from './types/project';
import { listAttachments, removeAttachment, saveAttachment } from './utils/localFiles';
import type { LocalAttachment } from './utils/localFiles';

type Mode = 'generate' | 'modify' | 'analyze';
type Proposal = {
  id?: number;
  summary: string;
  nodes: { label: string; x: number; y: number }[];
  updates: { id: string; label: string }[];
  connectors?: { from_label: string; to_label: string; label?: string }[];
  source?: string;
  domain?: string;
  confidence?: number;
  score?: number;
  history_count?: number;
};
interface KBInfo {
  ready: boolean;
  patternsCount: number;
  domains: string[];
  customLearnedCount: number;
  engine: string;
}
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
interface ConnectedAI {
  id: string;
  name: string;
  version?: string;
  available?: boolean;
  connected?: boolean;
  running?: boolean;
  status_label?: string;
  description?: string;
}

const safeName = (value: string) => value.trim().slice(0, 100);

const VALID_TLDRAW_COLORS = new Set([
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white',
]);

function sanitizeTldrawColor(
  rawColor: unknown
): 'black' | 'grey' | 'light-violet' | 'violet' | 'blue' | 'light-blue' | 'yellow' | 'orange' | 'green' | 'light-green' | 'light-red' | 'red' | 'white' {
  if (typeof rawColor !== 'string') return 'blue';
  const c = rawColor.toLowerCase().trim();
  if (VALID_TLDRAW_COLORS.has(c)) {
    return c as any;
  }
  if (c === 'purple') return 'violet';
  if (c === 'pink') return 'light-violet';
  if (c === 'cyan' || c === 'teal' || c === 'sky' || c === 'aqua') return 'light-blue';
  if (c === 'lime') return 'light-green';
  if (c === 'amber' || c === 'gold') return 'orange';
  if (c === 'gray' || c === 'silver') return 'grey';
  if (c === 'dark') return 'black';
  return 'blue';
}

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const stored = read<unknown>('projects', [DEFAULT_PROJECT]);
    if (!Array.isArray(stored)) return [DEFAULT_PROJECT];
    const valid = stored.filter((item): item is Project => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.color === 'string');
    return valid;
  });
  const [boards, setBoards] = useState<Board[]>(() => {
    const stored = read<unknown>('tree', [DEFAULT_BOARD]);
    if (!Array.isArray(stored)) return [DEFAULT_BOARD];
    const projectIds = new Set(projects.map((project) => project.id));
    const fallbackProjectId = projects[0]?.id ?? DEFAULT_PROJECT.id;
    const valid = stored.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && (typeof item.parent === 'string' || item.parent === null));
    return valid.map((item) => ({ ...item, kind: NAVIGATION_KINDS.some((entry) => entry.kind === item.kind) ? item.kind : 'board', projectId: typeof item.projectId === 'string' && projectIds.has(item.projectId) ? item.projectId : fallbackProjectId }));
  });
  const [activeProject, setActiveProject] = useState(() => {
    const stored = read<unknown>('active-project', DEFAULT_PROJECT.id);
    return typeof stored === 'string' && projects.some((project) => project.id === stored) ? stored : projects[0]?.id ?? DEFAULT_PROJECT.id;
  });
  const [view, setView] = useState<'dashboard' | 'project' | 'board' | 'item'>('dashboard');
  const [aiStatus, setAiStatus] = useState<'checking' | 'offline' | 'unconfigured' | 'ready'>('checking');
  const [aiMode, setAiMode] = useState<'hybrid' | 'knowledge_base'>('knowledge_base');
  const [kbInfo, setKbInfo] = useState<KBInfo | null>(null);
  const [isTeachingKB, setIsTeachingKB] = useState(false);
  const [codexConnected, setCodexConnected] = useState(false);
  const [codexAvailable, setCodexAvailable] = useState(false);
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexMessage, setCodexMessage] = useState('');
  const [opencodeConnected, setOpencodeConnected] = useState(true);
  const [activeAI, setActiveAI] = useState<string>('opencode');
  const [connectedAIs, setConnectedAIs] = useState<ConnectedAI[]>([]);
  const [isQuickDesigning, setIsQuickDesigning] = useState(false);
  const [active, setActive] = useState(() => {
    const stored = read<unknown>('active-board', DEFAULT_BOARD.id);
    return typeof stored === 'string' && boards.some((item) => item.id === stored) ? stored : boards[0]?.id ?? DEFAULT_BOARD.id;
  });
  const [canvasMode, setCanvasMode] = useState<'whiteboard' | 'architecture'>('whiteboard');
  const [architectureCommand, setArchitectureCommand] = useState<ArchitectureCommand | null>(null);
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
  const [rightTab, setRightTab] = useState<'copilot' | 'files' | 'terminal'>('copilot');
  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = read<number>('left-panel-width', 248);
    return typeof saved === 'number' && saved >= 160 && saved <= 450 ? saved : 248;
  });
  const [terminalWidth, setTerminalWidth] = useState<number>(() => {
    const defaultTerm = typeof window !== 'undefined' ? Math.max(480, Math.round(window.innerWidth * 0.44)) : 560;
    const saved = read<number>('terminal-panel-width', defaultTerm);
    return typeof saved === 'number' && saved >= 300 ? saved : defaultTerm;
  });
  const [copilotWidth, setCopilotWidth] = useState<number>(() => {
    const saved = read<number>('copilot-panel-width', 340);
    return typeof saved === 'number' && saved >= 280 ? saved : 340;
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<'left' | 'right' | null>(null);

  const currentRightWidth = rightTab === 'terminal' ? terminalWidth : copilotWidth;

  const startResizingRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter('right');
  };

  const startResizingLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter('left');
  };

  const resetOrToggleRightWidth = () => {
    const totalAvail = window.innerWidth - leftWidth;
    const halfSplit = Math.round(totalAvail * 0.5);
    const defaultWidth = rightTab === 'terminal' ? Math.max(480, Math.round(window.innerWidth * 0.44)) : 340;

    if (Math.abs(currentRightWidth - halfSplit) < 30) {
      if (rightTab === 'terminal') {
        setTerminalWidth(defaultWidth);
        localStorage.setItem('terminal-panel-width', JSON.stringify(defaultWidth));
      } else {
        setCopilotWidth(defaultWidth);
        localStorage.setItem('copilot-panel-width', JSON.stringify(defaultWidth));
      }
    } else {
      if (rightTab === 'terminal') {
        setTerminalWidth(halfSplit);
        localStorage.setItem('terminal-panel-width', JSON.stringify(halfSplit));
      } else {
        setCopilotWidth(halfSplit);
        localStorage.setItem('copilot-panel-width', JSON.stringify(halfSplit));
      }
    }
    window.dispatchEvent(new Event('resize'));
  };

  const resetLeftWidth = () => {
    setLeftWidth(248);
    localStorage.setItem('left-panel-width', JSON.stringify(248));
    window.dispatchEvent(new Event('resize'));
  };

  const setRightWidthPreset = (preset: 'compact' | 'half' | 'wide') => {
    const totalAvail = window.innerWidth - leftWidth;
    let target = 440;
    if (preset === 'compact') target = Math.round(totalAvail * 0.35);
    else if (preset === 'half') target = Math.round(totalAvail * 0.5);
    else if (preset === 'wide') target = Math.round(totalAvail * 0.65);

    const clamped = Math.max(280, Math.min(target, window.innerWidth - leftWidth - 280));
    if (rightTab === 'terminal') {
      setTerminalWidth(clamped);
      localStorage.setItem('terminal-panel-width', JSON.stringify(clamped));
    } else {
      setCopilotWidth(clamped);
      localStorage.setItem('copilot-panel-width', JSON.stringify(clamped));
    }
    window.dispatchEvent(new Event('resize'));
  };

  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSplitter === 'right') {
        const newRight = window.innerWidth - e.clientX;
        const maxRight = window.innerWidth - leftWidth - 280;
        const clamped = Math.max(280, Math.min(newRight, maxRight));

        if (rightTab === 'terminal') {
          setTerminalWidth(clamped);
          localStorage.setItem('terminal-panel-width', JSON.stringify(clamped));
        } else {
          setCopilotWidth(clamped);
          localStorage.setItem('copilot-panel-width', JSON.stringify(clamped));
        }
      } else if (isDraggingSplitter === 'left') {
        const newLeft = e.clientX;
        const maxLeft = Math.min(450, window.innerWidth - currentRightWidth - 280);
        const clamped = Math.max(160, Math.min(newLeft, maxLeft));
        setLeftWidth(clamped);
        localStorage.setItem('left-panel-width', JSON.stringify(clamped));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(null);
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter, leftWidth, rightTab, currentRightWidth]);
  const [savedAt, setSavedAt] = useState('');
  const [zoomPercent, setZoomPercent] = useState(100);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [learningEnabled, setLearningEnabled] = useState(() => read<boolean>('ai-learning-enabled', true));
  const [learningMemories, setLearningMemories] = useState<FeedbackMemory[]>(() => read<FeedbackMemory[]>(`ai-feedback:${activeProject}`, []));
  const board = boards.find((item) => item.id === active) ?? boards[0] ?? DEFAULT_BOARD;
  const selectedItem = boards.find((item) => item.id === active) ?? board;
  const project = projects.find((item) => item.id === (view === 'board' ? board.projectId : activeProject)) ?? projects[0] ?? DEFAULT_PROJECT;
  const [lastDiskMtime, setLastDiskMtime] = useState<number>(0);
  const deletedItemsRef = useRef(new Set<string>());
  const deletingRef = useRef(false);
  const isSyncingFromDiskRef = useRef(false);

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
      const response = await fetch(`/api/health?projectId=${encodeURIComponent(project.id)}`);
      if (!response.ok) throw new Error('offline');
      const health = await response.json();
      setCodexAvailable(Boolean(health.codex_available));
      setCodexConnected(Boolean(health.codex_connected));
      setOpencodeConnected(Boolean(health.opencode_connected));
      if (health.active_ai) {
        setActiveAI(health.active_ai);
      }
      if (Array.isArray(health.connected_ais)) {
        setConnectedAIs(health.connected_ais);
      }
      setAiMode(health.ai_mode || (health.codex_connected || health.opencode_connected ? 'hybrid' : 'knowledge_base'));
      setAiStatus('ready');
      setCodexMessage(health.message || '');
      if (health.knowledge_base) {
        setKbInfo(health.knowledge_base);
      }
    } catch {
      setAiStatus('offline');
    }
  }

  async function switchAIProvider(providerId: string) {
    setActiveAI(providerId);
    try {
      await fetch('/api/ai/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });
      const name = providerId === 'opencode' ? 'OpenCode' : providerId === 'codex' ? 'OpenAI Codex' : providerId === 'claude' ? 'Claude Code' : 'Knowledge Base';
      setStatus(`Active AI switched to ${name}`);
    } catch {
      // ignore
    }
  }

  async function runQuickDesign(blueprintOrPrompt: string, isBlueprint: boolean = true) {
    if (canvasMode === 'architecture') { setArchitectureCommand({prompt:blueprintOrPrompt,mode:'generate',nonce:Date.now()}); return; }
    if (isQuickDesigning) return;
    setIsQuickDesigning(true);
    setStatus(`OpenCode designing ${blueprintOrPrompt} on Visual Board…`);
    try {
      const res = await fetch(`/api/projects/${board.projectId}/board/quick-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isBlueprint ? { blueprint: blueprintOrPrompt } : { prompt: blueprintOrPrompt }),
      });
      if (res.ok) {
        setStatus(`✓ Visual Board updated with ${blueprintOrPrompt}!`);
        await syncBoardFromDisk();
      } else {
        setStatus(`Failed to generate design.`);
      }
    } catch {
      setStatus(`Error designing board.`);
    } finally {
      setIsQuickDesigning(false);
    }
  }

  async function teachKBFromCurrentBoard() {
    if (!editor || isTeachingKB) return;
    setIsTeachingKB(true);
    try {
      const allRecords = editor.store.allRecords() as any[];
      const shapes = editor.getCurrentPageShapes().map((shape) => {
        const raw: any = {
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          props: shape.props,
          locked: shape.isLocked,
        };
        if (shape.type === 'arrow') {
          const bindings = allRecords.filter((r) => r.typeName === 'binding' && r.fromId === shape.id);
          const startB = bindings.find((b) => b.props?.terminal === 'start');
          const endB = bindings.find((b) => b.props?.terminal === 'end');
          if (startB?.toId || endB?.toId) {
            raw.props = {
              ...(raw.props || {}),
              start: { ...(raw.props?.start || {}), boundShapeId: startB?.toId },
              end: { ...(raw.props?.end || {}), boundShapeId: endB?.toId },
            };
          }
        }
        return raw;
      });

      if (!shapes.some((s) => s.type === 'geo')) {
        setStatus('Please create or load workflow steps on the board before teaching the Knowledge Base.');
        return;
      }

      const res = await fetch('/api/knowledge-base/learn-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: board.id,
        title: board.name,
          shapes,
          projectId: board.projectId,
        }),
      });

      if (!res.ok) throw new Error('Failed to teach knowledge base');
      const data = await res.json();
      setStatus(`🧠 Knowledge Base updated! Learned pattern: "${data.title || board.name}" (${data.domain || 'Custom Architecture'}).`);
      void checkAI();
    } catch {
      setStatus('Could not save pattern to Knowledge Base.');
    } finally {
      setIsTeachingKB(false);
    }
  }

  async function sendFeedback(id?: number, good?: boolean) {
    if (!id) return;
    try {
      const res = await fetch('/api/knowledge-base/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, good: Boolean(good) }),
      });
      if (res.ok) {
        const data = await res.json();
        setProposal((old) => old ? { ...old, score: data.score } : null);
        setStatus(`Feedback saved. ${good ? '👍' : '👎'} Trust score updated to ${Math.round(data.score * 100)}%.`);
        void checkAI();
      }
    } catch {
      setStatus('Could not save feedback.');
    }
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

  function renderDiagramToEditor(editorInstance: Editor, data: any) {
    if (!editorInstance || !data) return;
    if (data.version === 3 && Array.isArray(data.modules)) { setStatus('Semantic workflow detected. Import workflow.spec.json in Architecture mode.'); return; }
    if (data.store && data.schema) {
      try {
        loadSnapshot(editorInstance.store, data);
        return;
      } catch {
        // fallback
      }
    }

    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    if (!nodes.length) return;

    isSyncingFromDiskRef.current = true;
    editorInstance.run(() => {
      const existing = editorInstance.getCurrentPageShapes();
      if (existing.length) {
        editorInstance.deleteShapes(existing.map((s) => s.id));
      }

      const shapeIdMap = new Map<string, any>();
      for (const n of nodes) {
        const id = createShapeId();
        shapeIdMap.set(String(n.id ?? n.label), id);
        try {
          editorInstance.createShape({
            id,
            type: 'geo',
            x: Number(n.x) || 100,
            y: Number(n.y) || 100,
            props: {
              geo: n.geo || 'rectangle',
              w: Number(n.w) || 240,
              h: Number(n.h) || 100,
              color: sanitizeTldrawColor(n.color),
              richText: toRichText(String(n.label || 'Node')),
            },
          });
        } catch (err) {
          console.warn('Failed to render shape safely:', err);
        }
      }

      const arrows = Array.isArray(data.arrows) ? data.arrows : [];
      for (const a of arrows) {
        const fromId = shapeIdMap.get(String(a.from));
        const toId = shapeIdMap.get(String(a.to));
        if (fromId && toId) {
          const fromShape = editorInstance.getShape(fromId);
          const toShape = editorInstance.getShape(toId);
          if (fromShape && toShape) {
            const fromW = (fromShape.props as any)?.w || 240;
            const fromH = (fromShape.props as any)?.h || 100;
            const toH = (toShape.props as any)?.h || 100;

            const startX = fromShape.x + fromW;
            const startY = fromShape.y + fromH / 2;
            const targetX = toShape.x;
            const targetY = toShape.y + toH / 2;

            const dx = targetX - startX;
            const dy = targetY - startY;

            const arrowId = createShapeId();
            try {
              editorInstance.createShape({
                id: arrowId,
                type: 'arrow',
                x: startX,
                y: startY,
                props: {
                  start: { x: 0, y: 0 },
                  end: { x: dx, y: dy },
                  arrowheadEnd: 'arrow',
                  arrowheadStart: 'none',
                  richText: a.label ? toRichText(String(a.label)) : undefined,
                  color: sanitizeTldrawColor(a.color),
                },
              });
            } catch (err) {
              console.warn('Failed to render arrow safely:', err);
            }

            try {
              editorInstance.createBindings([
                {
                  id: createBindingId(),
                  typeName: 'binding',
                  type: 'arrow',
                  fromId: arrowId,
                  toId: fromId,
                  props: {
                    terminal: 'start',
                    normalizedAnchor: { x: 1, y: 0.5 },
                    isExact: false,
                    isPrecise: false,
                  },
                },
                {
                  id: createBindingId(),
                  typeName: 'binding',
                  type: 'arrow',
                  fromId: arrowId,
                  toId: toId,
                  props: {
                    terminal: 'end',
                    normalizedAnchor: { x: 0, y: 0.5 },
                    isExact: false,
                    isPrecise: false,
                  },
                },
              ]);
            } catch {
              // ignore
            }
          }
        }
      }
    });

    window.setTimeout(() => {
      try {
        editorInstance.zoomToFit();
        isSyncingFromDiskRef.current = false;
      } catch {
        isSyncingFromDiskRef.current = false;
      }
    }, 150);
  }

  async function saveBoardToDisk(editorInstance: Editor) {
    if (!editorInstance || isSyncingFromDiskRef.current) return;
    try {
      const shapes = editorInstance.getCurrentPageShapes();
      const nodes = shapes.filter((s) => s.type === 'geo').map((s) => {
        let label = '';
        const rich = (s.props as any)?.richText;
        if (rich?.content) {
          label = rich.content.map((p: any) => p.content?.map((t: any) => t.text).join('')).join('\n');
        }
        return {
          id: s.id,
          label: label || 'Node',
          x: s.x,
          y: s.y,
          w: (s.props as any)?.w || 240,
          h: (s.props as any)?.h || 100,
          color: (s.props as any)?.color || 'blue',
        };
      });

      const arrows = shapes.filter((s) => s.type === 'arrow').map((s) => {
        const start = (s.props as any)?.start;
        const end = (s.props as any)?.end;
        return {
          from: start?.boundShapeId,
          to: end?.boundShapeId,
        };
      }).filter((a) => a.from && a.to);

      const payload = {
        boardId: board.id,
        title: board.name,
        nodes,
        arrows,
      };

      const res = await fetch(`/api/projects/${board.projectId}/board`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: payload }),
      });
      if (res.ok) {
        const resData = await res.json();
        setLastDiskMtime(resData.mtime || Date.now());
      }
    } catch {
      // ignore
    }
  }

  async function syncBoardFromDisk() {
    if (!editor) return;
    try {
      const res = await fetch(`/api/projects/${board.projectId}/board`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.board) {
          renderDiagramToEditor(editor, data.board);
          setLastDiskMtime(data.mtime);
          setStatus('Visual Board synced with project file (board.json).');
        }
      }
    } catch (err) {
      console.error('Failed to sync board from disk:', err);
    }
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
      try {
        localStorage.removeItem(`board:${active}`);
      } catch {
        // ignore
      }
      setStatus('Corrupt board data cleared. Syncing fresh board.');
    }

    // Initial check and load from project disk file (board.json)
    fetch(`/api/projects/${board.projectId}/board`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!deletedItemsRef.current.has(active) && data?.exists && data?.board && (!data.board.boardId || data.board.boardId === active)) {
          setLastDiskMtime(data.mtime);
          renderDiagramToEditor(nextEditor, data.board);
        }
      })
      .catch(() => {});

    let saveTimer: number | undefined;
    const stopListening = nextEditor.store.listen(() => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        if (deletedItemsRef.current.has(active)) return;
        try {
          localStorage.setItem(`board:${active}`, JSON.stringify(getSnapshot(nextEditor.store)));
          setSavedAt(new Date().toLocaleTimeString());
          void saveBoardToDisk(nextEditor);
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
          if (deletedItemsRef.current.has(active)) return;
          try { localStorage.setItem(`camera:${active}`, serializedCamera); } catch { /* camera state is optional to restore */ }
        }, 450);
      }
    }, { scope: 'session' });
    return () => {
      if (saveTimer !== undefined) {
        window.clearTimeout(saveTimer);
        try { if (!deletedItemsRef.current.has(active)) localStorage.setItem(`board:${active}`, JSON.stringify(getSnapshot(nextEditor.store))); } catch { /* the app reports quota errors during normal saves */ }
      }
      if (cameraTimer !== undefined) {
        window.clearTimeout(cameraTimer);
        try { if (!deletedItemsRef.current.has(active)) localStorage.setItem(`camera:${active}`, lastCamera); } catch { /* camera state is optional to restore */ }
      }
      stopListening(); stopCameraListening();
    };
  }

  useEffect(() => {
    if (!editor || view !== 'board') return;
    let live = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${board.projectId}/board`);
        if (!res.ok || !live) return;
        const data = await res.json();
        if (!deletedItemsRef.current.has(active) && (!data.board?.boardId || data.board.boardId === active) && data.exists && data.mtime && data.mtime > lastDiskMtime && !isSyncingFromDiskRef.current) {
          setLastDiskMtime(data.mtime);
          renderDiagramToEditor(editor, data.board);
          setStatus('Board updated from project files (board.json).');
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [editor, board.projectId, lastDiskMtime, view]);

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

  async function deleteItems(items: Board[], deletedProject?: Project) {
    if (deletingRef.current) return;
    deletingRef.current = true;
    const remove = new Set(items.map((item) => item.id));
    for (const id of remove) deletedItemsRef.current.add(id);
    try {
      const projectId = deletedProject?.id ?? items[0].projectId;
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/board-data`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_ids: [...remove], board_names: items.filter((item) => navigationKind(item) === 'board').map((item) => item.name), delete_project: !!deletedProject,
          delete_legacy: !boards.some((item) => item.projectId === projectId && navigationKind(item) === 'board' && !remove.has(item.id)) }),
      });
      if (!response.ok) throw new Error('Could not delete saved board data on disk.');
      for (const id of remove) {
        for (const file of await listAttachments(id)) await removeAttachment(file.id);
        for (const prefix of ['board', 'versions', 'camera']) localStorage.removeItem(`${prefix}:${id}`);
      }
      setBoards((old) => old.filter((item) => !remove.has(item.id)));
      if (deletedProject) {
        localStorage.removeItem(`ai-feedback:${deletedProject.id}`);
        setProjects((old) => old.filter((item) => item.id !== deletedProject.id));
        setView('dashboard');
      } else if (remove.has(active)) setView('project');
      if (remove.has(active)) { setEditor(null); setActive(''); setAttachments([]); }
      setProposal(null);
    } catch (error) {
      for (const id of remove) deletedItemsRef.current.delete(id);
      window.alert(`${error instanceof Error ? error.message : 'Could not finish deleting data.'} Please retry deletion.`);
    } finally { deletingRef.current = false; }
  }

  async function deleteProject(item: Project) {
    if (!window.confirm(`Delete “${item.name}” and all its workspace items, board data, saved versions and attachments? This cannot be undone.`)) return;
    await deleteItems(boards.filter((board) => board.projectId === item.id), item);
  }

  async function deleteBoard(item: Board) {
    if (!window.confirm(`Delete “${item.name}” and all nested items, board data, saved versions and attachments? This cannot be undone.`)) return;
    const remove = new Set([item.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of boards) if (candidate.projectId === item.projectId && candidate.parent && remove.has(candidate.parent) && !remove.has(candidate.id)) {
        remove.add(candidate.id); changed = true;
      }
    }
    await deleteItems(boards.filter((item) => remove.has(item.id)));
  }

  async function ask() {
    if (canvasMode === 'architecture') {
      if (prompt.trim()) setArchitectureCommand({prompt:prompt.trim(),mode,nonce:Date.now()});
      return;
    }
    if (!editor || !prompt.trim() || busy) return;
    if (aiStatus === 'offline') {
      setStatus('AI backend is offline. Start the backend, then check status again.');
      return;
    }
    setBusy(true); setProposal(null);
    const shapes = currentShapes();
    setProposalPrompt(prompt.trim());
    setProposalBase(JSON.stringify(shapes));
    try {
      const response = await fetch('/api/propose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: prompt.trim(),
          shapes,
          selected: editor.getSelectedShapeIds(),
          learning_examples: relevantLearningExamples(prompt.trim()),
          projectId: board.projectId,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `AI request failed (${response.status}).`);
      }
      const result = await response.json() as Proposal;
      setProposal(result); setSelectedNodes(result.nodes.map((_, index) => index));
      setStatus(result.source === 'knowledge_base' ? `Proposal ready from Knowledge Base Engine (${result.domain || 'Offline Blueprint'}).` : 'Proposal ready from Codex CLI.');
      void checkAI();
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
      const createdNodes: { label: string; id: TLShapeId }[] = [];
      proposal.nodes.forEach((node, index) => {
        if (all || selectedNodes.includes(index)) {
          const id = createShapeId();
          editor.createShape({ id, type: 'geo', x: node.x, y: node.y, props: { geo: 'rectangle', w: 220, h: 100, richText: toRichText(node.label) } });
          createdNodes.push({ label: node.label, id });
        }
      });
      if (all) proposal.updates.forEach((update) => {
        const shape = editor.getShape(update.id as never);
        if (shape?.type === 'geo' && !shape.isLocked) editor.updateShape({ id: shape.id, type: 'geo', props: { richText: toRichText(update.label) } });
      });

      if (all && proposal.connectors && proposal.connectors.length > 0) {
        const labelToId = new Map<string, TLShapeId>();
        createdNodes.forEach(({ label, id }) => {
          labelToId.set(label.toLowerCase().trim(), id);
          const firstLine = label.split('\n')[0].trim().toLowerCase();
          if (firstLine) labelToId.set(firstLine, id);
        });
        editor.getCurrentPageShapes().forEach((s) => {
          if (s.type === 'geo') {
            const rich = (s.props as any)?.richText;
            let text = '';
            if (typeof rich === 'string') text = rich;
            else if (rich?.content?.[0]?.content?.[0]?.text) text = rich.content[0].content[0].text;
            if (text) {
              labelToId.set(text.toLowerCase().trim(), s.id);
              const firstLine = text.split('\n')[0].trim().toLowerCase();
              if (firstLine) labelToId.set(firstLine, s.id);
            }
          }
        });

        for (const conn of proposal.connectors) {
          const fromId = labelToId.get(conn.from_label.toLowerCase().trim()) || labelToId.get(conn.from_label.split('\n')[0].trim().toLowerCase());
          const toId = labelToId.get(conn.to_label.toLowerCase().trim()) || labelToId.get(conn.to_label.split('\n')[0].trim().toLowerCase());
          if (fromId && toId && fromId !== toId) {
            const fromShape = editor.getShape(fromId);
            const toShape = editor.getShape(toId);
            if (fromShape && toShape) {
              const startX = fromShape.x + 220;
              const startY = fromShape.y + 50;
              const targetX = toShape.x;
              const targetY = toShape.y + 50;
              const dx = targetX - startX;
              const dy = targetY - startY;

              const arrowId = createShapeId();
              editor.createShape({
                id: arrowId,
                type: 'arrow',
                x: startX,
                y: startY,
                props: {
                  start: { x: 0, y: 0 },
                  end: { x: dx, y: dy },
                  arrowheadEnd: 'arrow',
                  arrowheadStart: 'none',
                  richText: conn.label ? toRichText(conn.label) : undefined,
                },
              });

              try {
                editor.createBindings([
                  {
                    id: createBindingId(),
                    typeName: 'binding',
                    type: 'arrow',
                    fromId: arrowId,
                    toId: fromId,
                    props: {
                      terminal: 'start',
                      normalizedAnchor: { x: 1, y: 0.5 },
                      isExact: false,
                      isPrecise: false,
                    },
                  },
                  {
                    id: createBindingId(),
                    typeName: 'binding',
                    type: 'arrow',
                    fromId: arrowId,
                    toId: toId,
                    props: {
                      terminal: 'end',
                      normalizedAnchor: { x: 0, y: 0.5 },
                      isExact: false,
                      isPrecise: false,
                    },
                  },
                ]);
              } catch {
                // ignore
              }
            }
          }
        }
      }
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
        {view === 'board' && canvasMode === 'whiteboard' && <><span className="save-state"><i />{savedAt ? `Saved ${savedAt}` : 'Local autosave'}</span>
        <button onClick={() => void syncBoardFromDisk()} title="Sync canvas with project board.json on disk">↻ Sync Disk</button>
        <button onClick={() => editor?.undo()} title="Undo">↶</button><button onClick={() => editor?.redo()} title="Redo">↷</button>
        <button onClick={saveVersion}>Save version</button><button onClick={restoreVersion}>History</button>
        <button onClick={exportBoard}>Export</button>
        <label className="button-label">Import<input type="file" accept="application/json,.json" onChange={(event) => { void importBoard(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></>}
        <button className="theme-toggle" onClick={() => setTheme((old) => old === 'light' ? 'dark' : 'light')} title="Toggle theme">{theme === 'light' ? '☾' : '☼'}</button>
      </div>
    </header>
    {view !== 'board' && view !== 'item' && <ProjectsPage projects={projects} boards={boards} projectId={view === 'project' ? activeProject : null} onSelectProject={(id) => { if (!id) { setView('dashboard'); return; } setActiveProject(id); setView('project'); }} onCreateProject={createProject} onCreateBoard={(projectId) => createBoard(null, projectId)} onOpenBoard={openNavigationItem} onRenameProject={renameProject} onDeleteProject={deleteProject} onDeleteBoard={deleteBoard} />}
    {(view === 'board' || view === 'item') && <section className={`workspace-layout ${rightTab === 'terminal' ? 'terminal-mode' : ''} ${isDraggingSplitter ? 'is-resizing' : ''}`}>
      <aside className="left-sidebar" style={{ width: `${leftWidth}px` }}>
        <div className="sidebar-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Items</h2></div><CreateItemMenu parent={null} onCreate={createNavigationItem} /></div>
        <BoardNavigation boards={boards.filter((item) => item.projectId === activeProject)} active={active} query={query} onQueryChange={setQuery} onSelect={openNavigationItem} onDetails={openItemDetails} onCreate={createNavigationItem} onRename={renameBoard} onDuplicate={duplicateBoard} onDelete={deleteBoard} />
        <div className="new-subboard"><span>Add inside {selectedItem.name}</span><CreateItemMenu parent={selectedItem.id} onCreate={createNavigationItem} /></div>
        <div className="sidebar-bottom"><span className="status-dot"/>Local workspace <small>Browser storage</small></div>
      </aside>

      <div
        className={`panel-resizer left-resizer ${isDraggingSplitter === 'left' ? 'is-dragging' : ''}`}
        onMouseDown={startResizingLeft}
        onDoubleClick={resetLeftWidth}
        title="Drag to resize workspace items panel (double-click to reset)"
        role="separator"
        aria-orientation="vertical"
      >
        <div className="panel-resizer-grip" />
      </div>

      <div className="canvas-region">{view === 'board' ? <><div className="canvas-heading"><div><span className="eyebrow">VISUAL BOARD</span><h1>{board.name}</h1></div><div className="arch-mode-toggle"><button className={canvasMode === 'whiteboard' ? 'active' : ''} onClick={() => setCanvasMode('whiteboard')}>Whiteboard</button><button className={canvasMode === 'architecture' ? 'active' : ''} onClick={() => setCanvasMode('architecture')}>Architecture</button></div></div>{canvasMode === 'architecture' && <div className="canvas"><Suspense fallback={<p>Loading architecture designer…</p>}><ArchitectureDesigner key={active} projectId={board.projectId} boardId={active} title={board.name} theme={theme} command={architectureCommand} onStatus={setStatus}/></Suspense></div>}<div className="canvas" style={{display:canvasMode === 'whiteboard' ? undefined : 'none'}}><Tldraw key={active} onMount={mount} /><div className="canvas-controls" aria-label="Canvas view controls"><button title="Zoom out" onClick={() => editor?.zoomOut()}>−</button><span>{zoomPercent}%</span><button title="Zoom in" onClick={() => editor?.zoomIn()}>＋</button><i/><button title="Fit selection" onClick={() => editor?.zoomToSelection()}>Fit selection</button><button title="Fit board" onClick={() => editor?.zoomToFit()}>Fit board</button></div></div></> : <NavigationItemPage item={selectedItem} items={boards} onUpdate={updateNavigationItem} onCreate={createNavigationItem} onOpen={openNavigationItem} onOpenBoard={openBoard} />}</div>

      <div
        className={`panel-resizer right-resizer ${isDraggingSplitter === 'right' ? 'is-dragging' : ''}`}
        onMouseDown={startResizingRight}
        onDoubleClick={resetOrToggleRightWidth}
        title="Drag left/right to resize visual board and terminal panels (double-click for 50/50 split)"
        role="separator"
        aria-orientation="vertical"
      >
        <div className="panel-resizer-grip" />
      </div>

      <aside className={`right-sidebar ${rightTab === 'terminal' ? 'terminal-sidebar-active' : ''}`} style={{ width: `${currentRightWidth}px` }}>
        <div className="panel-tabs">
          <button className={`panel-tab ${rightTab === 'copilot' ? 'active' : ''}`} onClick={() => setRightTab('copilot')}>AI Copilot</button>
          <button className={`panel-tab ${rightTab === 'files' ? 'active' : ''}`} onClick={() => setRightTab('files')}>Files ({attachments.length})</button>
          <button className={`panel-tab ${rightTab === 'terminal' ? 'active' : ''}`} onClick={() => setRightTab('terminal')}>Terminal</button>
        </div>
        <div className="tab-content-panel copilot-tab-panel" style={{ display: rightTab === 'copilot' ? 'block' : 'none' }}>
          <div className="copilot-intro"><div className="ai-icon" aria-hidden="true">✳</div><h2>AI Copilot</h2><p>Autonomous Workflow Intelligence & Knowledge Base. Works online & offline.</p></div>

          <div className="kb-card">
            <div className="kb-header">
              <h3>🧠 Knowledge Base Engine</h3>
              {aiStatus === 'offline' ? (
                <span className="kb-badge offline">🔴 Offline</span>
              ) : activeAI === 'opencode' ? (
                <span className="kb-badge hybrid">⚡ OpenCode Active</span>
              ) : codexConnected ? (
                <span className="kb-badge hybrid">⚡ Codex Active</span>
              ) : (
                <span className="kb-badge offline-mode">🧠 Offline Mode Ready</span>
              )}
            </div>
            <p className="kb-desc">
              {aiStatus === 'offline'
                ? 'Backend service is offline. Please start uvicorn backend.'
                : activeAI === 'opencode'
                ? 'OpenCode + Local Knowledge Base active. OpenCode designs diagrams and writes directly to the Visual Board.'
                : codexConnected
                ? 'Cloud AI + Local Knowledge Base active. Continuously learns from external AI interactions and board designs.'
                : 'Operating locally from offline blueprints and learned patterns. External AI connection is optional.'}
            </p>

            <div className="kb-stats">
              <span className="kb-stat-pill"><strong>{kbInfo?.patternsCount ?? 6}</strong> Blueprints</span>
              <span className="kb-stat-pill"><strong>{kbInfo?.customLearnedCount ?? 0}</strong> Learned</span>
              <span className="kb-stat-pill">Active: <strong>{activeAI === 'opencode' ? 'OpenCode' : activeAI === 'codex' ? 'Codex' : 'Knowledge Base'}</strong></span>
              <span className="kb-stat-pill">Mode: <strong>{aiMode === 'hybrid' ? 'Hybrid (Online)' : 'Offline'}</strong></span>
            </div>

            {kbInfo?.domains && kbInfo.domains.length > 0 && (
              <div className="kb-domains">
                {kbInfo.domains.map((dom) => (
                  <span className="kb-domain-tag" key={dom}>{dom}</span>
                ))}
              </div>
            )}

            <button
              className="teach-kb-button"
              disabled={isTeachingKB || !editor}
              onClick={() => void teachKBFromCurrentBoard()}
              title="Extracts nodes and relations from the active canvas into the Knowledge Base"
            >
              {isTeachingKB ? <><span className="spinner" /> Learning from canvas…</> : '🧠 Teach KB from Current Board'}
            </button>

            {/* Connected Multi-AI Ecosystem Switcher */}
            <div className="ai-agent-selector-card">
              <div className="ai-active-header">
                <span className="ai-active-title">
                  <span className="ai-active-status-dot" />
                  Connected AI: <strong>{activeAI === 'opencode' ? 'OpenCode (v1.17.9)' : activeAI === 'codex' ? 'OpenAI Codex' : activeAI === 'claude' ? 'Claude Code' : 'Knowledge Base'}</strong>
                </span>
                <span className="kb-domain-tag">
                  {activeAI === 'opencode' && opencodeConnected ? '● Active in Terminal' : activeAI === 'codex' && codexConnected ? '● Connected' : '● Ready'}
                </span>
              </div>

              <div className="ai-chips-list">
                {connectedAIs.length > 0 ? (
                  connectedAIs.map((ai) => (
                    <button
                      key={ai.id}
                      type="button"
                      className={`ai-chip ${activeAI === ai.id ? 'active' : ''}`}
                      onClick={() => void switchAIProvider(ai.id)}
                      title={ai.description || ai.name}
                    >
                      {ai.id === 'knowledge_base' ? '🧠' : '⚡'} {ai.name} {ai.version ? <span className="ai-chip-ver">{ai.version}</span> : null}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      type="button"
                      className={`ai-chip ${activeAI === 'opencode' ? 'active' : ''}`}
                      onClick={() => void switchAIProvider('opencode')}
                      title="OpenCode AI coding agent running in project terminal"
                    >
                      ⚡ OpenCode <span className="ai-chip-ver">v1.17.9</span>
                    </button>
                    <button
                      type="button"
                      className={`ai-chip ${activeAI === 'codex' ? 'active' : ''}`}
                      onClick={() => void switchAIProvider('codex')}
                      title={codexConnected ? 'OpenAI Codex (Connected via ChatGPT)' : 'Click to connect Codex'}
                    >
                      ⚡ OpenAI Codex <span className="ai-chip-ver">{codexConnected ? '✓' : ''}</span>
                    </button>
                    <button
                      type="button"
                      className={`ai-chip ${activeAI === 'knowledge_base' ? 'active' : ''}`}
                      onClick={() => void switchAIProvider('knowledge_base')}
                      title="Local SQLite FTS5 offline intelligence"
                    >
                      🧠 Knowledge Base
                    </button>
                  </>
                )}
              </div>

              <div className="ai-agent-details">
                {activeAI === 'opencode' && (
                  <span>
                    <strong>OpenCode is connected & ready.</strong> OpenCode runs in your project terminal and can design flowcharts, write code, and update the Visual Board live.
                  </span>
                )}
                {activeAI === 'codex' && (
                  <span>
                    {codexConnected ? 'OpenAI Codex is connected with your ChatGPT account. Commands can run via Terminal.' : (
                      <button className="text-button" disabled={codexBusy || !codexAvailable} onClick={() => void connectCodex()}>
                        {codexBusy ? 'Waiting for sign-in…' : codexAvailable ? 'Connect Codex with ChatGPT' : 'Codex CLI not installed'}
                      </button>
                    )}
                    {codexMessage && <div style={{ marginTop: '4px', color: 'var(--muted)' }}>{codexMessage}</div>}
                  </span>
                )}
                {activeAI === 'knowledge_base' && (
                  <span>Operating completely offline with zero external network dependencies.</span>
                )}
              </div>
            </div>

            {/* OpenCode Visual Board Designer */}
            <div className="opencode-designer-box">
              <div className="opencode-designer-title">
                <span>🎨 OpenCode Visual Board Designer</span>
                <span className="kb-domain-tag">Live Sync</span>
              </div>
              <p className="opencode-designer-desc">
                OpenCode has direct read/write access to this visual board! Click a blueprint below to generate instantly, or tell OpenCode in the Terminal tab to design any workflow:
              </p>
              <div className="quick-blueprint-grid">
                <button
                  type="button"
                  className="quick-blueprint-btn"
                  disabled={isQuickDesigning}
                  onClick={() => void runQuickDesign('hrms')}
                  title="Generates complete HRMS, Recruitment, Payroll and Offboarding workflow"
                >
                  👥 HRMS Lifecycle
                </button>
                <button
                  type="button"
                  className="quick-blueprint-btn"
                  disabled={isQuickDesigning}
                  onClick={() => void runQuickDesign('hospital')}
                  title="Generates Hospital Patient Admission, Triage, Clinical Pathway & EHR"
                >
                  🏥 Hospital Clinical ERP
                </button>
                <button
                  type="button"
                  className="quick-blueprint-btn"
                  disabled={isQuickDesigning}
                  onClick={() => void runQuickDesign('ecommerce')}
                  title="Generates E-Commerce Store, Cart, Checkout & 3PL Logistics pipeline"
                >
                  🛒 E-Commerce Pipeline
                </button>
                <button
                  type="button"
                  className="quick-blueprint-btn"
                  disabled={isQuickDesigning}
                  onClick={() => void runQuickDesign('auth')}
                  title="Generates Zero-Trust OAuth2, MFA, JWT Minting & RBAC Policy Gateway"
                >
                  🔐 Auth & RBAC Architecture
                </button>
                <button
                  type="button"
                  className="quick-blueprint-btn"
                  disabled={isQuickDesigning}
                  onClick={() => void runQuickDesign('devops')}
                  title="Generates Automated CI/CD, Docker Container builds & Canary Rollout"
                >
                  🚀 DevOps CI/CD Pipeline
                </button>
                <button
                  type="button"
                  className="quick-blueprint-btn"
                  disabled={isQuickDesigning}
                  onClick={() => setRightTab('terminal')}
                  title="Switch to Terminal to use OpenCode directly"
                >
                  💻 Open Terminal Tab →
                </button>
              </div>
              <div className="opencode-terminal-tip" title="Run this in OpenCode or Terminal to design any diagram">
                $ python3 board_tool.py design "Hospital clinical workflow"
              </div>
            </div>
          </div>

          <div className="learning-controls">
            <label><input type="checkbox" checked={learningEnabled} onChange={(event) => setLearningEnabled(event.target.checked)} /> Continuous learning from interactions</label>
            <p>{learningEnabled ? `${learningMemories.length} interaction memories saved. Auto-enriches the offline Knowledge Base.` : 'Feedback memory disabled.'}</p>
            {learningMemories.length > 0 && <button onClick={clearLearningMemory}>Clear project memory</button>}
          </div>

          <label className="field-label" htmlFor="mode">Mode</label>
          <select id="mode" value={mode} onChange={(event) => { setMode(event.target.value as Mode); setProposal(null); }}>
            <option value="generate">Generate Workflow</option>
            <option value="modify">Modify Selected</option>
            <option value="analyze">Analyze Architecture</option>
          </select>
          <label className="field-label" htmlFor="prompt">Instructions</label>
          <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="For example: map the steps in an HRMS recruitment pipeline or hospital clinical workflow…" />
          <button className="primary ask-button" disabled={busy || !prompt.trim() || (aiStatus === 'offline' && canvasMode !== 'architecture')} onClick={() => void ask()}>
            {busy ? <><span className="spinner"/>Synthesizing…</> : '✳  Create proposal'}
          </button>
          <p className="status-message" role="status">{status}</p>

          {proposal && (
            <div className="proposal-card">
              <div className="proposal-title"><strong>Proposal preview</strong><button className="text-button" onClick={rejectProposal}>Discard</button></div>
              <div style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                <span className={`proposal-source-pill ${proposal.source === 'opencode' ? 'opencode' : proposal.source === 'codex' ? 'codex' : proposal.source === 'claude' ? 'claude' : 'kb'}`}>
                  {proposal.source === 'opencode' ? '⚡ OpenCode (v1.17.9)' : proposal.source === 'codex' ? '⚡ OpenAI Codex' : proposal.source === 'claude' ? '⚡ Claude Code' : `🧠 Knowledge Base (${proposal.domain || 'Blueprint'})`}
                </span>
                {proposal.confidence !== undefined && (
                  <span className="kb-domain-tag">Conf: {Math.round(proposal.confidence * 100)}%</span>
                )}
                {Boolean(proposal.history_count && proposal.history_count > 0) && (
                  <span className="history-pill" title={`${proposal.history_count} previous version(s) archived in SQLite history`}>
                    📜 {proposal.history_count} past version(s)
                  </span>
                )}
              </div>

              <div className="proposal-feedback-row">
                <span className="proposal-trust-label">
                  Trust Score: <strong>{proposal.score !== undefined ? `${Math.round(proposal.score * 100)}%` : '90%'}</strong>
                </span>
                {proposal.id ? (
                  <div className="proposal-vote-buttons">
                    <button className="vote-btn good" title="Vote up to increase trust score (+20%)" onClick={() => void sendFeedback(proposal.id, true)}>
                      👍 Helpful
                    </button>
                    <button className="vote-btn bad" title="Vote down to decrease trust score (-30%)" onClick={() => void sendFeedback(proposal.id, false)}>
                      👎 Low quality
                    </button>
                  </div>
                ) : null}
              </div>
              <p>{proposal.summary}</p>
              {proposal.nodes.map((node, index) => (
                <label className="proposal-change" key={`node-${index}`}>
                  <input type="checkbox" checked={selectedNodes.includes(index)} onChange={(event) => setSelectedNodes((old) => event.target.checked ? [...old, index] : old.filter((item) => item !== index))}/>
                  <span className="change-tag added">NEW</span><span>{node.label}</span>
                </label>
              ))}
              {proposal.updates.map((update) => (
                <p className="proposal-update" key={update.id}><span className="change-tag edited">EDIT</span>{update.label}</p>
              ))}
              <div className="proposal-actions">
                {mode !== 'analyze' && (
                  <>
                    <button className="primary" onClick={() => applyProposal(true)}>
                      Apply all ({proposal.nodes.length + (proposal.connectors?.length || 0)} elements)
                    </button>
                    <button onClick={() => applyProposal(false)}>Apply selected</button>
                  </>
                )}
                <button onClick={rejectProposal}>Reject all</button>
              </div>
            </div>
          )}
        </div>
        <div className="tab-content-panel files-tab-panel" style={{ display: rightTab === 'files' ? 'block' : 'none' }}>
          <div className="attachments-section files-tab"><div className="section-title"><div><span className="eyebrow">BOARD FILES</span><h3>Attachments</h3></div><label className="icon-button upload-button" title="Upload attachments">＋<input type="file" multiple onChange={(event) => { void addAttachments(event.target.files); event.currentTarget.value = ''; }} /></label></div>
            {attachments.length ? <ul className="file-list">{attachments.map((file) => <li key={file.id}><button className="file-name" onClick={() => void downloadAttachment(file)} title="Download file">▤ <span>{file.name}</span><small>{(file.size / 1024).toFixed(0)} KB</small></button><button className="remove-file" onClick={() => void deleteAttachment(file)} aria-label={`Delete ${file.name}`}>×</button></li>)}</ul> : <p className="empty-files">Files you add are stored privately in this browser.</p>}
          </div>
        </div>
        <div className="tab-content-panel terminal-tab-panel" style={{ display: rightTab === 'terminal' ? 'flex' : 'none' }}>
          <TerminalPanel
            projectId={project.id}
            projectName={project.name}
            isFullscreen={isTerminalFullscreen}
            onToggleFullscreen={() => setIsTerminalFullscreen((v) => !v)}
            onSetWidthPreset={setRightWidthPreset}
          />
        </div>
      </aside>
      {isDraggingSplitter && <div className="global-splitter-overlay" />}
    </section>}
  </main>;
}

export default App;

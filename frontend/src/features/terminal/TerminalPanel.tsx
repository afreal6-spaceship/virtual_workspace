import { useEffect, useRef, useState } from 'react';
import type { SystemEnvironment, TerminalSessionInfo, TerminalStatus } from '../../types/terminal';
import TerminalInstance from './TerminalInstance';

type Props = {
  projectId: string;
  projectName: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSetWidthPreset?: (preset: 'compact' | 'half' | 'wide') => void;
};

export default function TerminalPanel({
  projectId,
  projectName,
  isFullscreen,
  onToggleFullscreen,
  onSetWidthPreset,
}: Props) {
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [env, setEnv] = useState<SystemEnvironment | null>(null);
  const [selectedShell, setSelectedShell] = useState<string>('');
  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('terminal-font-size')) || 13;
    } catch {
      return 13;
    }
  });
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showEnvModal, setShowEnvModal] = useState(false);
  const clearCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const sendInputCallbacksRef = useRef<Map<string, (text: string) => void>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendInputToActiveSession = (text: string) => {
    if (activeSessionId) {
      const sendFn = sendInputCallbacksRef.current.get(activeSessionId);
      sendFn?.(text);
    }
  };

  const uploadAndInsertImage = async (blob: Blob, name?: string) => {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch(`/api/projects/${projectId}/terminal/paste-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64,
            filename: name || 'pasted_image.png',
          }),
        });
        if (res.ok) {
          const result = await res.json();
          sendInputToActiveSession(`./${result.default_alias} `);
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      // ignore
    }
  };

  const handlePasteImageClick = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            await uploadAndInsertImage(blob, 'pasted_image.png');
            return;
          }
        }
      }
    } catch {
      // Permission denied or not supported, fallback to file input
    }
    fileInputRef.current?.click();
  };

  // Load system environment once
  useEffect(() => {
    fetch('/api/system/environment')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SystemEnvironment | null) => {
        if (data) {
          setEnv(data);
          setSelectedShell(data.defaultShell.path);
        }
      })
      .catch(() => {
        // Environment fetch failure non-fatal
      });
  }, []);

  // Save font size
  useEffect(() => {
    try {
      localStorage.setItem('terminal-font-size', String(fontSize));
    } catch {
      // ignore
    }
  }, [fontSize]);

  // Fetch or create sessions for current project
  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`/api/projects/${projectId}/terminals`)
      .then((res) => (res.ok ? res.json() : []))
      .then(async (list: TerminalSessionInfo[]) => {
        if (!active) return;
        if (list.length > 0) {
          setSessions(list);
          setActiveSessionId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0].id));
          setLoading(false);
        } else {
          // Auto-create initial session for this project
          try {
            const createRes = await fetch(`/api/projects/${projectId}/terminals`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Terminal 1' }),
            });
            if (createRes.ok && active) {
              const newSession: TerminalSessionInfo = await createRes.json();
              setSessions([newSession]);
              setActiveSessionId(newSession.id);
            }
          } catch {
            // ignore
          } finally {
            if (active) setLoading(false);
          }
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  async function handleCreateSession() {
    try {
      const nextIndex = sessions.length + 1;
      const res = await fetch(`/api/projects/${projectId}/terminals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Terminal ${nextIndex}`,
          shell: selectedShell || undefined,
        }),
      });
      if (res.ok) {
        const newSession: TerminalSessionInfo = await res.json();
        setSessions((prev) => [...prev, newSession]);
        setActiveSessionId(newSession.id);
      }
    } catch (err) {
      console.error('Failed to create terminal session:', err);
    }
  }

  async function handleDeleteSession(sessionId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/terminals/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        if (activeSessionId === sessionId) {
          setActiveSessionId(next.length ? next[0].id : null);
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to delete terminal session:', err);
    }
  }

  function startRename(session: TerminalSessionInfo, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setRenameValue(session.name);
  }

  async function saveRename(sessionId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setEditingSessionId(null);
      return;
    }
    try {
      const res = await fetch(`/api/terminals/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, name: updated.name } : s)));
      }
    } catch {
      // ignore
    } finally {
      setEditingSessionId(null);
    }
  }

  function handleStatusChange(sessionId: string, status: TerminalStatus, exitCode: number | null) {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status, exitCode } : s))
    );
  }

  function handleClear() {
    if (activeSessionId) {
      const fn = clearCallbacksRef.current.get(activeSessionId);
      fn?.();
    }
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null;

  return (
    <div className={`terminal-panel-wrapper ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Top Header & Session Tabs */}
      <div className="terminal-header-bar">
        <div className="terminal-tabs-track">
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId;
            const isEditing = editingSessionId === s.id;
            return (
              <div
                key={s.id}
                className={`terminal-tab-chip ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSessionId(s.id)}
                onDoubleClick={(e) => startRename(s, e)}
                title={`${s.name} (${s.shell})\nDouble-click to rename`}
              >
                <span
                  className={`terminal-status-dot ${
                    s.status === 'running'
                      ? 'dot-running'
                      : s.status === 'exited'
                      ? 'dot-exited'
                      : 'dot-killed'
                  }`}
                />
                {isEditing ? (
                  <input
                    type="text"
                    className="terminal-rename-input"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveRename(s.id);
                      if (e.key === 'Escape') setEditingSessionId(null);
                    }}
                    onBlur={() => void saveRename(s.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="terminal-tab-name">{s.name}</span>
                )}
                <button
                  className="terminal-tab-close"
                  onClick={(e) => void handleDeleteSession(s.id, e)}
                  title="Close session"
                  aria-label="Close session"
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            className="terminal-add-tab-btn"
            onClick={() => void handleCreateSession()}
            title="Open new terminal session"
            aria-label="New terminal tab"
          >
            ＋
          </button>
        </div>

        {/* Global Toolbar Controls */}
        <div className="terminal-controls-track">
          {env?.shells && env.shells.length > 1 && (
            <select
              className="terminal-shell-select"
              value={selectedShell}
              onChange={(e) => setSelectedShell(e.target.value)}
              title="Select shell for new sessions"
            >
              {env.shells.map((sh) => (
                <option key={sh.path} value={sh.path}>
                  {sh.name}
                </option>
              ))}
            </select>
          )}

          <div className="terminal-font-controls" title="Adjust font size">
            <button
              onClick={() => setFontSize((sz) => Math.max(10, sz - 1))}
              disabled={fontSize <= 10}
              title="Decrease font size"
            >
              A−
            </button>
            <span className="terminal-font-size-label">{fontSize}px</span>
            <button
              onClick={() => setFontSize((sz) => Math.min(22, sz + 1))}
              disabled={fontSize >= 22}
              title="Increase font size"
            >
              A＋
            </button>
          </div>

          <button
            className="terminal-tool-btn"
            onClick={handleClear}
            title="Clear terminal output"
          >
            Clear
          </button>

          <button
            className="terminal-tool-btn terminal-info-btn"
            onClick={() => setShowEnvModal((v) => !v)}
            title="Environment & Tools Info"
          >
            ℹ Info
          </button>

          {onSetWidthPreset && (
            <div className="terminal-split-presets" title="Quickly split board and terminal width">
              <button
                className="terminal-split-btn"
                onClick={() => onSetWidthPreset('compact')}
                title="Compact terminal (35% width)"
              >
                35%
              </button>
              <button
                className="terminal-split-btn"
                onClick={() => onSetWidthPreset('half')}
                title="Equal split (50/50 board and terminal)"
              >
                50/50
              </button>
              <button
                className="terminal-split-btn"
                onClick={() => onSetWidthPreset('wide')}
                title="Wide terminal (65% width)"
              >
                65%
              </button>
            </div>
          )}

          <button
            className={`terminal-tool-btn terminal-fullscreen-btn ${isFullscreen ? 'active' : ''}`}
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Terminal Fullscreen'}
          >
            {isFullscreen ? '⤦ Collapse' : '⤢ Fullscreen'}
          </button>
        </div>
      </div>

      {/* Context Information Bar */}
      <div className="terminal-context-bar">
        <div className="terminal-context-item">
          <span className="context-label">PROJECT:</span>
          <strong className="context-value">{projectName}</strong>
        </div>
        <div className="terminal-context-item terminal-cwd-badge">
          <span className="context-label">CWD:</span>
          <code className="context-path" title={activeSession?.workingDir || ''}>
            {activeSession?.workingDir || `~/projects/${projectId}`}
          </code>
        </div>
        {activeSession && (
          <div className="terminal-context-item terminal-session-status">
            <span
              className={`status-pill ${
                activeSession.status === 'running'
                  ? 'pill-running'
                  : 'pill-exited'
              }`}
            >
              {activeSession.status === 'running'
                ? `● ${activeSession.shell} Running`
                : `○ Exited (${activeSession.exitCode ?? 0})`}
            </span>
          </div>
        )}
      </div>

      {/* Terminal Image Action Bar */}
      <div className="terminal-image-action-bar">
        <button
          type="button"
          className="terminal-img-btn"
          onClick={() => void handlePasteImageClick()}
          title="Paste image from clipboard (Ctrl+V) or upload screenshot directly into project folder"
        >
          📸 Paste / Upload Image
        </button>
        <button
          type="button"
          className="terminal-img-btn"
          onClick={() => sendInputToActiveSession("analyze ./pasted_image.png and design this workflow on the visual board\n")}
          title="Send prompt asking Codex / OpenCode to inspect ./pasted_image.png and design the workflow"
        >
          🔍 Ask Codex / OpenCode to Analyze Image
        </button>
        <span className="terminal-img-hint">Press <strong>Ctrl+V</strong> or drag & drop image into terminal</span>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              void uploadAndInsertImage(files[0], files[0].name);
            }
            e.target.value = '';
          }}
        />
      </div>

      {/* Main Terminal View Container */}
      <div className="terminal-body-area">
        {loading && !sessions.length && (
          <div className="terminal-loading-placeholder">
            <span className="spinner" />
            <p>Initializing project terminal…</p>
          </div>
        )}

        {!loading && !sessions.length && (
          <div className="terminal-empty-state">
            <div className="terminal-empty-icon">⌨</div>
            <h3>No active terminal sessions</h3>
            <p>Launch a terminal session to start working inside this project.</p>
            <button className="primary" onClick={() => void handleCreateSession()}>
              ＋ New Terminal
            </button>
          </div>
        )}

        {sessions.map((s) => (
          <TerminalInstance
            key={s.id}
            session={s}
            fontSize={fontSize}
            isSelected={s.id === activeSessionId}
            onStatusChange={(status, code) => handleStatusChange(s.id, status, code)}
            onClearRef={(clearFn) => {
              clearCallbacksRef.current.set(s.id, clearFn);
            }}
            onSendInputRef={(sendFn) => {
              sendInputCallbacksRef.current.set(s.id, sendFn);
            }}
          />
        ))}
      </div>

      {/* System Environment Modal */}
      {showEnvModal && env && (
        <div className="terminal-env-modal-overlay" onClick={() => setShowEnvModal(false)}>
          <div className="terminal-env-modal" onClick={(e) => e.stopPropagation()}>
            <div className="env-modal-header">
              <h3>System Environment & Tools</h3>
              <button onClick={() => setShowEnvModal(false)}>×</button>
            </div>
            <div className="env-modal-body">
              <div className="env-grid">
                <div>
                  <span className="env-label">Host OS:</span>
                  <strong>{env.os} ({env.release}) [{env.arch}]</strong>
                </div>
                <div>
                  <span className="env-label">Default Shell:</span>
                  <code>{env.defaultShell.name} ({env.defaultShell.path})</code>
                </div>
                <div>
                  <span className="env-label">Node.js:</span>
                  <code>{env.tools.node || 'Not installed'}</code>
                </div>
                <div>
                  <span className="env-label">Python:</span>
                  <code>{env.tools.python || 'Not installed'}</code>
                </div>
                <div>
                  <span className="env-label">Git:</span>
                  <code>{env.tools.git || 'Not installed'}</code>
                </div>
                <div>
                  <span className="env-label">Docker:</span>
                  <code>{env.tools.docker || 'Not installed'}</code>
                </div>
                <div>
                  <span className="env-label">OpenAI Codex:</span>
                  <code>{env.tools.codex || 'Not installed'}</code>
                </div>
                <div>
                  <span className="env-label">Projects Directory:</span>
                  <code>{env.projectsBaseDir}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

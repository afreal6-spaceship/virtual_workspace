import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { TerminalSessionInfo, TerminalStatus, TerminalWsMessage } from '../../types/terminal';

type Props = {
  session: TerminalSessionInfo;
  fontSize: number;
  isSelected: boolean;
  onStatusChange: (status: TerminalStatus, exitCode: number | null) => void;
  onClearRef?: (clearFn: () => void) => void;
  onSendInputRef?: (sendFn: (text: string) => void) => void;
};

export default function TerminalInstance({
  session,
  fontSize,
  isSelected,
  onStatusChange,
  onClearRef,
  onSendInputRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [pasteToast, setPasteToast] = useState<string | null>(null);

  const uploadAndInsertImage = async (blob: Blob, name?: string) => {
    setPasteToast('Saving image to project…');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch(`/api/projects/${session.projectId}/terminal/paste-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64,
            filename: name || 'pasted_image.png',
          }),
        });
        if (res.ok) {
          const result = await res.json();
          const insertText = `./${result.default_alias} `;
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data: insertText }));
          }
          setPasteToast(`📸 Image saved as ./${result.default_alias} (inserted into terminal)`);
          window.setTimeout(() => setPasteToast(null), 3500);
        } else {
          setPasteToast('Failed to save image to project.');
          window.setTimeout(() => setPasteToast(null), 3000);
        }
      } catch {
        setPasteToast('Error uploading image.');
        window.setTimeout(() => setPasteToast(null), 3000);
      }
    };
    reader.readAsDataURL(blob);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize,
      fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Code", "Segoe UI Mono", Menlo, Consolas, monospace',
      lineHeight: 1.25,
      letterSpacing: 0,
      scrollback: 5000,
      allowTransparency: true,
      theme: {
        background: '#121217',
        foreground: '#e2e8f0',
        cursor: '#818cf8',
        cursorAccent: '#121217',
        selectionBackground: 'rgba(99, 102, 241, 0.4)',
        selectionForeground: '#ffffff',
        black: '#1f2937',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f1f5f9',
        brightBlack: '#64748b',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    if (onClearRef) {
      onClearRef(() => {
        term.clear();
      });
    }

    if (onSendInputRef) {
      onSendInputRef((text: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
        }
      });
    }

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminals/${session.id}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState('connected');
      // Trigger initial fit and notify backend of dimensions
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {
        // Container might not be visible yet
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TerminalWsMessage;
        if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'status') {
          onStatusChange(msg.status, msg.exitCode ?? null);
        } else if (msg.type === 'exit') {
          onStatusChange('exited', msg.code ?? null);
        }
      } catch {
        term.write(event.data);
      }
    };

    ws.onerror = () => {
      setConnectionState('disconnected');
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
    };

    // Forward terminal input to backend PTY
    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Forward resize events
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || containerRef.current.clientWidth === 0) return;
      try {
        fitAddon.fit();
      } catch {
        // ignore layout race
      }
    });
    resizeObserver.observe(containerRef.current);

    // Intercept image pastes and drag-drops directly into project workspace
    const container = containerRef.current;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          const file = item.getAsFile();
          if (file) {
            void uploadAndInsertImage(file, file.name);
          }
          return;
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };

    const handleDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          void uploadAndInsertImage(file, file.name);
        }
      }
    };

    container.addEventListener('paste', handlePaste, true);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('paste', handlePaste, true);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
      dataDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
    };
  }, [session.id]);

  // Update font size dynamically
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      try {
        fitAddonRef.current?.fit();
      } catch {
        // ignore
      }
    }
  }, [fontSize]);

  // When tab becomes selected, fit to current container dimensions and focus
  useEffect(() => {
    if (isSelected) {
      const timer = window.setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          termRef.current?.focus();
          if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current) {
            wsRef.current.send(
              JSON.stringify({
                type: 'resize',
                cols: termRef.current.cols,
                rows: termRef.current.rows,
              })
            );
          }
        } catch {
          // ignore
        }
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [isSelected]);

  return (
    <div
      className="terminal-instance-container"
      style={{ display: isSelected ? 'flex' : 'none' }}
    >
      {connectionState === 'connecting' && (
        <div className="terminal-overlay-state">
          <span className="spinner" />
          <span>Connecting to terminal session…</span>
        </div>
      )}
      {connectionState === 'disconnected' && session.status !== 'exited' && (
        <div className="terminal-reconnect-bar">
          <span>Connection lost.</span>
          <button
            onClick={() => {
              // Trigger reload
              window.location.reload();
            }}
          >
            Reconnect
          </button>
        </div>
      )}
      <div ref={containerRef} className="xterm-canvas-wrapper" />
      {pasteToast && (
        <div className="terminal-paste-toast">
          <span>{pasteToast}</span>
        </div>
      )}
    </div>
  );
}

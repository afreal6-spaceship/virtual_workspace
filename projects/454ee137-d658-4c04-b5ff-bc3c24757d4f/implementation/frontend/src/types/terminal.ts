export type TerminalStatus = 'starting' | 'running' | 'exited' | 'killed';

export type TerminalSessionInfo = {
  id: string;
  projectId: string;
  name: string;
  workingDir: string;
  shell: string;
  shellPath: string;
  cols: number;
  rows: number;
  status: TerminalStatus;
  exitCode: number | null;
  createdAt: string;
};

export type ShellCandidate = {
  name: string;
  path: string;
  type: string;
};

export type SystemEnvironment = {
  os: string;
  release: string;
  arch: string;
  platform: string;
  shells: ShellCandidate[];
  defaultShell: ShellCandidate;
  tools: {
    node: string | null;
    npm: string | null;
    python: string | null;
    git: string | null;
    docker: string | null;
    codex: string | null;
  };
  projectsBaseDir: string;
};

export type TerminalWsMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'output'; data: string }
  | { type: 'status'; status: TerminalStatus; exitCode?: number | null }
  | { type: 'exit'; code: number | null }
  | { type: 'ping' }
  | { type: 'pong' };

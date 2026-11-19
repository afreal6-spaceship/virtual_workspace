"""Cross-platform Terminal Manager with real PTY support for AI Copilot.

Supports:
- Linux / macOS (pty.openpty + termios + ioctl TIOCSWINSZ)
- Windows (pywinpty if available, or async subprocess pipe fallback)
- Project directory isolation and path traversal guards
- Output history ring buffer for session reconnection
- Multiple concurrent sessions per project
- System environment detection (OS, shells, tools)
"""

import asyncio
import collections
import datetime
import json
import logging
import os
import platform
import re
import shutil
import signal
import struct
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Set

logger = logging.getLogger("terminal_manager")
logger.setLevel(logging.INFO)

# Base directories
BACKEND_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = BACKEND_DIR.parent
PROJECTS_BASE_DIR = WORKSPACE_ROOT / "projects"
PROJECTS_BASE_DIR.mkdir(parents=True, exist_ok=True)

# Safety limits
MAX_SESSIONS_PER_PROJECT = 8
MAX_TOTAL_SESSIONS = 25
OUTPUT_BUFFER_MAX_BYTES = 512 * 1024  # 512 KB scrollback buffer
PROJECT_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]{1,64}$")

IS_WINDOWS = sys.platform == "win32"
IS_MACOS = sys.platform == "darwin"
IS_LINUX = sys.platform.startswith("linux")

# Unix imports
if not IS_WINDOWS:
    import fcntl
    import pty
    import termios


class TerminalSession:
    """Represents an active interactive terminal session backed by a real PTY or process."""

    def __init__(
        self,
        session_id: str,
        project_id: str,
        name: str,
        working_dir: Path,
        shell_path: str,
        shell_name: str,
        cols: int = 80,
        rows: int = 24,
    ):
        self.id = session_id
        self.project_id = project_id
        self.name = name
        self.working_dir = working_dir
        self.shell_path = shell_path
        self.shell_name = shell_name
        self.cols = cols
        self.rows = rows
        self.created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.status: str = "starting"
        self.exit_code: Optional[int] = None

        self.process: Optional[subprocess.Popen] = None
        self.master_fd: Optional[int] = None
        self.output_buffer = collections.deque(maxlen=1000)
        self.clients: Set[any] = set()  # Set of FastAPI WebSocket instances
        self.reader_active = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "projectId": self.project_id,
            "name": self.name,
            "workingDir": str(self.working_dir),
            "shell": self.shell_name,
            "shellPath": self.shell_path,
            "cols": self.cols,
            "rows": self.rows,
            "status": self.status,
            "exitCode": self.exit_code,
            "createdAt": self.created_at,
        }

    def start(self, loop: asyncio.AbstractEventLoop):
        """Starts the PTY process and initializes asynchronous I/O."""
        self._loop = loop
        env = os.environ.copy()
        # Clean sensitive backend internal keys if present
        for key in list(env.keys()):
            if any(k in key.upper() for k in ("SECRET", "TOKEN", "PASSWORD")):
                env.pop(key, None)

        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["LANG"] = env.get("LANG", "en_US.UTF-8")
        env["PROJECT_ID"] = self.project_id
        env["PROJECT_DIR"] = str(self.working_dir)

        # Prepend user tool directories so opencode, codex, claude work seamlessly
        extra_paths = [
            str(Path.home() / ".opencode" / "bin"),
            str(Path.home() / ".local" / "bin"),
            "/usr/local/bin",
        ]
        curr_path = env.get("PATH", "")
        env["PATH"] = ":".join(extra_paths) + ":" + curr_path

        # On Linux/macOS, customize the prompt slightly if bash/sh
        display_proj = self.working_dir.name
        if "bash" in self.shell_name:
            env["PROMPT_COMMAND"] = f"echo -ne '\\033]0;ai-copilot:{display_proj}\\007'"
            # Set a friendly prompt if PS1 is customizable
            env["PS1"] = f"\\[\\033[01;32m\\]user@copilot\\[\\033[00m\\]:\\[\\033[01;34m\\]~/{display_proj}\\[\\033[00m\\]$ "

        if not IS_WINDOWS:
            self._start_unix_pty(env)
        else:
            self._start_windows_pty(env)

        self.status = "running"
        logger.info(f"Terminal session {self.id} started (project: {self.project_id}, shell: {self.shell_name})")

    def _start_unix_pty(self, env: dict):
        master, slave = pty.openpty()
        self.master_fd = master

        # Set initial terminal size
        self._apply_unix_size(master, self.cols, self.rows)

        # Build command
        args = [self.shell_path]
        if "bash" in self.shell_name:
            args.extend(["--login", "-i"])

        try:
            self.process = subprocess.Popen(
                args,
                stdin=slave,
                stdout=slave,
                stderr=slave,
                cwd=str(self.working_dir),
                env=env,
                preexec_fn=os.setsid,
                close_fds=True,
            )
        finally:
            os.close(slave)

        self.reader_active = True
        self._loop.add_reader(self.master_fd, self._on_unix_readable)

    def _apply_unix_size(self, fd: int, cols: int, rows: int):
        try:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
        except Exception as e:
            logger.warning(f"Could not resize Unix terminal: {e}")

    def _on_unix_readable(self):
        if not self.reader_active or self.master_fd is None:
            return
        try:
            data = os.read(self.master_fd, 4096)
            if not data:
                self._handle_eof()
                return
            text = data.decode("utf-8", errors="replace")
            self.output_buffer.append(text)
            self._broadcast({"type": "output", "data": text})
        except (OSError, ValueError):
            self._handle_eof()

    def _start_windows_pty(self, env: dict):
        # On Windows, use pywinpty if available, otherwise pipe subprocess fallback
        try:
            import winpty

            pty_proc = winpty.PtyProcess.spawn(
                [self.shell_path],
                cwd=str(self.working_dir),
                env=env,
                dimensions=(self.rows, self.cols),
            )
            self._winpty_proc = pty_proc
            self.reader_active = True
            self._loop.run_in_executor(None, self._read_winpty_loop)
        except Exception:
            # Fallback to standard subprocess with pipes
            args = [self.shell_path]
            self.process = subprocess.Popen(
                args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=str(self.working_dir),
                env=env,
                bufsize=0,
            )
            self.reader_active = True
            self._loop.run_in_executor(None, self._read_pipe_loop)

    def _read_winpty_loop(self):
        while self.reader_active and hasattr(self, "_winpty_proc"):
            try:
                data = self._winpty_proc.read(1024)
                if not data:
                    break
                self.output_buffer.append(data)
                self._broadcast({"type": "output", "data": data})
            except Exception:
                break
        self._loop.call_soon_threadsafe(self._handle_eof)

    def _read_pipe_loop(self):
        while self.reader_active and self.process and self.process.stdout:
            try:
                chunk = self.process.stdout.read(1024)
                if not chunk:
                    break
                text = chunk.decode("utf-8", errors="replace")
                self.output_buffer.append(text)
                self._broadcast({"type": "output", "data": text})
            except Exception:
                break
        self._loop.call_soon_threadsafe(self._handle_eof)

    def write(self, data: str):
        """Writes user input characters to the running shell."""
        if self.status != "running":
            return
        try:
            if not IS_WINDOWS and self.master_fd is not None:
                os.write(self.master_fd, data.encode("utf-8"))
            elif hasattr(self, "_winpty_proc"):
                self._winpty_proc.write(data)
            elif self.process and self.process.stdin:
                self.process.stdin.write(data.encode("utf-8"))
                self.process.stdin.flush()
        except Exception as e:
            logger.error(f"Error writing to terminal {self.id}: {e}")

    def resize(self, cols: int, rows: int):
        """Resizes the terminal window dimensions."""
        if cols <= 0 or rows <= 0:
            return
        self.cols = cols
        self.rows = rows
        if not IS_WINDOWS and self.master_fd is not None:
            self._apply_unix_size(self.master_fd, cols, rows)
        elif hasattr(self, "_winpty_proc"):
            try:
                self._winpty_proc.set_winsize(rows, cols)
            except Exception as e:
                logger.warning(f"Failed to resize winpty: {e}")

    def _broadcast(self, msg: dict):
        if not self.clients:
            return
        payload = json.dumps(msg)
        dead = set()
        for ws in self.clients:
            try:
                asyncio.run_coroutine_threadsafe(ws.send_text(payload), self._loop)
            except Exception:
                dead.add(ws)
        self.clients.difference_update(dead)

    def _handle_eof(self):
        self.reader_active = False
        if not IS_WINDOWS and self.master_fd is not None:
            try:
                if self._loop:
                    self._loop.remove_reader(self.master_fd)
            except Exception:
                pass
            try:
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None

        if self.process:
            try:
                self.process.poll()
                self.exit_code = self.process.returncode
            except Exception:
                pass

        self.status = "exited"
        logger.info(f"Terminal session {self.id} exited with code {self.exit_code}")
        self._broadcast({"type": "exit", "code": self.exit_code})
        self._broadcast({"type": "status", "status": "exited", "exitCode": self.exit_code})

    def kill(self):
        """Terminates the process and cleans up resources."""
        self.reader_active = False
        self.status = "killed"

        if not IS_WINDOWS and self.master_fd is not None:
            try:
                if self._loop:
                    self._loop.remove_reader(self.master_fd)
            except Exception:
                pass
            try:
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None

        if self.process:
            try:
                if not IS_WINDOWS:
                    # Terminate process group
                    os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                else:
                    self.process.terminate()
            except Exception:
                pass

            try:
                self.process.wait(timeout=1.0)
            except Exception:
                try:
                    if not IS_WINDOWS:
                        os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                    else:
                        self.process.kill()
                except Exception:
                    pass

        if hasattr(self, "_winpty_proc"):
            try:
                del self._winpty_proc
            except Exception:
                pass

        self._broadcast({"type": "status", "status": "killed"})


class TerminalManager:
    """Manages all active terminal sessions across projects."""

    def __init__(self):
        self.sessions: Dict[str, TerminalSession] = {}

    def get_project_dir(self, project_id: str) -> Path:
        """Validates and returns the safe root path for a project, ensuring it exists."""
        if not PROJECT_ID_REGEX.match(project_id):
            raise ValueError(f"Invalid project ID: {project_id}")

        project_dir = (PROJECTS_BASE_DIR / project_id).resolve()
        # Security validation: Ensure resolved path is strictly within PROJECTS_BASE_DIR
        if not str(project_dir).startswith(str(PROJECTS_BASE_DIR.resolve())):
            raise ValueError("Path traversal attempt detected.")

        project_dir.mkdir(parents=True, exist_ok=True)

        # Seed board_tool.py, OPENCODE.md, and AGENTS.md if missing
        tool_src = PROJECTS_BASE_DIR / "board_tool.py"
        tool_dest = project_dir / "board_tool.py"
        if tool_src.exists() and not tool_dest.exists():
            try:
                shutil.copy2(str(tool_src), str(tool_dest))
                tool_dest.chmod(0o755)
            except Exception:
                pass

        for doc_name in ("OPENCODE.md", "AGENTS.md"):
            doc_src = WORKSPACE_ROOT / doc_name
            doc_dest = project_dir / doc_name
            if doc_src.exists() and not doc_dest.exists():
                try:
                    shutil.copy2(str(doc_src), str(doc_dest))
                except Exception:
                    pass

        readme = project_dir / "README.md"
        if not readme.exists():
            readme.write_text(
                f"# Visual Workspace — Project: {project_id}\n\n"
                "This directory is directly connected to the live Visual Board in your browser!\n\n"
                "## Visual Board Files:\n"
                "- `board.json`: Live diagram state. Edit or write this file to change the canvas.\n"
                "- `board_readable.md`: Text list of all items currently on the canvas.\n"
                "- `board_tool.py`: CLI helper for AI coding tools (OpenCode, Codex) to draw diagrams.\n"
                "- `OPENCODE.md`: Guide for OpenCode on how to design workflows and diagrams.\n\n"
                "## Quick Commands:\n"
                "- `python board_tool.py design \"Hospital clinical pathway\"`\n"
                "- `python board_tool.py draw-hrms` (Generates HRMS Flowchart on canvas)\n"
                "- `python board_tool.py show` (View current canvas items)\n"
                "- `python board_tool.py add-node --label \"Step Name\" --x 100 --y 100`\n"
                "- `python board_tool.py clear` (Clear the canvas)\n",
                encoding="utf-8",
            )
        return project_dir

    def notify_project_board_update(self, project_id: str):
        """Broadcasts a board update event to all active sessions in the project."""
        for session in self.sessions.values():
            if session.project_id == project_id:
                session._broadcast({"type": "board:updated", "projectId": project_id})


    def detect_available_shells(self) -> List[dict]:
        """Detects available shell executables on the host system."""
        detected = []
        if IS_WINDOWS:
            candidates = [
                ("PowerShell", ["pwsh.exe", "powershell.exe"]),
                ("Command Prompt", ["cmd.exe"]),
                ("Git Bash", [r"C:\Program Files\Git\bin\bash.exe", "bash.exe"]),
            ]
            for label, names in candidates:
                for name in names:
                    path = shutil.which(name)
                    if path:
                        detected.append({"name": label, "path": path, "type": "windows"})
                        break
        else:
            candidates = [
                ("Bash", ["bash", "/bin/bash", "/usr/bin/bash"]),
                ("Zsh", ["zsh", "/bin/zsh", "/usr/bin/zsh"]),
                ("Sh", ["sh", "/bin/sh", "/usr/bin/sh"]),
                ("Fish", ["fish", "/usr/bin/fish"]),
            ]
            for label, names in candidates:
                for name in names:
                    path = shutil.which(name)
                    if path and os.path.exists(path):
                        detected.append({"name": label, "path": path, "type": "unix"})
                        break

        if not detected:
            default_sh = "/bin/sh" if not IS_WINDOWS else "cmd.exe"
            detected.append({"name": "Default", "path": default_sh, "type": "default"})
        return detected

    def get_default_shell(self) -> dict:
        shells = self.detect_available_shells()
        # Prefer bash on Unix, powershell on Windows
        if IS_WINDOWS:
            for s in shells:
                if "powershell" in s["name"].lower():
                    return s
        else:
            for s in shells:
                if "bash" in s["name"].lower():
                    return s
        return shells[0]

    def detect_environment(self) -> dict:
        """Returns host OS, arch, shells, and installed developer tool versions."""
        def run_ver(cmd: str) -> Optional[str]:
            try:
                r = subprocess.run([cmd, "--version"], capture_output=True, text=True, timeout=2)
                return r.stdout.strip().split("\n")[0] if r.returncode == 0 else None
            except Exception:
                return None

        shells = self.detect_available_shells()
        default_shell = self.get_default_shell()

        opencode_bin = str(Path.home() / ".opencode" / "bin" / "opencode")
        tools = {
            "node": run_ver("node"),
            "npm": run_ver("npm"),
            "python": run_ver("python3") or run_ver("python") or sys.version.split()[0],
            "git": run_ver("git"),
            "docker": run_ver("docker"),
            "codex": run_ver("codex"),
            "opencode": run_ver(opencode_bin) if os.path.exists(opencode_bin) else run_ver("opencode"),
            "claude": run_ver("/usr/local/bin/claude") if os.path.exists("/usr/local/bin/claude") else run_ver("claude"),
        }

        return {
            "os": platform.system(),
            "release": platform.release(),
            "arch": platform.machine(),
            "platform": sys.platform,
            "shells": shells,
            "defaultShell": default_shell,
            "tools": tools,
            "projectsBaseDir": str(PROJECTS_BASE_DIR),
        }

    def create_session(
        self,
        project_id: str,
        name: Optional[str] = None,
        shell_path: Optional[str] = None,
        cols: int = 80,
        rows: int = 24,
    ) -> TerminalSession:
        """Creates and launches a new terminal session in the project directory."""
        if len(self.sessions) >= MAX_TOTAL_SESSIONS:
            raise ValueError(f"Maximum total terminal sessions ({MAX_TOTAL_SESSIONS}) reached.")

        project_sessions = [s for s in self.sessions.values() if s.project_id == project_id]
        if len(project_sessions) >= MAX_SESSIONS_PER_PROJECT:
            raise ValueError(f"Maximum terminal sessions ({MAX_SESSIONS_PER_PROJECT}) reached for project {project_id}.")

        project_dir = self.get_project_dir(project_id)
        session_id = str(uuid.uuid4())

        # Select shell
        available_shells = self.detect_available_shells()
        selected_shell = None
        if shell_path:
            for s in available_shells:
                if s["path"] == shell_path or s["name"].lower() == shell_path.lower():
                    selected_shell = s
                    break
        if not selected_shell:
            selected_shell = self.get_default_shell()

        # Session name
        if not name or not name.strip():
            existing_count = len(project_sessions) + 1
            name = f"Terminal {existing_count}"

        session = TerminalSession(
            session_id=session_id,
            project_id=project_id,
            name=name.strip()[:64],
            working_dir=project_dir,
            shell_path=selected_shell["path"],
            shell_name=selected_shell["name"],
            cols=max(20, min(cols, 300)),
            rows=max(5, min(rows, 100)),
        )

        loop = asyncio.get_event_loop()
        session.start(loop)
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[TerminalSession]:
        return self.sessions.get(session_id)

    def list_sessions(self, project_id: Optional[str] = None) -> List[TerminalSession]:
        if project_id:
            return [s for s in self.sessions.values() if s.project_id == project_id]
        return list(self.sessions.values())

    def rename_session(self, session_id: str, new_name: str) -> TerminalSession:
        session = self.get_session(session_id)
        if not session:
            raise KeyError(f"Terminal session {session_id} not found.")
        session.name = new_name.strip()[:64]
        return session

    def delete_session(self, session_id: str):
        session = self.sessions.pop(session_id, None)
        if session:
            session.kill()

    def cleanup_project_sessions(self, project_id: str):
        to_delete = [s_id for s_id, s in self.sessions.items() if s.project_id == project_id]
        for s_id in to_delete:
            self.delete_session(s_id)


# Global singleton instance
terminal_manager = TerminalManager()

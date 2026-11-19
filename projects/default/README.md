# Visual Workspace — Project: My workspace

This directory is directly connected to **Visual Board (Page 1)** in your browser!

## Visual Board Files:
- `board.json`: **Live diagram state.** Edit or write this file to change shapes, nodes, and connectors on the Visual Board!
- `board_readable.md`: Readable list of all shapes and arrows currently on the canvas.
- `board_tool.py`: CLI helper for AI coding agents (OpenAI Codex, OpenCode, Claude Code) and terminal users to draw diagrams.

## How to Draw on the Visual Board:

### 1. Generate HRMS Flowchart:
```bash
python board_tool.py draw-hrms
```

### 2. View current canvas contents:
```bash
python board_tool.py show
```

### 3. Add custom shapes & connectors:
```bash
python board_tool.py add-node --label "Employee Onboarding" --x 200 --y 150 --color blue
python board_tool.py add-arrow --from 1 --to 2 --label "Approved"
```

### 4. Direct JSON editing:
You can directly edit or write `board.json` with `{ "title": "...", "nodes": [...], "arrows": [...] }`.
The web canvas immediately syncs and displays the changes!

# Visual Workspace — Project: 454ee137-d658-4c04-b5ff-bc3c24757d4f

## HRMS workflow with icons and animated data flow

Run `python3 board_tool.py design "make HRMS project workflow"` (or `draw-hrms`).
The command writes the board and generates **[workflow.html](workflow.html)**.
Open that file in a browser for grouped icons, animated arrows, module selection,
data-transfer details and a pause control. Animation is a simulation; no live
HRMS backend is connected. The external board may not support all preview styles.

The reusable source is [templates/hrms.json](templates/hrms.json).
Requirements, design rules, limits and future integration guidance are saved in
[the knowledge base](knowledge_base/workflow-design.md), with request examples in
`knowledge_base/workflow-examples.jsonl`. This preserves project guidance; it does
not retrain an AI model.

This directory is directly connected to the live Visual Board in your browser!

## Visual Board Files:
- `board.json`: Live diagram state. Edit or write this file to change the canvas.
- `board_readable.md`: Text list of all items currently on the canvas.
- `board_tool.py`: CLI helper for AI coding tools (OpenCode, Codex) to draw diagrams.
- `OPENCODE.md`: Guide for OpenCode on how to design workflows and diagrams.

## Quick Commands:
- `python board_tool.py design "Hospital clinical pathway"`
- `python board_tool.py draw-hrms` (Generates HRMS Flowchart on canvas)
- `python board_tool.py show` (View current canvas items)
- `python board_tool.py add-node --label "Step Name" --x 100 --y 100`
- `python board_tool.py clear` (Clear the canvas)

# AI Agent Instructions for Visual Workspace (OpenCode, Codex, Claude Code)

Welcome! This project folder is directly connected to the user's **Visual Workspace Board**.
Whenever the user asks you to **design, draw, create, or update a flowchart or architecture diagram**, you can do it directly using the built-in `board_tool.py` CLI or by editing `board.json`.

---

## 🎨 How to Design Diagrams on the Visual Board

### 1. Natural Language Flowchart Generation (Recommended)
You can run `python3 board_tool.py design "<prompt>"` to generate complete multi-node diagrams with connectors:
```bash
python3 board_tool.py design "Hospital patient admission and clinical care workflow"
python3 board_tool.py design "HRMS recruitment, onboarding, and payroll lifecycle"
python3 board_tool.py design "E-Commerce cart, payment gateway, and warehouse fulfillment"
python3 board_tool.py design "OAuth2 authentication and RBAC authorization gateway"
python3 board_tool.py design "DevOps automated CI/CD pipeline with Docker and Kubernetes"
python3 board_tool.py design "Microservice order processing with Kafka and PostgreSQL"
```

### 2. Instant Pre-built Architecture Blueprints
```bash
python3 board_tool.py draw-hrms       # HRMS, Attendance, Payroll & Offboarding
python3 board_tool.py draw-hospital   # Hospital clinical pathway & EHR
python3 board_tool.py draw-ecommerce  # E-commerce store, checkout & fulfillment
python3 board_tool.py draw-auth       # Zero-trust Auth, MFA, JWT & RBAC
python3 board_tool.py draw-devops     # CI/CD, Container builds & Canary release
```

### 3. Add or Modify Individual Nodes & Connectors
```bash
# Add a node
python3 board_tool.py add-node --label "Payment Service" --x 400 --y 200 --color green

# Connect two nodes
python3 board_tool.py add-arrow --from 1 --to 2 --label "Validated"

# View current canvas items
python3 board_tool.py show

# Clear canvas
python3 board_tool.py clear
```

### 4. Direct JSON Manipulation
- `board.json`: Defines the canvas shapes (`nodes` with `id`, `label`, `x`, `y`, `color`, and `arrows` with `from`, `to`, `label`).
- `board_readable.md`: Text summary of what is currently on the canvas. Read this file to understand the current board state.

Whenever you save `board.json` or run `board_tool.py`, the user's browser canvas updates automatically in real-time!

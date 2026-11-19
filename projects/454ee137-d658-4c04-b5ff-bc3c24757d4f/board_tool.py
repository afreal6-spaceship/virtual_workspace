#!/usr/bin/env python3
"""CLI tool for AI agents (OpenCode, OpenAI Codex, Claude Code) and developers
to inspect, create, and design visual flowcharts on the Visual Workspace Board.

Usage:
    python board_tool.py show
    python board_tool.py design "Hospital clinical workflow"
    python board_tool.py draw-hrms
    python board_tool.py draw-hospital
    python board_tool.py draw-ecommerce
    python board_tool.py draw-auth
    python board_tool.py draw-devops
    python board_tool.py add-node --label "Recruitment" --x 100 --y 100 --color blue
    python board_tool.py add-arrow --from 1 --to 2 --label "Approved"
    python board_tool.py from-json flowchart.json
    python board_tool.py clear
"""

import argparse
import datetime
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
BOARD_FILE = PROJECT_DIR / "board.json"
SUMMARY_FILE = PROJECT_DIR / "board_readable.md"
API_NOTIFY_URL = f"http://127.0.0.1:8000/api/projects/{PROJECT_DIR.name}/board/notify"

# Blueprint specifications for rich visual designs
BLUEPRINTS = {
    "mlops": {
        "title": "Enterprise MLOps Production System Architecture",
        "groups": [
            {"id": "grp_datasources", "title": "Data Sources", "x": 30, "y": 20, "w": 480, "h": 130, "color": "violet", "category": "Ingress"},
            {"id": "grp_deployment", "title": "Model Deployment", "x": 30, "y": 180, "w": 220, "h": 340, "color": "cyan", "category": "CD / Runtime"},
            {"id": "grp_serve", "title": "Serve", "x": 340, "y": 190, "w": 160, "h": 130, "color": "orange", "category": "Inference"},
            {"id": "grp_consume", "title": "Consume", "x": 540, "y": 190, "w": 320, "h": 130, "color": "blue", "category": "Client Facing"},
            {"id": "grp_modeldev", "title": "Model Development", "x": 280, "y": 400, "w": 520, "h": 150, "color": "red", "category": "Training & Eval"},
            {"id": "grp_features", "title": "Feature Engineering", "x": 30, "y": 560, "w": 200, "h": 260, "color": "yellow", "category": "Feature Store"},
            {"id": "grp_datapipeline", "title": "Data Pipeline", "x": 400, "y": 690, "w": 520, "h": 150, "color": "green", "category": "ETL Processing"}
        ],
        "nodes": [
            {"id": "ds_1", "label": "Structured\n(SQL DB / Warehouse)", "x": 50, "y": 55, "color": "violet", "icon": "database", "category": "Data Source"},
            {"id": "ds_2", "label": "Semi-Structured\n(JSON, XML, CSV)", "x": 200, "y": 55, "color": "orange", "icon": "code", "category": "Data Source"},
            {"id": "ds_3", "label": "Unstructured\n(Audio, Text, Media)", "x": 350, "y": 55, "color": "blue", "icon": "mail", "category": "Data Source"},
            {"id": "ext_batch", "label": "Batch Ingestion\n(Kafka Streams)", "x": 40, "y": 880, "color": "green", "icon": "pipeline", "category": "Ingestion"},
            {"id": "ext_lake", "label": "Data Lake\n(Delta Lake / Object Storage)", "x": 260, "y": 880, "color": "cyan", "icon": "datalake", "category": "Storage"},
            {"id": "dp_1", "label": "Validate\n(Schema & Null Checks)", "x": 420, "y": 730, "color": "green", "icon": "check", "category": "Pipeline"},
            {"id": "dp_2", "label": "Clean\n(Outliers & Imputation)", "x": 550, "y": 730, "color": "cyan", "icon": "clean", "category": "Pipeline"},
            {"id": "dp_3", "label": "Standardise\n(Normalization)", "x": 680, "y": 730, "color": "violet", "icon": "standardise", "category": "Pipeline"},
            {"id": "dp_4", "label": "Curate\n(Gold Tables)", "x": 810, "y": 730, "color": "yellow", "icon": "file", "category": "Pipeline"},
            {"id": "fe_1", "label": "Select Features\n(Importance & Ranking)", "x": 50, "y": 600, "color": "yellow", "icon": "features", "category": "Feature Engineering"},
            {"id": "fe_2", "label": "Extract Features\n(Vector Embeddings)", "x": 50, "y": 710, "color": "orange", "icon": "features", "category": "Feature Engineering"},
            {"id": "md_1", "label": "Code\n(Notebooks & Git)", "x": 300, "y": 440, "color": "orange", "icon": "git", "category": "Model"},
            {"id": "md_2", "label": "Train\n(Distributed GPU Cluster)", "x": 430, "y": 440, "color": "red", "icon": "brain", "category": "Model"},
            {"id": "md_3", "label": "Validate\n(Hyperparameters)", "x": 560, "y": 440, "color": "green", "icon": "check", "category": "Model"},
            {"id": "md_4", "label": "Evaluate\n(F1 & ROC-AUC)", "x": 690, "y": 440, "color": "yellow", "icon": "flask", "category": "Model"},
            {"id": "dep_1", "label": "Deploy\n(Canary / Blue-Green)", "x": 50, "y": 220, "color": "cyan", "icon": "rocket", "category": "Deployment"},
            {"id": "dep_2", "label": "Containerise\n(Docker & OCI Images)", "x": 50, "y": 315, "color": "blue", "icon": "container", "category": "Deployment"},
            {"id": "dep_3", "label": "Package\n(ONNX / TensorRT)", "x": 50, "y": 410, "color": "orange", "icon": "box", "category": "Deployment"},
            {"id": "srv_1", "label": "Serve API\n(Triton Server)", "x": 360, "y": 230, "color": "orange", "icon": "api", "category": "API"},
            {"id": "csm_1", "label": "Consume API\n(API Gateway)", "x": 560, "y": 230, "color": "orange", "icon": "api", "category": "API"},
            {"id": "csm_2", "label": "Applications\n(Dashboards & Web)", "x": 700, "y": 230, "color": "blue", "icon": "app", "category": "Application"},
            {"id": "ext_user", "label": "User\n(Enterprise Clients)", "x": 740, "y": 40, "color": "blue", "icon": "user", "category": "Actor"},
            {"id": "ext_monitor", "label": "Monitor\n(Drift & Latency)", "x": 880, "y": 440, "color": "cyan", "icon": "monitor", "category": "Monitoring"}
        ],
        "arrows": [
            {"from": "ds_1", "to": "ext_batch", "label": "Raw Ingestion"},
            {"from": "ext_batch", "to": "ext_lake", "label": "Stream Feed"},
            {"from": "ext_lake", "to": "dp_1", "label": "Batch Read"},
            {"from": "dp_1", "to": "dp_2", "label": "Cleaned"},
            {"from": "dp_2", "to": "dp_3", "label": "Standardized"},
            {"from": "dp_3", "to": "dp_4", "label": "Curated"},
            {"from": "dp_4", "to": "fe_2", "label": "Gold Tables"},
            {"from": "fe_2", "to": "fe_1", "label": "Vectors"},
            {"from": "fe_1", "to": "md_1", "label": "Training Set"},
            {"from": "md_1", "to": "md_2", "label": "Train Job"},
            {"from": "md_2", "to": "md_3", "label": "Weights"},
            {"from": "md_3", "to": "md_4", "label": "Checkpoints"},
            {"from": "md_4", "to": "dep_3", "label": "Promoted"},
            {"from": "dep_3", "to": "dep_2", "label": "Dockerize"},
            {"from": "dep_2", "to": "dep_1", "label": "Deploy Image"},
            {"from": "dep_1", "to": "srv_1", "label": "Active Replica"},
            {"from": "srv_1", "to": "csm_1", "label": "Inference REST"},
            {"from": "csm_1", "to": "csm_2", "label": "Responses"},
            {"from": "csm_2", "to": "ext_user", "label": "Interactions"},
            {"from": "csm_2", "to": "ext_monitor", "label": "Inference Logs"},
            {"from": "ext_monitor", "to": "md_1", "label": "Drift Feedback"}
        ]
    },

    "hrms": {
        "title": "HRMS (Human Resource Management System) Architecture Flowchart",
        "nodes": [
            {"id": "hrms_1", "label": "1. Job Requisition & Posting\n(Hiring Manager & HR)", "x": 80, "y": 80, "color": "blue"},
            {"id": "hrms_2", "label": "2. Applicant Tracking & Sourcing\n(Portal & Referrals)", "x": 360, "y": 80, "color": "blue"},
            {"id": "hrms_3", "label": "3. Interview & Technical Screening\n(Panel Assessment)", "x": 640, "y": 80, "color": "blue"},
            {"id": "hrms_4", "label": "4. Offer Management & BG Check\n(Candidate Acceptance)", "x": 920, "y": 80, "color": "blue"},
            {"id": "hrms_5", "label": "5. Digital Onboarding\n(Document Upload & ID Creation)", "x": 920, "y": 240, "color": "green"},
            {"id": "hrms_6", "label": "6. Employee Master Database\n(Profile, Department, Roles)", "x": 640, "y": 240, "color": "green"},
            {"id": "hrms_7", "label": "7. Time & Attendance System\n(Biometric / Geo-fencing)", "x": 360, "y": 240, "color": "green"},
            {"id": "hrms_8", "label": "8. Leave & Shift Management\n(Accrual & Manager Approval)", "x": 80, "y": 240, "color": "green"},
            {"id": "hrms_9", "label": "9. Payroll & Tax Processing\n(Salary, Deductions, Bonus)", "x": 80, "y": 400, "color": "yellow"},
            {"id": "hrms_10", "label": "10. Direct Deposit & Payslips\n(Banking API & Self-Service)", "x": 360, "y": 400, "color": "yellow"},
            {"id": "hrms_11", "label": "11. Performance & KPI Reviews\n(OKRs, 360 Feedback, Goals)", "x": 640, "y": 400, "color": "yellow"},
            {"id": "hrms_12", "label": "12. Training & L&D Management\n(Courses & Certifications)", "x": 920, "y": 400, "color": "yellow"},
            {"id": "hrms_13", "label": "13. Separation & Offboarding\n(Resignation, Exit Interview, Assets)", "x": 920, "y": 560, "color": "red"},
            {"id": "hrms_14", "label": "14. Full & Final Settlement (FnF)\n(Gratuity, PF, Relieving Letter)", "x": 640, "y": 560, "color": "red"},
        ],
        "arrows": [
            {"from": "hrms_1", "to": "hrms_2", "label": "Applications"},
            {"from": "hrms_2", "to": "hrms_3", "label": "Shortlisted"},
            {"from": "hrms_3", "to": "hrms_4", "label": "Recommended"},
            {"from": "hrms_4", "to": "hrms_5", "label": "Accepted"},
            {"from": "hrms_5", "to": "hrms_6", "label": "Records Stored"},
            {"from": "hrms_6", "to": "hrms_7", "label": "Track Daily"},
            {"from": "hrms_7", "to": "hrms_8", "label": "Leave Balances"},
            {"from": "hrms_8", "to": "hrms_9", "label": "Monthly Cutoff"},
            {"from": "hrms_9", "to": "hrms_10", "label": "Disbursed"},
            {"from": "hrms_6", "to": "hrms_11", "label": "Quarterly Appraisal"},
            {"from": "hrms_11", "to": "hrms_12", "label": "Skill Gaps"},
            {"from": "hrms_11", "to": "hrms_13", "label": "Exit / Retirement"},
            {"from": "hrms_13", "to": "hrms_14", "label": "Clearance Completed"},
        ],
    },
    "hospital": {
        "title": "Hospital Management & Patient Journey Clinical Workflow",
        "nodes": [
            {"id": "h_1", "label": "1. Patient Registration\nCreate patient ID & demographic record", "x": 80, "y": 80, "color": "blue"},
            {"id": "h_2", "label": "2. Appointment / Walk-in\nSchedule visit; emergencies directly to triage", "x": 360, "y": 80, "color": "blue"},
            {"id": "h_3", "label": "3. Triage & Assessment\nRecord vitals, urgency, and allergies", "x": 640, "y": 80, "color": "blue"},
            {"id": "h_4", "label": "4. Doctor Consultation\nReview history, diagnose, create care plan", "x": 920, "y": 80, "color": "blue"},
            {"id": "h_5", "label": "5. Laboratory & Imaging\nOrder sample, run scan & validate results", "x": 920, "y": 240, "color": "green"},
            {"id": "h_6", "label": "6. Outpatient Treatment\nPrescription, minor procedures, patient instructions", "x": 640, "y": 240, "color": "green"},
            {"id": "h_7", "label": "7. Inpatient Admission\nAllocate ward / bed; assign care team", "x": 360, "y": 240, "color": "green"},
            {"id": "h_8", "label": "8. Inpatient Care & Surgery\nNursing, medication administration, OT rounds", "x": 80, "y": 240, "color": "green"},
            {"id": "h_9", "label": "9. Pharmacy Dispensing\nValidate prescription, dispense meds, update stock", "x": 80, "y": 400, "color": "yellow"},
            {"id": "h_10", "label": "10. Discharge Planning\nClinical clearance, summary, medication reconciliation", "x": 360, "y": 400, "color": "yellow"},
            {"id": "h_11", "label": "11. Billing & Insurance\nCapture charges, verify coverage, submit claims", "x": 640, "y": 400, "color": "yellow"},
            {"id": "h_12", "label": "12. Payments & Reconciliation\nCollect patient balance, track insurer payments", "x": 920, "y": 400, "color": "yellow"},
            {"id": "h_13", "label": "13. Follow-up Care\nBook review visit, send reminders, monitor recovery", "x": 920, "y": 560, "color": "violet"},
            {"id": "h_14", "label": "14. Shared EHR & Audits\nCentral clinical record, encounter history & reports", "x": 640, "y": 560, "color": "violet"},
        ],
        "arrows": [
            {"from": "h_1", "to": "h_2"},
            {"from": "h_2", "to": "h_3"},
            {"from": "h_3", "to": "h_4"},
            {"from": "h_4", "to": "h_5"},
            {"from": "h_5", "to": "h_6"},
            {"from": "h_6", "to": "h_7"},
            {"from": "h_7", "to": "h_8"},
            {"from": "h_8", "to": "h_9"},
            {"from": "h_9", "to": "h_10"},
            {"from": "h_10", "to": "h_11"},
            {"from": "h_11", "to": "h_12"},
            {"from": "h_12", "to": "h_13"},
            {"from": "h_13", "to": "h_14"},
        ],
    },
    "ecommerce": {
        "title": "E-Commerce Order Fulfillment & Supply Chain Architecture",
        "nodes": [
            {"id": "e_1", "label": "1. Product Discovery & Cart\nUser browses catalog & adds items to basket", "x": 80, "y": 80, "color": "blue"},
            {"id": "e_2", "label": "2. Checkout & Address Validation\nVerify stock allocation & calculate taxes", "x": 360, "y": 80, "color": "blue"},
            {"id": "e_3", "label": "3. Payment Gateway Authorization\nCredit card, UPI, or PayPal transaction capture", "x": 640, "y": 80, "color": "blue"},
            {"id": "e_4", "label": "4. Order Service & Inventory Lock\nReserve inventory units & emit order.created event", "x": 920, "y": 80, "color": "blue"},
            {"id": "e_5", "label": "5. Warehouse Pick & Pack\nGenerate pick-list, pack parcel & barcode label", "x": 920, "y": 240, "color": "green"},
            {"id": "e_6", "label": "6. Carrier Dispatch & Tracking\nHandover to 3PL logistics with tracking URL", "x": 640, "y": 240, "color": "green"},
            {"id": "e_7", "label": "7. Last-mile Customer Delivery\nDelivery confirmation SMS & invoice email", "x": 360, "y": 240, "color": "green"},
            {"id": "e_8", "label": "8. Returns & RMA Processing\nReverse pickup, condition audit & automated refund", "x": 80, "y": 240, "color": "yellow"},
        ],
        "arrows": [
            {"from": "e_1", "to": "e_2"},
            {"from": "e_2", "to": "e_3"},
            {"from": "e_3", "to": "e_4"},
            {"from": "e_4", "to": "e_5"},
            {"from": "e_5", "to": "e_6"},
            {"from": "e_6", "to": "e_7"},
            {"from": "e_7", "to": "e_8"},
        ],
    },
    "auth": {
        "title": "Modern User Authentication, OAuth2 & RBAC Authorization Architecture",
        "nodes": [
            {"id": "s_1", "label": "1. User Login Request\nClient posts credentials or SSO redirect", "x": 80, "y": 80, "color": "blue"},
            {"id": "s_2", "label": "2. Identity Verification & Rate Limit\nCheck brute-force protection & hash match (Argon2)", "x": 360, "y": 80, "color": "blue"},
            {"id": "s_3", "label": "3. Multi-Factor Challenge (MFA)\nVerify TOTP authenticator code or hardware key (WebAuthn)", "x": 640, "y": 80, "color": "blue"},
            {"id": "s_4", "label": "4. Token Minting (JWT & Refresh Token)\nSign access token with short TTL (15m) & encrypted refresh cookie", "x": 920, "y": 80, "color": "green"},
            {"id": "s_5", "label": "5. API Gateway Authorization Interceptor\nInspect Bearer token signature & check revocation blacklist", "x": 920, "y": 240, "color": "green"},
            {"id": "s_6", "label": "6. RBAC Policy Enforcement (PEP/PDP)\nEvaluate user roles, tenant boundaries & permission matrix", "x": 640, "y": 240, "color": "green"},
            {"id": "s_7", "label": "7. Upstream Microservice Execution\nExecute authorized business operation with trusted user context", "x": 360, "y": 240, "color": "green"},
            {"id": "s_8", "label": "8. Security Audit & SIEM Ingestion\nLog access telemetry, client IP & tamper-proof timestamps", "x": 80, "y": 240, "color": "violet"},
        ],
        "arrows": [
            {"from": "s_1", "to": "s_2"},
            {"from": "s_2", "to": "s_3"},
            {"from": "s_3", "to": "s_4"},
            {"from": "s_4", "to": "s_5"},
            {"from": "s_5", "to": "s_6"},
            {"from": "s_6", "to": "s_7"},
            {"from": "s_7", "to": "s_8"},
        ],
    },
    "devops": {
        "title": "Automated Cloud CI/CD Pipeline & Production Deployment Workflow",
        "nodes": [
            {"id": "d_1", "label": "1. Git Push / Pull Request\nDeveloper triggers webhook on main branch", "x": 80, "y": 80, "color": "blue"},
            {"id": "d_2", "label": "2. Static Analysis & Linting\nRun ESLint, Flake8, SonarQube & secret scanners", "x": 360, "y": 80, "color": "blue"},
            {"id": "d_3", "label": "3. Automated Test Suite\nExecute unit, integration & mocked API contracts", "x": 640, "y": 80, "color": "blue"},
            {"id": "d_4", "label": "4. Container Image Build\nMulti-stage Dockerfile, vulnerability scan (Trivy)", "x": 920, "y": 80, "color": "green"},
            {"id": "d_5", "label": "5. Publish to Container Registry\nTag SHA & push to Google Artifact Registry / ECR", "x": 920, "y": 240, "color": "green"},
            {"id": "d_6", "label": "6. Staging Environment Deployment\nHelm upgrade & automated smoke testing", "x": 640, "y": 240, "color": "green"},
            {"id": "d_7", "label": "7. Canary Production Rollout\nDirect 10% traffic, monitor error rates & latency", "x": 360, "y": 240, "color": "yellow"},
            {"id": "d_8", "label": "8. Full Promotion & Monitoring\n100% rollout, Datadog alerts & Prometheus metrics", "x": 80, "y": 240, "color": "violet"},
        ],
        "arrows": [
            {"from": "d_1", "to": "d_2"},
            {"from": "d_2", "to": "d_3"},
            {"from": "d_3", "to": "d_4"},
            {"from": "d_4", "to": "d_5"},
            {"from": "d_5", "to": "d_6"},
            {"from": "d_6", "to": "d_7"},
            {"from": "d_7", "to": "d_8"},
        ],
    },
}


def load_board():
    if BOARD_FILE.exists():
        try:
            return json.loads(BOARD_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"title": "Visual Board", "nodes": [], "arrows": []}


def save_board(data):
    BOARD_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    update_markdown_summary(data)
    notify_frontend()


def notify_frontend():
    try:
        req = urllib.request.Request(API_NOTIFY_URL, data=b"{}", headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=1.0)
    except Exception:
        pass


def update_markdown_summary(data):
    nodes = data.get("nodes", [])
    arrows = data.get("arrows", [])
    title = data.get("title", "Visual Board")

    lines = [
        f"# {title}",
        f"*Last updated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*",
        "",
        f"**Total Nodes:** {len(nodes)}  |  **Total Connectors:** {len(arrows)}",
        "",
        "## Current Nodes on Canvas",
    ]

    if not nodes:
        lines.append("_Canvas is currently empty._")
    else:
        for idx, n in enumerate(nodes, start=1):
            n_id = n.get("id", str(idx))
            label = n.get("label", "Untitled").replace("\n", " - ")
            pos = f"({n.get('x', 0)}, {n.get('y', 0)})"
            color = n.get("color", "default")
            lines.append(f"- **[{n_id}]** `{label}` at {pos} [{color}]")

    if arrows:
        lines.extend(["", "## Flow Connections"])
        for a in arrows:
            lbl = f" --({a.get('label')})--> " if a.get("label") else " ----> "
            lines.append(f"- `[{a.get('from')}]`{lbl}`[{a.get('to')}]`")

    SUMMARY_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def cmd_show():
    board = load_board()
    nodes = board.get("nodes", [])
    arrows = board.get("arrows", [])
    print(f"=== Visual Board: {board.get('title', 'Untitled')} ===")
    print(f"Nodes ({len(nodes)}):")
    for n in nodes:
        lbl = n.get('label', '').replace('\n', ' ')
        print(f"  [{n.get('id')}] '{lbl}' at ({n.get('x')}, {n.get('y')}) [color: {n.get('color', 'blue')}]")
    print(f"Arrows ({len(arrows)}):")
    for a in arrows:
        lbl = f" ({a.get('label')})" if a.get("label") else ""
        print(f"  [{a.get('from')}] -> [{a.get('to')}]{lbl}")


def cmd_clear():
    data = {"title": "Visual Board", "nodes": [], "arrows": []}
    save_board(data)
    print("Visual Board cleared.")


def cmd_add_node(label, x, y, color="blue", node_id=None, width=220, height=90):
    board = load_board()
    nodes = board.setdefault("nodes", [])
    if not node_id:
        node_id = str(len(nodes) + 1)
    new_node = {
        "id": str(node_id),
        "label": label,
        "x": int(x),
        "y": int(y),
        "w": int(width),
        "h": int(height),
        "color": color,
    }
    nodes.append(new_node)
    save_board(board)
    print(f"Added node [{node_id}] '{label}' at ({x}, {y}).")


def cmd_add_arrow(from_id, to_id, label=None):
    board = load_board()
    arrows = board.setdefault("arrows", [])
    arrow = {"from": str(from_id), "to": str(to_id)}
    if label:
        arrow["label"] = label
    arrows.append(arrow)
    save_board(board)
    print(f"Added arrow from [{from_id}] to [{to_id}].")


def cmd_from_json(json_path):
    p = Path(json_path)
    if not p.is_file():
        print(f"Error: File {json_path} does not exist.", file=sys.stderr)
        sys.exit(1)
    data = json.loads(p.read_text(encoding="utf-8"))
    save_board(data)
    print(f"Loaded board from {json_path}. Total nodes: {len(data.get('nodes', []))}")


def apply_blueprint(key: str):
    if key not in BLUEPRINTS:
        print(f"Unknown blueprint: {key}. Available: {list(BLUEPRINTS.keys())}", file=sys.stderr)
        return False
    data = BLUEPRINTS[key]
    save_board(data)
    print(f"✓ {data['title']} successfully rendered to board.json!")
    print(f"Nodes: {len(data['nodes'])}, Arrows: {len(data['arrows'])}.")
    print("Visual Board canvas in your browser will automatically reflect the design.")
    return True


def cmd_design(prompt: str):
    """Generates a complete multi-step flowchart based on a natural language prompt."""
    p_lower = prompt.lower()
    
    # 1. Match known blueprints
    if any(k in p_lower for k in ["hrms", "hr", "recruit", "payroll", "employee", "leave", "onboard"]):
        return apply_blueprint("hrms")
    elif any(k in p_lower for k in ["hospital", "patient", "clinic", "doctor", "health", "triage", "medical"]):
        return apply_blueprint("hospital")
    elif any(k in p_lower for k in ["ecommerce", "e-commerce", "cart", "checkout", "order", "store", "shop"]):
        return apply_blueprint("ecommerce")
    elif any(k in p_lower for k in ["auth", "login", "jwt", "oauth", "rbac", "security", "identity", "token"]):
        return apply_blueprint("auth")
    elif any(k in p_lower for k in ["devops", "cicd", "ci/cd", "pipeline", "docker", "deploy", "kubernetes", "git"]):
        return apply_blueprint("devops")
    
    # 2. General workflow synthesis if custom prompt
    title = f"Architecture Design: {prompt.strip()}"
    words = [w.capitalize() for w in re.findall(r"\w+", prompt) if len(w) > 2]
    
    steps = [
        ("Client Request & Input", "User initiates action through web or mobile interface", "blue"),
        ("Validation & Gateway", "Rate limiting, schema validation & security token check", "blue"),
        ("Core Business Processing", f"Execute business logic for {prompt[:40]}", "green"),
        ("Data Persistence & Storage", "Atomic database transaction & audit logging", "green"),
        ("Notification & Integration", "Async event publish & client webhook/notification", "yellow"),
        ("Completion & Client Response", "Return 200 OK response with structured payload", "violet"),
    ]
    
    nodes = []
    arrows = []
    
    for idx, (step_title, step_desc, color) in enumerate(steps, start=1):
        nid = f"step_{idx}"
        row = (idx - 1) // 3
        col = (idx - 1) % 3
        x = 80 + col * 320
        y = 100 + row * 200
        nodes.append({
            "id": nid,
            "label": f"{idx}. {step_title}\n{step_desc}",
            "x": x,
            "y": y,
            "color": color
        })
        if idx > 1:
            prev_id = f"step_{idx-1}"
            arrows.append({"from": prev_id, "to": nid})
            
    data = {"title": title, "nodes": nodes, "arrows": arrows}
    save_board(data)
    print(f"✓ Generated custom architecture design for: '{prompt}'!")
    print(f"Nodes: {len(nodes)}, Arrows: {len(arrows)}.")
    print("Visual Board canvas in your browser will automatically reflect the design.")


def main():
    parser = argparse.ArgumentParser(description="Visual Workspace Board CLI for OpenCode, Codex & Claude")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("show", help="Display all nodes and connections on the board")
    subparsers.add_parser("clear", help="Clear the board")
    
    # Pre-built blueprints
    subparsers.add_parser("draw-mlops", help="Generate Enterprise MLOps architecture")
    subparsers.add_parser("draw-hrms", help="Generate HRMS system flowchart")
    subparsers.add_parser("draw-hospital", help="Generate Hospital clinical ERP flowchart")
    subparsers.add_parser("draw-ecommerce", help="Generate E-Commerce fulfillment pipeline")
    subparsers.add_parser("draw-auth", help="Generate Authentication & RBAC architecture")
    subparsers.add_parser("draw-devops", help="Generate DevOps CI/CD pipeline")

    # Smart natural language designer
    design_parser = subparsers.add_parser("design", help="Generate complete flowchart from prompt")
    design_parser.add_argument("prompt", help="Description of the system or workflow to design")

    add_parser = subparsers.add_parser("add-node", help="Add a node to the board")
    add_parser.add_argument("--label", required=True, help="Text label of the node")
    add_parser.add_argument("--x", type=int, default=100, help="X coordinate")
    add_parser.add_argument("--y", type=int, default=100, help="Y coordinate")
    add_parser.add_argument("--color", default="blue", choices=["blue", "green", "yellow", "red", "violet", "black"], help="Node color")
    add_parser.add_argument("--id", default=None, help="Custom node ID")

    arrow_parser = subparsers.add_parser("add-arrow", help="Add a connection arrow between nodes")
    arrow_parser.add_argument("--from", dest="from_id", required=True, help="Origin node ID")
    arrow_parser.add_argument("--to", dest="to_id", required=True, help="Destination node ID")
    arrow_parser.add_argument("--label", default=None, help="Arrow label")

    from_json_parser = subparsers.add_parser("from-json", help="Load diagram from a JSON file")
    from_json_parser.add_argument("file", help="Path to JSON file")

    args = parser.parse_args()

    if args.command == "show":
        cmd_show()
    elif args.command == "clear":
        cmd_clear()
    elif args.command == "draw-mlops":
        apply_blueprint("mlops")
    elif args.command == "draw-hrms":
        apply_blueprint("hrms")
    elif args.command == "draw-hospital":
        apply_blueprint("hospital")
    elif args.command == "draw-ecommerce":
        apply_blueprint("ecommerce")
    elif args.command == "draw-auth":
        apply_blueprint("auth")
    elif args.command == "draw-devops":
        apply_blueprint("devops")
    elif args.command == "design":
        cmd_design(args.prompt)
    elif args.command == "add-node":
        cmd_add_node(args.label, args.x, args.y, args.color, getattr(args, "id", None))
    elif args.command == "add-arrow":
        cmd_add_arrow(args.from_id, args.to_id, args.label)
    elif args.command == "from-json":
        cmd_from_json(args.file)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

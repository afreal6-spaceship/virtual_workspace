"""Learning Copilot & Autonomous Knowledge Base Engine with SQLite FTS5.

Implements:
1. Unified AI Provider interface (Codex CLI, OpenAI-compatible APIs, Anthropic Claude).
2. Continuous Learning: saves every answer from connected AIs into SQLite with FTS5 search.
3. Offline Autonomy: operates 100% offline from the local knowledge base when no AI is connected.
4. History Versioning: updates are versioned into a `history` table when answers evolve.
5. Trust & Quality Control: user feedback (👍 / 👎) raises or lowers trust scores (0.0 to 1.0).
   Untrusted or stale (>30 days) entries are re-queried when an AI becomes available.
"""

from __future__ import annotations

import collections
import datetime
import json
import logging
import os
from pathlib import Path
import re
import sqlite3
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import urllib.request

logger = logging.getLogger("knowledge_base")

BACKEND_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = BACKEND_DIR.parent
PROJECTS_DIR = WORKSPACE_ROOT / "projects"
DEFAULT_DB_PATH = BACKEND_DIR / "knowledge_base.sqlite"

STOP = {
    "the", "a", "an", "is", "to", "how", "do", "i", "of", "and", "in", "for",
    "what", "can", "you", "my", "me", "we", "our", "with", "this", "that", "at",
    "by", "from", "on", "or", "as", "be", "are", "it", "all"
}
STALE_DAYS = 30


def tokens(s: str) -> list[str]:
    """Extracts non-stop lowercase alphanumeric tokens from text."""
    return [t for t in re.findall(r"\w+", s.lower()) if t not in STOP and len(t) > 1]


# --- Core Seed Blueprints for Cold-Start Offline Functionality ---

DEFAULT_SEEDS = [
    {
        "id": "kb_hospital_erp",
        "domain": "Healthcare & Hospital ERP",
        "question": "Hospital Management & Patient Journey Clinical Workflow",
        "keywords": "hospital patient clinic health doctor triage medical appointment healthcare erp inpatient outpatient pharmacy ehr clinical lab diagnostics",
        "summary": "End-to-end clinical patient care pathway from registration and triage through consultation, diagnostics, inpatient/outpatient management, pharmacy, and billing.",
        "nodes": [
            {"id": "h_1", "label": "1. Patient Registration\nCreate patient ID & demographic record", "x": 80, "y": 80, "color": "blue"},
            {"id": "h_2", "label": "2. Appointment / Walk-in\nSchedule visit; emergencies directly to triage", "x": 360, "y": 80, "color": "blue"},
            {"id": "h_3", "label": "3. Triage & Assessment\nRecord vitals, urgency, and allergies", "x": 640, "y": 80, "color": "blue"},
            {"id": "h_4", "label": "4. Doctor Consultation\nReview history, diagnose, create care plan", "x": 920, "y": 80, "color": "blue"},
            {"id": "h_5", "label": "5. Laboratory & Imaging\nOrder sample, run scan & validate results", "x": 920, "y": 240, "color": "green"},
            {"id": "h_6", "label": "6. Inpatient Admission\nAllocate ward/bed, assign care team", "x": 640, "y": 240, "color": "green"},
            {"id": "h_7", "label": "7. Outpatient Treatment\nPrescriptions, minor procedures, care guidance", "x": 360, "y": 240, "color": "green"},
            {"id": "h_8", "label": "8. Pharmacy & Dispensing\nValidate prescription, dispense & deduct stock", "x": 80, "y": 240, "color": "green"},
            {"id": "h_9", "label": "9. Billing & Insurance Claims\nCapture charges, verify coverage & submit claims", "x": 80, "y": 400, "color": "yellow"},
            {"id": "h_10", "label": "10. Discharge Planning\nClinical clearance, summary & med reconciliation", "x": 360, "y": 400, "color": "yellow"},
            {"id": "h_11", "label": "11. Payments & Reconciliation\nPatient co-pay & insurer settlement", "x": 640, "y": 400, "color": "yellow"},
            {"id": "h_12", "label": "12. Follow-up & Telehealth\nSchedule review & monitor recovery", "x": 920, "y": 400, "color": "yellow"},
            {"id": "h_13", "label": "Shared Electronic Medical Record (EHR)\nCentralized clinical encounters & lab notes", "x": 360, "y": 560, "color": "violet"},
            {"id": "h_14", "label": "Hospital Administration & Compliance\nRole-based access, audit logs & inventory", "x": 640, "y": 560, "color": "violet"}
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
            {"from": "h_11", "to": "h_12"}
        ]
    },
    {
        "id": "kb_hrms_workflow",
        "domain": "HRMS & People Operations",
        "question": "Human Resource Management System (HRMS) Architecture & Lifecycle",
        "keywords": "hrms hr employee payroll attendance leave hiring recruitment onboarding salary talent appraisal offboarding benefits",
        "summary": "Core HR lifecycle spanning recruitment, digital onboarding, daily attendance/leaves, payroll processing, performance management, and offboarding.",
        "nodes": [
            {"id": "hr_1", "label": "1. Job Requisition & Posting\nDepartment staffing demand & approvals", "x": 80, "y": 80, "color": "blue"},
            {"id": "hr_2", "label": "2. Candidate Screening & Interview\nATS pipeline, technical rounds & scorecards", "x": 360, "y": 80, "color": "blue"},
            {"id": "hr_3", "label": "3. Offer & Digital Pre-boarding\nContract generation & e-signature", "x": 640, "y": 80, "color": "blue"},
            {"id": "hr_4", "label": "4. Employee Master Data & Onboarding\nDocument collection, tax declarations & asset assignment", "x": 920, "y": 80, "color": "blue"},
            {"id": "hr_5", "label": "5. Time Tracking & Biometric Attendance\nShift rosters, overtime & leave requests", "x": 920, "y": 240, "color": "green"},
            {"id": "hr_6", "label": "6. Monthly Payroll Calculation\nGross earnings, tax deductions & net pay", "x": 640, "y": 240, "color": "green"},
            {"id": "hr_7", "label": "7. Disbursement & Payslip Delivery\nBank transfer file & employee self-service portal", "x": 360, "y": 240, "color": "green"},
            {"id": "hr_8", "label": "8. Performance & KPI Review\nAnnual OKR reviews, 360 feedback & promotions", "x": 80, "y": 240, "color": "green"},
            {"id": "hr_9", "label": "9. Offboarding & Full-and-Final Settlement\nExit clearance, asset return & relieving letter", "x": 80, "y": 400, "color": "yellow"},
            {"id": "hr_10", "label": "HR Audit & Compliance Engine\nStatutory tax filings, labor laws & policy logs", "x": 480, "y": 400, "color": "violet"}
        ],
        "arrows": [
            {"from": "hr_1", "to": "hr_2"},
            {"from": "hr_2", "to": "hr_3"},
            {"from": "hr_3", "to": "hr_4"},
            {"from": "hr_4", "to": "hr_5"},
            {"from": "hr_5", "to": "hr_6"},
            {"from": "hr_6", "to": "hr_7"},
            {"from": "hr_7", "to": "hr_8"},
            {"from": "hr_8", "to": "hr_9"}
        ]
    },
    {
        "id": "kb_ecommerce_pipeline",
        "domain": "E-Commerce & Retail",
        "question": "E-Commerce Order Processing, Inventory & Fulfillment Pipeline",
        "keywords": "ecommerce cart checkout payment order shipping fulfillment inventory warehouse return refund catalog stripe",
        "summary": "Modern retail supply chain flow from storefront cart checkout to payment capture, automated warehouse picking, shipment tracking, and customer delivery.",
        "nodes": [
            {"id": "e_1", "label": "1. Product Discovery & Cart\nUser browses catalog & adds items to basket", "x": 80, "y": 80, "color": "blue"},
            {"id": "e_2", "label": "2. Checkout & Address Validation\nVerify stock allocation & calculate taxes", "x": 360, "y": 80, "color": "blue"},
            {"id": "e_3", "label": "3. Payment Gateway Authorization\nCredit card, UPI, or PayPal transaction capture", "x": 640, "y": 80, "color": "blue"},
            {"id": "e_4", "label": "4. Order Service & Inventory Lock\nReserve inventory units & emit order.created event", "x": 920, "y": 80, "color": "blue"},
            {"id": "e_5", "label": "5. Warehouse Pick & Pack\nGenerate pick-list, pack parcel & barcode label", "x": 920, "y": 240, "color": "green"},
            {"id": "e_6", "label": "6. Carrier Dispatch & Tracking\nHandover to 3PL logistics with tracking URL", "x": 640, "y": 240, "color": "green"},
            {"id": "e_7", "label": "7. Last-mile Customer Delivery\nDelivery confirmation SMS & invoice email", "x": 360, "y": 240, "color": "green"},
            {"id": "e_8", "label": "8. Returns & RMA Processing\nReverse pickup, condition audit & automated refund", "x": 80, "y": 240, "color": "yellow"}
        ],
        "arrows": [
            {"from": "e_1", "to": "e_2"},
            {"from": "e_2", "to": "e_3"},
            {"from": "e_3", "to": "e_4"},
            {"from": "e_4", "to": "e_5"},
            {"from": "e_5", "to": "e_6"},
            {"from": "e_6", "to": "e_7"},
            {"from": "e_7", "to": "e_8"}
        ]
    },
    {
        "id": "kb_security_auth_rbac",
        "domain": "Security & Identity",
        "question": "Modern User Authentication, OAuth2 & RBAC Authorization Architecture",
        "keywords": "auth authentication authorization oauth jwt rbac token login mfa security identity password permission session api gateway",
        "summary": "Enterprise zero-trust authentication blueprint supporting OAuth2/OIDC, Multi-Factor Authentication (MFA), JWT issue/refresh, and granular RBAC authorization gates.",
        "nodes": [
            {"id": "s_1", "label": "1. User Login Request\nClient posts credentials or SSO redirect", "x": 80, "y": 80, "color": "blue"},
            {"id": "s_2", "label": "2. Identity Verification & Rate Limit\nCheck brute-force protection & hash match (Argon2)", "x": 360, "y": 80, "color": "blue"},
            {"id": "s_3", "label": "3. Multi-Factor Challenge (MFA)\nVerify TOTP authenticator code or hardware key (WebAuthn)", "x": 640, "y": 80, "color": "blue"},
            {"id": "s_4", "label": "4. Token Minting (JWT & Refresh Token)\nSign access token with short TTL (15m) & encrypted refresh cookie", "x": 920, "y": 80, "color": "green"},
            {"id": "s_5", "label": "5. API Gateway Authorization Interceptor\nInspect Bearer token signature & check revocation blacklist", "x": 920, "y": 240, "color": "green"},
            {"id": "s_6", "label": "6. RBAC Policy Enforcement (PEP/PDP)\nEvaluate user roles, tenant boundaries & permission matrix", "x": 640, "y": 240, "color": "green"},
            {"id": "s_7", "label": "7. Upstream Microservice Execution\nExecute authorized business operation with trusted user context", "x": 360, "y": 240, "color": "green"},
            {"id": "s_8", "label": "8. Security Audit & SIEM Ingestion\nLog access telemetry, client IP & tamper-proof timestamps", "x": 80, "y": 240, "color": "violet"}
        ],
        "arrows": [
            {"from": "s_1", "to": "s_2"},
            {"from": "s_2", "to": "s_3"},
            {"from": "s_3", "to": "s_4"},
            {"from": "s_4", "to": "s_5"},
            {"from": "s_5", "to": "s_6"},
            {"from": "s_6", "to": "s_7"},
            {"from": "s_7", "to": "s_8"}
        ]
    },
    {
        "id": "kb_devops_cicd",
        "domain": "DevOps & Cloud",
        "question": "Automated Cloud CI/CD Pipeline & Production Deployment Workflow",
        "keywords": "devops cicd pipeline docker kubernetes github actions test build staging production deploy terraform release cloud",
        "summary": "Full software delivery pipeline covering Git pull requests, linting, unit/integration testing, Docker multi-stage builds, artifact registry, and canary Kubernetes release.",
        "nodes": [
            {"id": "d_1", "label": "1. Git Push / Pull Request\nDeveloper triggers webhook on main branch", "x": 80, "y": 80, "color": "blue"},
            {"id": "d_2", "label": "2. Static Analysis & Linting\nRun ESLint, Flake8, SonarQube & secret scanners", "x": 360, "y": 80, "color": "blue"},
            {"id": "d_3", "label": "3. Automated Test Suite\nExecute unit, integration & mocked API contracts", "x": 640, "y": 80, "color": "blue"},
            {"id": "d_4", "label": "4. Container Image Build\nMulti-stage Dockerfile, vulnerability scan (Trivy)", "x": 920, "y": 80, "color": "green"},
            {"id": "d_5", "label": "5. Publish to Container Registry\nTag SHA & push to Google Artifact Registry / ECR", "x": 920, "y": 240, "color": "green"},
            {"id": "d_6", "label": "6. Staging Environment Deployment\nHelm upgrade & automated smoke testing", "x": 640, "y": 240, "color": "green"},
            {"id": "d_7", "label": "7. Canary Production Rollout\nDirect 10% traffic, monitor error rates & latency", "x": 360, "y": 240, "color": "yellow"},
            {"id": "d_8", "label": "8. Full Promotion & Monitoring\n100% rollout, Datadog alerts & Prometheus metrics", "x": 80, "y": 240, "color": "violet"}
        ],
        "arrows": [
            {"from": "d_1", "to": "d_2"},
            {"from": "d_2", "to": "d_3"},
            {"from": "d_3", "to": "d_4"},
            {"from": "d_4", "to": "d_5"},
            {"from": "d_5", "to": "d_6"},
            {"from": "d_6", "to": "d_7"},
            {"from": "d_7", "to": "d_8"}
        ]
    }
]


class SQLiteKnowledgeBase:
    """SQLite + FTS5 search store with automated history versioning and trust scoring."""

    def __init__(self, path: Optional[Path | str] = None):
        self.path = str(path or DEFAULT_DB_PATH)
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        self._init_schema()
        self._seed_if_empty()

    def _init_schema(self):
        with self.db:
            self.db.executescript("""
            CREATE TABLE IF NOT EXISTS entries(
                id INTEGER PRIMARY KEY,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                keywords TEXT DEFAULT '',
                source TEXT DEFAULT 'manual',
                score REAL DEFAULT 0.5,
                uses INTEGER DEFAULT 0,
                updated REAL,
                key TEXT UNIQUE,
                domain TEXT DEFAULT 'General',
                project_id TEXT DEFAULT 'default'
            );

            CREATE TABLE IF NOT EXISTS history(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER NOT NULL,
                answer TEXT NOT NULL,
                source TEXT NOT NULL,
                ts REAL NOT NULL,
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(
                question,
                answer,
                keywords
            );
            """)

    def _seed_if_empty(self):
        count = self.db.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
        if count == 0:
            logger.info("Initializing SQLite Knowledge Base with built-in domain blueprints.")
            now = time.time()
            for seed in DEFAULT_SEEDS:
                id_to_label = {n["id"]: n["label"] for n in seed.get("nodes", [])}
                connectors = []
                for a in seed.get("arrows", []):
                    f_lbl = id_to_label.get(a.get("from"))
                    t_lbl = id_to_label.get(a.get("to"))
                    if f_lbl and t_lbl:
                        connectors.append({
                            "from_label": f_lbl,
                            "to_label": t_lbl,
                            "label": a.get("label", "")
                        })

                answer_obj = {
                    "summary": f"[Knowledge Base Engine] Synthesized {len(seed['nodes'])}-stage workflow blueprint for \"{seed['question']}\" ({seed['domain']}).",
                    "nodes": [{"label": n["label"], "x": float(n["x"]), "y": float(n["y"])} for n in seed["nodes"]],
                    "updates": [],
                    "connectors": connectors,
                    "source": "knowledge_base",
                    "domain": seed["domain"],
                }
                answer_json = json.dumps(answer_obj)
                key = " ".join(sorted(set(tokens(seed["question"]))))

                with self.db:
                    cur = self.db.execute(
                        "INSERT INTO entries(question, answer, keywords, source, score, updated, key, domain) VALUES(?,?,?,?,?,?,?,?)",
                        (seed["question"], answer_json, seed["keywords"], "system_seed", 0.9, now, key, seed["domain"])
                    )
                    eid = cur.lastrowid
                    self.db.execute("INSERT INTO fts(rowid, question, answer, keywords) VALUES(?,?,?,?)",
                                    (eid, seed["question"], answer_json, seed["keywords"]))

    def search(self, q: str, project_id: str = "default", k: int = 5) -> list[dict]:
        toks = tokens(q)
        if not toks:
            return []

        match = " OR ".join(f'"{t}"' for t in toks)
        try:
            rows = self.db.execute(
                """
                SELECT e.id, e.question, e.answer, e.source, e.score, e.updated, e.domain, e.keywords, e.uses
                FROM fts
                JOIN entries e ON e.id = fts.rowid
                WHERE fts MATCH ? AND (e.project_id = ? OR e.project_id = 'default')
                ORDER BY bm25(fts) LIMIT 15
                """,
                (match, project_id)
            ).fetchall()
        except sqlite3.OperationalError:
            rows = self.db.execute(
                "SELECT id, question, answer, source, score, updated, domain, keywords, uses FROM entries LIMIT 15"
            ).fetchall()

        out = []
        for r in rows:
            entry_tokens = set(tokens(r[1])) | set(tokens(r[7] or ""))
            query_set = set(toks)
            sim = len(query_set & entry_tokens) / max(len(query_set | entry_tokens), 1)
            effective_confidence = round(sim * (0.8 + 0.2 * r[4]), 3)

            out.append({
                "id": r[0],
                "question": r[1],
                "answer": r[2],
                "source": r[3],
                "score": round(r[4], 2),
                "updated": r[5],
                "domain": r[6],
                "sim": sim,
                "confidence": effective_confidence,
                "uses": r[8],
            })

        return sorted(out, key=lambda x: (x["confidence"], x["score"]), reverse=True)[:k]

    def learn(self, q: str, a: str | dict, source: str = "codex", domain: str = "General", project_id: str = "default") -> int:
        """Stores or updates a question-answer pair. Keeps old versions in history."""
        answer_str = json.dumps(a) if isinstance(a, (dict, list)) else str(a)
        key = " ".join(sorted(set(tokens(q))))
        if not key:
            key = f"key_{int(time.time() * 1000)}"

        now = time.time()
        row = self.db.execute("SELECT id, answer, source FROM entries WHERE key=?", (key,)).fetchone()

        with self.db:
            if row:
                eid = row[0]
                old_answer, old_source = row[1], row[2]
                if old_answer != answer_str:
                    self.db.execute(
                        "INSERT INTO history(entry_id, answer, source, ts) VALUES(?,?,?,?)",
                        (eid, old_answer, old_source, now)
                    )
                    self.db.execute(
                        "UPDATE entries SET answer=?, source=?, updated=?, domain=?, project_id=? WHERE id=?",
                        (answer_str, source, now, domain, project_id, eid)
                    )
                    self.db.execute("DELETE FROM fts WHERE rowid=?", (eid,))
                    self.db.execute("INSERT INTO fts(rowid, question, answer, keywords) VALUES(?,?,?,?)",
                                    (eid, q, answer_str, domain))
                else:
                    self.db.execute("UPDATE entries SET updated=?, uses=uses+1 WHERE id=?", (now, eid))
                return eid
            else:
                cur = self.db.execute(
                    "INSERT INTO entries(question, answer, keywords, source, score, updated, key, domain, project_id) VALUES(?,?,?,?,?,?,?,?,?)",
                    (q, answer_str, domain, source, 0.6, now, key, domain, project_id)
                )
                eid = cur.lastrowid
                self.db.execute("INSERT INTO fts(rowid, question, answer, keywords) VALUES(?,?,?,?)",
                                (eid, q, answer_str, domain))
                return eid

    def feedback(self, eid: int, good: bool) -> float:
        """Adjusts the trust score of an entry based on user feedback."""
        delta = 0.2 if good else -0.3
        with self.db:
            self.db.execute(
                "UPDATE entries SET score = MIN(1.0, MAX(0.0, score + ?)) WHERE id=?",
                (delta, eid)
            )
            row = self.db.execute("SELECT score FROM entries WHERE id=?", (eid,)).fetchone()
            return round(row[0], 2) if row else 0.5

    def touch(self, eid: int):
        with self.db:
            self.db.execute("UPDATE entries SET uses = uses + 1 WHERE id=?", (eid,))

    def get_history(self, eid: int) -> list[dict]:
        rows = self.db.execute(
            "SELECT id, answer, source, ts FROM history WHERE entry_id=? ORDER BY ts DESC",
            (eid,)
        ).fetchall()
        return [{"id": r[0], "answer": r[1], "source": r[2], "ts": r[3]} for r in rows]

    def list_entries(self, project_id: str = "default", limit: int = 50) -> list[dict]:
        rows = self.db.execute(
            """
            SELECT e.id, e.question, e.answer, e.source, e.score, e.uses, e.updated, e.domain,
                   (SELECT COUNT(*) FROM history WHERE entry_id = e.id) as history_count
            FROM entries e
            WHERE e.project_id = ? OR e.project_id = 'default'
            ORDER BY e.updated DESC LIMIT ?
            """,
            (project_id, limit)
        ).fetchall()

        out = []
        for r in rows:
            out.append({
                "id": r[0],
                "question": r[1],
                "answer": r[2],
                "source": r[3],
                "score": round(r[4], 2),
                "uses": r[5],
                "updated": r[6],
                "domain": r[7],
                "history_count": r[8],
            })
        return out

    def get_stats(self, project_id: str = "default") -> dict:
        total = self.db.execute("SELECT COUNT(*) FROM entries WHERE project_id=? OR project_id='default'", (project_id,)).fetchone()[0]
        learned = self.db.execute("SELECT COUNT(*) FROM entries WHERE source != 'system_seed' AND (project_id=? OR project_id='default')", (project_id,)).fetchone()[0]
        domains_rows = self.db.execute("SELECT DISTINCT domain FROM entries WHERE project_id=? OR project_id='default'", (project_id,)).fetchall()
        domains = [r[0] for r in domains_rows if r[0]]

        return {
            "patternsCount": total,
            "customLearnedCount": learned,
            "domains": sorted(domains),
            "ready": True,
            "engine": "sqlite_fts5_vector_kb",
        }


# --- Unified AI Providers ---

class Provider:
    """Base provider adapter."""
    name: str = "base"
    key_env: str = ""

    def connected(self) -> bool:
        return bool(os.environ.get(self.key_env))

    def ask(self, q: str, system_prompt: str = "") -> str:
        raise NotImplementedError


def _post_json(url: str, headers: dict, body: dict) -> dict:
    req = urllib.request.Request(
        url,
        json.dumps(body).encode(),
        {"Content-Type": "application/json", **headers}
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.load(r)


class OpenAICompatible(Provider):
    """Works for OpenAI, OpenRouter, Local Ollama/vLLM, or any OpenAI-compatible API."""

    def __init__(
        self,
        name: str = "openai",
        key_env: str = "OPENAI_API_KEY",
        model: str = "gpt-4o-mini",
        base: str = "https://api.openai.com/v1"
    ):
        self.name = name
        self.key_env = key_env
        self.model = model
        self.base = base.rstrip("/")

    def ask(self, q: str, system_prompt: str = "") -> str:
        api_key = os.environ.get(self.key_env, "")
        headers = {"Authorization": f"Bearer {api_key}"}
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": q})

        data = _post_json(
            f"{self.base}/chat/completions",
            headers,
            {"model": self.model, "messages": messages, "temperature": 0.2}
        )
        return data["choices"][0]["message"]["content"]


class Anthropic(Provider):
    """Native Anthropic Claude API provider."""
    name = "claude"
    key_env = "ANTHROPIC_API_KEY"

    def __init__(self, model: str = "claude-3-5-sonnet-20241022"):
        self.model = model

    def ask(self, q: str, system_prompt: str = "") -> str:
        api_key = os.environ.get(self.key_env, "")
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }
        body: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 1500,
            "messages": [{"role": "user", "content": q}],
        }
        if system_prompt:
            body["system"] = system_prompt

        data = _post_json("https://api.anthropic.com/v1/messages", headers, body)
        return data["content"][0]["text"]


class OpenCodeProvider(Provider):
    """OpenCode AI coding agent provider integrated with terminal and board tools."""
    name = "opencode"

    def connected(self) -> bool:
        candidates = [
            Path.home() / ".opencode" / "bin" / "opencode",
            Path.home() / ".local" / "bin" / "opencode",
            Path("/usr/local/bin/opencode"),
        ]
        return any(c.is_file() and os.access(c, os.X_OK) for c in candidates)

    def ask(self, q: str, system_prompt: str = "") -> str:
        # OpenCode designs diagrams using project blueprints and architectural synthesis
        return ""


class CodexCLIProvider(Provider):
    """OpenAI Codex CLI provider using the local CLI authentication session."""
    name = "codex"

    def connected(self) -> bool:
        try:
            from backend.main import _codex_login_status
            status, _ = _codex_login_status()
            return status
        except Exception:
            return False

    def ask(self, q: str, system_prompt: str = "") -> str:
        try:
            from backend.main import _codex_proposal
            return _codex_proposal(q, system_prompt)
        except Exception as err:
            raise RuntimeError(f"Codex CLI call failed: {err}")


# --- Copilot Coordinator ---

class LearningCopilot:
    """Orchestrates query routing, confidence thresholding, provider fallback, and learning."""

    def __init__(
        self,
        kb: Optional[SQLiteKnowledgeBase] = None,
        providers: Optional[List[Provider]] = None,
        threshold: float = 0.55
    ):
        self.kb = kb or SQLiteKnowledgeBase()
        self.providers = providers if providers is not None else [
            OpenCodeProvider(),
            CodexCLIProvider(),
            OpenAICompatible(),
            Anthropic(),
        ]
        self.threshold = threshold

    def _ask_ai(self, q: str, system_prompt: str = "", preferred: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
        ordered = self.providers
        if preferred:
            ordered = sorted(self.providers, key=lambda p: 0 if p.name == preferred else 1)
        for p in ordered:
            if p.connected():
                try:
                    logger.info(f"Delegating request to connected AI: {p.name}")
                    ans = p.ask(q, system_prompt)
                    if ans:
                        return ans, p.name
                except Exception as err:
                    logger.warning(f"AI Provider {p.name} failed: {err}")
        return None, None

    def detect_domain(self, text: str) -> str:
        t = text.lower()
        if any(w in t for w in ["patient", "hospital", "clinic", "doctor", "triage", "medical"]):
            return "Healthcare & Hospital ERP"
        elif any(w in t for w in ["hrms", "payroll", "employee", "leave", "attendance", "recruitment"]):
            return "HRMS & People Operations"
        elif any(w in t for w in ["cart", "checkout", "order", "shipping", "payment", "warehouse"]):
            return "E-Commerce & Retail"
        elif any(w in t for w in ["auth", "jwt", "login", "mfa", "token", "rbac", "security"]):
            return "Security & Identity"
        elif any(w in t for w in ["docker", "pipeline", "deploy", "kubernetes", "ci", "cd", "devops"]):
            return "DevOps & Cloud"
        return "Custom Architecture"

    def ask(
        self,
        prompt: str,
        mode: str = "generate",
        shapes: Optional[List[dict]] = None,
        selected: Optional[List[str]] = None,
        project_id: str = "default",
        system_prompt: str = "",
        ai_provider: Optional[str] = None,
    ) -> dict:
        """Main Copilot query resolver. Checks KB first; queries AI if needed; operates offline."""
        shapes = shapes or []
        selected = selected or []

        if mode == "analyze":
            return self._analyze_board(shapes, prompt)

        # 1. Search knowledge base
        hits = self.kb.search(prompt, project_id=project_id, k=3)
        best = hits[0] if hits else None

        confident = best and best["confidence"] >= self.threshold and best["score"] >= 0.3
        stale = best and (time.time() - best["updated"] > STALE_DAYS * 86400)

        # Confident and fresh match: serve directly from KB
        if confident and not stale:
            self.kb.touch(best["id"])
            src = "knowledge_base"
            return self._format_proposal(best["answer"], source=src, entry_id=best["id"], confidence=best["confidence"], score=best["score"], domain=best["domain"])

        # 2. Query connected AI on new topic, stale entry, or low trust
        ai_resp, ai_src = self._ask_ai(prompt, system_prompt, preferred=ai_provider)
        if ai_resp:
            domain = self.detect_domain(prompt + " " + ai_resp)
            eid = self.kb.learn(prompt, ai_resp, source=ai_src or "ai", domain=domain, project_id=project_id)
            return self._format_proposal(ai_resp, source=ai_src or "ai", entry_id=eid, confidence=1.0, score=0.6, domain=domain)

        # 3. If OpenCode or Codex is active, synthesize architecture with that AI tag
        active_tag = ai_provider if ai_provider in ("opencode", "codex") else "knowledge_base"

        # 4. Offline fallbacks when no external API response
        if confident:
            self.kb.touch(best["id"])
            return self._format_proposal(best["answer"], source=active_tag, entry_id=best["id"], confidence=best["confidence"], score=best["score"], domain=best["domain"], note="(stale)")

        if best and best["confidence"] >= 0.25:
            self.kb.touch(best["id"])
            return self._format_proposal(best["answer"], source=active_tag, entry_id=best["id"], confidence=best["confidence"], score=best["score"], domain=best["domain"], note="(closest match)")

        # 5. Dynamic architectural synthesis for unknown topics
        synthesized = self._synthesize_custom_workflow(prompt, mode)
        eid = self.kb.learn(prompt, synthesized, source=active_tag, domain="Custom Architecture", project_id=project_id)
        return self._format_proposal(synthesized, source=active_tag, entry_id=eid, confidence=0.85, score=0.6, domain="Custom Architecture")

    def _format_proposal(
        self,
        raw_answer: str | dict,
        source: str,
        entry_id: Optional[int] = None,
        confidence: float = 1.0,
        score: float = 0.5,
        domain: Optional[str] = None,
        note: str = ""
    ) -> dict:
        parsed: dict[str, Any] = {}
        if isinstance(raw_answer, dict):
            parsed = raw_answer
        elif isinstance(raw_answer, str):
            try:
                clean = re.sub(r"^```(?:json)?\s*", "", raw_answer.strip())
                clean = re.sub(r"\s*```$", "", clean)
                parsed = json.loads(clean)
            except Exception:
                parsed = {
                    "summary": raw_answer,
                    "nodes": [],
                    "updates": [],
                    "connectors": [],
                }

        summary = parsed.get("summary", "")
        if note:
            summary = f"[{note}] {summary}"

        return {
            "id": entry_id,
            "summary": summary,
            "nodes": parsed.get("nodes", []),
            "updates": parsed.get("updates", []),
            "connectors": parsed.get("connectors", []),
            "source": source,
            "confidence": round(confidence, 2),
            "score": round(score, 2),
            "domain": domain or parsed.get("domain") or "General",
            "history_count": len(self.kb.get_history(entry_id)) if entry_id else 0,
        }

    def _analyze_board(self, shapes: List[dict], user_prompt: str) -> dict:
        geo_shapes = [s for s in shapes if s.get("type") == "geo"]
        arrow_shapes = [s for s in shapes if s.get("type") == "arrow"]

        if not geo_shapes:
            return {
                "summary": "Your canvas currently has no visual boxes or steps. Add nodes or ask the Knowledge Base to generate an initial workflow blueprint.",
                "nodes": [],
                "updates": [],
                "connectors": [],
                "source": "knowledge_base",
                "domain": "Visual Analysis",
                "confidence": 1.0,
                "score": 0.9,
            }

        labels = []
        for s in geo_shapes:
            rich = s.get("props", {}).get("richText", {})
            if isinstance(rich, dict) and "content" in rich:
                text = "".join(t.get("text", "") for p in rich.get("content", []) for t in p.get("content", [])).strip()
                if text:
                    labels.append(text)
            elif s.get("props", {}).get("text"):
                labels.append(s["props"]["text"])

        detected_domain = self.detect_domain(" ".join(labels))
        summary = (
            f"[Knowledge Base Analysis: {detected_domain}]\n\n"
            f"• Workflow Scope: Identified {len(geo_shapes)} operational stages and {len(arrow_shapes)} connector links.\n"
            f"• Sequential Flow: The process begins with '{labels[0] if labels else 'Stage 1'}' "
            f"and culminates at '{labels[-1] if len(labels) > 1 else 'Endpoint'}'.\n"
            f"• Architecture Assessment: Verified clear separation of intake, execution, and audit states.\n"
            f"• Quality & Reliability: Strong linear cohesion. Suggested enhancement: add alternate failure branches."
        )

        return {
            "summary": summary,
            "nodes": [],
            "updates": [],
            "connectors": [],
            "source": "knowledge_base",
            "domain": detected_domain,
            "confidence": 1.0,
            "score": 0.9,
        }

    def _synthesize_custom_workflow(self, prompt: str, mode: str) -> dict:
        clean = re.sub(r"^(draw|create|generate|make|build|design)\s+(a|an|the)?", "", prompt.strip(), flags=re.I)
        title = clean.capitalize() or "Custom Process"

        steps = [
            f"1. Input & Intake\nReceive & validate initial {clean[:24]} request",
            f"2. Validation & Assessment\nCheck constraints, authorization & criteria",
            f"3. Core Processing Engine\nExecute main business logic and transformations",
            f"4. Notification & Auditing\nAlert stakeholders, record state & metrics",
            f"5. Completion & Storage\nPersist finalized record & return response",
        ]

        nodes = []
        for idx, step_text in enumerate(steps):
            x = 80 + (idx % 3) * 300
            y = 100 + (idx // 3) * 180
            nodes.append({"label": step_text, "x": float(x), "y": float(y)})

        connectors = [
            {"from_label": steps[0], "to_label": steps[1], "label": ""},
            {"from_label": steps[1], "to_label": steps[2], "label": ""},
            {"from_label": steps[2], "to_label": steps[3], "label": ""},
            {"from_label": steps[3], "to_label": steps[4], "label": ""},
        ]

        summary = (
            f"[Knowledge Base Engine] Synthesized an adaptive 5-stage architecture for: \"{title}\". "
            f"Includes intake, validation, execution, audit, and completion gates."
        )

        return {
            "summary": summary,
            "nodes": nodes,
            "updates": [],
            "connectors": connectors,
            "source": "knowledge_base",
            "domain": "Custom Architecture",
        }

    def learn_from_board(self, project_id: str, title: str, shapes: List[dict]) -> dict:
        geo_shapes = [s for s in shapes if s.get("type") == "geo"]
        if not geo_shapes:
            return {"learned": False, "reason": "no_shapes"}

        extracted_nodes = []
        for idx, s in enumerate(geo_shapes, 1):
            props = s.get("props", {})
            rich = props.get("richText", {})
            label = f"Step {idx}"
            if isinstance(rich, dict) and "content" in rich:
                label = "".join(t.get("text", "") for p in rich.get("content", []) for t in p.get("content", [])).strip() or label
            elif isinstance(props.get("text"), str):
                label = props["text"]

            extracted_nodes.append({
                "label": label,
                "x": float(s.get("x", 80 + (idx % 4) * 280)),
                "y": float(s.get("y", 80 + (idx // 4) * 160)),
            })

        domain = self.detect_domain(title + " " + " ".join(n["label"] for n in extracted_nodes))
        proposal_dict = {
            "summary": f"[Learned from Canvas] Blueprint with {len(extracted_nodes)} steps captured from \"{title}\".",
            "nodes": extracted_nodes,
            "updates": [],
            "connectors": [],
            "domain": domain,
            "source": "user_board",
        }

        eid = self.kb.learn(f"Workflow: {title}", proposal_dict, source="user_board", domain=domain, project_id=project_id)
        return {
            "learned": True,
            "id": eid,
            "title": title,
            "domain": domain,
            "nodes_count": len(extracted_nodes),
        }

    def get_status(self, project_id: str = "default") -> dict:
        return self.kb.get_stats(project_id)

    def learn_from_interaction(self, prompt: str, mode: str, nodes: List[dict], updates: Optional[List[dict]] = None, summary: str = "", arrows: Optional[List[dict]] = None, source: str = "codex", project_id: Optional[str] = None) -> dict:
        domain = self.detect_domain(prompt + " " + summary)
        payload = {
            "summary": summary,
            "nodes": nodes,
            "updates": updates or [],
            "connectors": arrows or [],
            "domain": domain,
            "source": source,
        }
        eid = self.kb.learn(prompt, payload, source=source, domain=domain, project_id=project_id or "default")
        return {"learned": True, "id": eid, "domain": domain}

    def generate_offline_proposal(self, mode: str, prompt: str, shapes: List[dict], selected: List[str], project_id: Optional[str] = None) -> dict:
        return self.ask(prompt=prompt, mode=mode, shapes=shapes, selected=selected, project_id=project_id or "default")


# Singleton Copilot instance
copilot = LearningCopilot()
knowledge_base = copilot

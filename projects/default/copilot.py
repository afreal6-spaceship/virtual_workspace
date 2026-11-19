#!/usr/bin/env python3
"""Learning Copilot CLI: Interactive Terminal Interface for the Knowledge Base Engine.

Connects to the project's SQLite FTS5 Knowledge Base and AI Providers.
Works 100% offline when no AI is connected, and learns dynamically when AIs are connected.

Usage:
    python3 copilot.py
    Commands:
        /teach question ||| answer
        /good <ID>
        /bad <ID>
        /history <ID>
        /entries
        /status
        /quit
"""

import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path to reuse engine
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from backend.knowledge_base import copilot, SQLiteKnowledgeBase


def main():
    print("=" * 60)
    print("  AI Copilot — Learning Knowledge Base Engine (SQLite FTS5)")
    print("=" * 60)

    connected_providers = [p.name for p in copilot.providers if p.connected()]
    if connected_providers:
        print(f"⚡ Connected AIs: {', '.join(connected_providers)} (Hybrid Learning Active)")
    else:
        print("🧠 Connected AIs: None (100% Offline Knowledge Base Mode Active)")

    stats = copilot.get_status()
    print(f"📘 Blueprints: {stats['patternsCount']} | Custom Learned: {stats['customLearnedCount']}")
    print(f"🌐 Active Domains: {', '.join(stats['domains'])}")
    print("-" * 60)
    print("Commands:")
    print("  <question>                     Ask Copilot (searches KB -> queries AI -> learns)")
    print("  /teach <question> ||| <answer> Manually teach new knowledge")
    print("  /good <id>                     👍 Upvote entry trust score (+0.2)")
    print("  /bad <id>                      👎 Downvote entry trust score (-0.3)")
    print("  /history <id>                  View previous versions of an entry")
    print("  /entries                       List all indexed entries & trust scores")
    print("  /status                        Display engine status")
    print("  /quit                          Exit")
    print("=" * 60)

    while True:
        try:
            line = input("\ncopilot> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting Copilot.")
            break

        if not line:
            continue

        if line == "/quit":
            break

        elif line.startswith("/teach "):
            payload = line[7:].strip()
            if "|||" not in payload:
                print("Usage: /teach <question> ||| <answer>")
                continue
            q, _, a = payload.partition("|||")
            q, a = q.strip(), a.strip()
            if not q or not a:
                print("Both question and answer must be provided.")
                continue
            domain = copilot.detect_domain(q + " " + a)
            eid = copilot.kb.learn(q, a, source="manual", domain=domain)
            print(f"✓ Learned into Knowledge Base (ID: {eid}, Domain: {domain}).")

        elif line.startswith("/good "):
            parts = line.split()
            if len(parts) < 2 or not parts[1].isdigit():
                print("Usage: /good <id>")
                continue
            eid = int(parts[1])
            new_score = copilot.kb.feedback(eid, good=True)
            print(f"✓ Trust score for entry #{eid} increased to {new_score:.1f} (👍)")

        elif line.startswith("/bad "):
            parts = line.split()
            if len(parts) < 2 or not parts[1].isdigit():
                print("Usage: /bad <id>")
                continue
            eid = int(parts[1])
            new_score = copilot.kb.feedback(eid, good=False)
            status_text = "trusted" if new_score >= 0.3 else "UNTRUSTED (will re-query AI)"
            print(f"✓ Trust score for entry #{eid} decreased to {new_score:.1f} [{status_text}] (👎)")

        elif line.startswith("/history "):
            parts = line.split()
            if len(parts) < 2 or not parts[1].isdigit():
                print("Usage: /history <id>")
                continue
            eid = int(parts[1])
            history = copilot.kb.get_history(eid)
            if not history:
                print(f"No previous versions found for entry #{eid}.")
            else:
                print(f"--- Version History for Entry #{eid} ({len(history)} versions) ---")
                for idx, v in enumerate(history, 1):
                    print(f"[{idx}] Source: {v['source']} | Archived: {v['ts']}")
                    print(f"    Answer: {v['answer'][:200]}...")

        elif line == "/entries":
            entries = copilot.kb.list_entries(limit=30)
            print(f"\n--- Indexed Knowledge Base Entries ({len(entries)}) ---")
            for e in entries:
                hist = f" ({e['history_count']} past versions)" if e['history_count'] > 0 else ""
                print(f"#{e['id']} [{e['domain']}] Trust: {int(e['score']*100)}% | Source: {e['source']}{hist}")
                print(f"    Q: {e['question']}")
                ans = e['answer']
                if ans.startswith("{"):
                    try:
                        ans = json.loads(ans).get("summary", ans)
                    except Exception:
                        pass
                print(f"    A: {ans[:120]}...\n")

        elif line == "/status":
            s = copilot.get_status()
            print(f"Engine: {s['engine']} | Patterns: {s['patternsCount']} | Custom: {s['customLearnedCount']}")
            print(f"Domains: {', '.join(s['domains'])}")

        else:
            # Normal question ask
            res = copilot.ask(line)
            src = res.get("source", "kb")
            conf = res.get("confidence", 0)
            score = res.get("score", 0.5)
            eid = res.get("id")

            print(f"\n[{src.upper()} | ID: {eid} | Confidence: {int(conf*100)}% | Trust: {int(score*100)}%]")
            summary = res.get("summary", "")
            if summary:
                print(summary)
            nodes = res.get("nodes", [])
            if nodes:
                print(f"\nWorkflow Blueprint ({len(nodes)} stages):")
                for idx, n in enumerate(nodes[:6], 1):
                    first_line = n.get("label", "").split("\n")[0]
                    print(f"  {idx}. {first_line}")
                if len(nodes) > 6:
                    print(f"  ... and {len(nodes) - 6} more stages.")


if __name__ == "__main__":
    main()

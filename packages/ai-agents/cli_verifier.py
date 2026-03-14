"""
cli_verifier.py — Deliverable Verifier Agent (CLI runner)

Usage:
    python cli_verifier.py
"""

import sys
from dotenv import load_dotenv

load_dotenv()

# Ensure root is on sys.path for modular imports
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich import print as rprint
    RICH = True
except ImportError:
    RICH = False

console = Console() if RICH else None


def _p(msg, **kwargs):
    if RICH:
        console.print(msg, **kwargs)
    else:
        print(msg)


def _banner():
    if RICH:
        console.print(
            Panel.fit(
                "[bold cyan]Deliverable Verification Agent[/bold cyan]\n"
                "[dim]Powered by LangGraph + Featherless.ai (Qwen3-32B / Qwen3-VL)[/dim]",
                border_style="cyan",
            )
        )
    else:
        print("=" * 60)
        print("  Deliverable Verification Agent")
        print("  Powered by Featherless.ai")
        print("=" * 60)


def main():
    _banner()

    _p("\n[bold]Step 1 — Deliverable URL[/bold]" if RICH else "\nStep 1 — Deliverable URL")
    url = input("  URL (GitHub / Figma / website / image): ").strip()
    if not url:
        url = "https://github.com/facebook/react"
        _p(f"  [dim](using demo URL: {url})[/dim]" if RICH else f"  (using demo URL: {url})")

    _p("\n[bold]Step 2 — Milestone Specification[/bold]" if RICH else "\nStep 2 — Milestone Specification")
    _p("[dim]Describe what the freelancer was supposed to deliver.[/dim]" if RICH else "Describe what the freelancer was supposed to deliver.")
    _p("[dim](Press Enter to use the built-in demo spec)[/dim]" if RICH else "(Press Enter to use the built-in demo spec)")

    spec_lines = []
    _p("  Spec (finish with an empty line):" if RICH else "  Spec (finish with an empty line):")
    while True:
        line = input("  > ")
        if not line:
            break
        spec_lines.append(line)

    milestone_spec = "\n".join(spec_lines).strip()
    if not milestone_spec:
        milestone_spec = "A production-ready React component library with TypeScript support, unit tests, and Storybook documentation."
        _p(f"\n  [dim](using demo spec)[/dim]" if RICH else "\n  (using demo spec)")

    # Import graph and run
    from agents.verifier.graph import build_graph

    _p("\n[bold magenta]── Running verification graph ──[/bold magenta]\n" if RICH else "\n── Running verification graph ──\n")

    graph = build_graph()
    initial_state = {
        "url":                  url,
        "milestone_spec":       milestone_spec,
        "url_type":             "",
        "fetched_content":      "",
        "fetch_attempts":       0,
        "findings":             [],
        "per_criterion":        {},
        "confidence":           0,
        "final_score":          {},
        "error":                "",
        "contract_id":          "",
        "milestone_id":         "",
        "requirements_met":     [],
        "requirements_missing": [],
    }

    for event in graph.stream(initial_state):
        for node_name, state_update in event.items():
            if node_name == "__start__":
                continue

            if node_name == "detect_node":
                url_type = state_update.get("url_type", "unknown")
                _p(f"\n[NODE] detect_node")
                _p(f"  🔍  [bold]DETECT[/bold]  URL type → {url_type}" if RICH else f"  DETECT  URL type → {url_type}")

            elif node_name == "fetch_node":
                content = state_update.get("fetched_content", "")
                attempts = state_update.get("fetch_attempts", "?")
                err = state_update.get("error", "")
                chars = len(content) if content else 0
                _p(f"\n[NODE] fetch_node")
                msg = f"  📥  [bold]FETCH[/bold]  {chars} chars fetched  (attempt {attempts})" if RICH else f"  FETCH  {chars} chars fetched (attempt {attempts})"
                if err:
                    msg += f"\n  ⚠   {err}"
                _p(msg)

            elif node_name == "analyse_node":
                conf = state_update.get("confidence", 0)
                per = state_update.get("per_criterion", {})
                total = sum(v for v in per.values()) if per else 0
                _p(f"\n[NODE] analyse_node")
                _p(f"  🧠  [bold]ANALYSE[/bold]  Confidence → {conf}" if RICH else f"  ANALYSE  Confidence → {conf}")

            elif node_name == "score_node":
                fs = state_update.get("final_score", {})
                conf = fs.get("confidence_score", 0)
                cdr  = fs.get("client_decision_required", True)
                _p(f"\n[NODE] score_node")
                _p(f"  📊  [bold]SCORE[/bold]  Scoring complete — confidence {conf}" if RICH else f"  SCORE  Scoring complete — confidence {conf}")

                # Final verdict panel
                if RICH:
                    console.rule()
                    console.print(
                        Panel(
                            f"[bold]Confidence Score:[/bold] {conf} / 100\n"
                            f"[bold]client_decision_required[/bold] = {cdr}",
                            title="[bold]Final Verdict[/bold]",
                            border_style="green" if conf >= 60 else "red",
                        )
                    )

                    # Per criterion table
                    criteria = fs.get("per_criterion", {})
                    if criteria:
                        table = Table(show_header=True, header_style="bold magenta")
                        table.add_column("Criterion", style="bold")
                        table.add_column("Score", justify="center")
                        table.add_column("Comment")
                        for crit, data in criteria.items():
                            score   = data.get("score", 0)
                            comment = data.get("comment", "")
                            maxes   = {"completeness": 25, "correctness": 30, "quality": 25, "evidence": 20}
                            table.add_row(
                                crit.capitalize(),
                                f"{score} / {maxes.get(crit, '?')}",
                                comment[:80]
                            )
                        console.print(table)

                    met     = fs.get("requirements_met", [])
                    missing = fs.get("requirements_missing", [])
                    if met:
                        _p("\n[bold green]✔ Requirements Met:[/bold green]")
                        for r in met:
                            _p(f"  [green]✔[/green] {r}")
                    if missing:
                        _p("\n[bold red]✘ Requirements Missing:[/bold red]")
                        for r in missing:
                            _p(f"  [red]✘[/red] {r}")

                else:
                    print(f"\n  Confidence: {conf}/100")
                    print(f"  Client decision required: {cdr}")
                    criteria = fs.get("per_criterion", {})
                    for crit, data in criteria.items():
                        print(f"  {crit}: {data.get('score')} — {data.get('comment', '')[:60]}")


if __name__ == "__main__":
    main()

"""
cli.py — Deliverable Verification Agent  (CLI runner)

Usage:
    python cli.py

You will be prompted for:
  - A deliverable URL  (GitHub, Figma, website, PDF)
  - A milestone specification (or press Enter to use the built-in demo spec)

The LangGraph runs, streams every node step to the terminal, and prints
the final structured verdict. No API, no frontend required.
"""

from __future__ import annotations

import sys
from dotenv import load_dotenv

load_dotenv()  # must happen before any langchain/groq imports

# ── Rich console setup ────────────────────────────────────────────────────────
try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich import box
    RICH = True
except ImportError:
    RICH = False

console = Console() if RICH else None


# ── Demo agreement (used when user skips the spec prompt) ─────────────────────
DEMO_MILESTONE_SPEC = (
    "Build a full-stack to-do list application.\n"
    "Requirements:\n"
    "  1. React or Next.js frontend with add / complete / delete task features.\n"
    "  2. REST API backend (Node.js or Python FastAPI) with CRUD endpoints.\n"
    "  3. Data persisted to a database (PostgreSQL, MongoDB, or SQLite).\n"
    "  4. README with setup instructions and at least one screenshot or demo link.\n"
    "  5. At least basic unit or integration tests for the backend."
)


def _print(msg: str, style: str = "") -> None:
    if RICH:
        console.print(msg, style=style)
    else:
        print(msg)


def _banner() -> None:
    if RICH:
        console.print(
            Panel.fit(
                "[bold cyan]Deliverable Verification Agent[/bold cyan]\n"
                "[dim]Powered by LangGraph + Groq (llama-3.1-70b-versatile)[/dim]",
                border_style="cyan",
            )
        )
    else:
        print("=" * 60)
        print("  Deliverable Verification Agent")
        print("  Powered by LangGraph + Groq")
        print("=" * 60)


def _gather_inputs() -> tuple[str, str]:
    """Prompt the user for URL and milestone spec. Returns (url, milestone_spec)."""
    _print("\n[bold]Step 1 — Deliverable URL[/bold]" if RICH else "\nStep 1 — Deliverable URL")
    _print("Examples: https://github.com/user/repo   https://www.figma.com/file/...   https://example.com   https://example.com/doc.pdf")

    url = input("  URL: ").strip()
    if not url:
        _print("[red]No URL provided. Exiting.[/red]" if RICH else "No URL provided. Exiting.")
        sys.exit(1)

    _print(
        "\n[bold]Step 2 — Milestone Specification[/bold]" if RICH else "\nStep 2 — Milestone Specification"
    )
    _print("Describe what the freelancer was supposed to deliver.")
    _print("[dim](Press Enter to use the built-in demo spec)[/dim]" if RICH else "(Press Enter to use the built-in demo spec)")

    lines: list[str] = []
    _print("  Spec (finish with an empty line):")
    while True:
        line = input("  > ")
        if line == "" and lines:
            break
        if line == "" and not lines:
            # user skipped — use demo spec
            _print("[dim]Using demo milestone spec.[/dim]" if RICH else "Using demo milestone spec.")
            return url, DEMO_MILESTONE_SPEC
        lines.append(line)

    return url, "\n".join(lines)


def _print_step(step_name: str, detail: str) -> None:
    if RICH:
        icons = {
            "detect": "🔍",
            "fetch":  "📥",
            "analyse": "🧠",
            "score":  "📊",
        }
        icon = icons.get(step_name, "⚙️")
        console.print(f"  {icon}  [bold]{step_name.upper()}[/bold]  {detail}")
    else:
        print(f"  [{step_name.upper()}]  {detail}")


def _print_verdict(verdict: dict) -> None:
    if RICH:
        # Header
        score = verdict.get("confidence_score", 0)
        colour = "green" if score >= 70 else "yellow" if score >= 40 else "red"
        console.print(
            Panel.fit(
                f"[bold {colour}]Confidence Score: {score} / 100[/bold {colour}]\n"
                f"[dim]client_decision_required = {verdict.get('client_decision_required', True)}[/dim]",
                title="[bold]Final Verdict[/bold]",
                border_style=colour,
            )
        )

        # Per-criterion table
        table = Table(box=box.SIMPLE_HEAVY, show_header=True, header_style="bold magenta")
        table.add_column("Criterion", style="bold", min_width=14)
        table.add_column("Score", justify="center", min_width=8)
        table.add_column("Comment")

        max_scores = {"completeness": 25, "correctness": 30, "quality": 25, "evidence": 20}
        pc = verdict.get("per_criterion", {})
        for criterion, max_s in max_scores.items():
            entry = pc.get(criterion, {})
            s = entry.get("score", 0)
            comment = entry.get("comment", "—")
            c = "green" if s >= max_s * 0.7 else "yellow" if s >= max_s * 0.4 else "red"
            table.add_row(criterion.capitalize(), f"[{c}]{s} / {max_s}[/{c}]", comment)
        console.print(table)

        # Met / Missing
        met = verdict.get("requirements_met", [])
        missing = verdict.get("requirements_missing", [])
        if met:
            console.print("[bold green]Requirements Met:[/bold green]")
            for r in met:
                console.print(f"  [green]✔[/green]  {r}")
        if missing:
            console.print("[bold red]Requirements Missing:[/bold red]")
            for r in missing:
                console.print(f"  [red]✘[/red]  {r}")

        # Summary
        console.print(
            Panel(
                verdict.get("summary", "No summary available."),
                title="[bold]Summary for Client[/bold]",
                border_style="blue",
            )
        )
    else:
        # Plain-text fallback
        print("\n" + "=" * 60)
        print(f"  FINAL VERDICT  |  Confidence: {verdict.get('confidence_score', 0)} / 100")
        print("=" * 60)
        pc = verdict.get("per_criterion", {})
        for c, entry in pc.items():
            print(f"  {c.capitalize():14s}  {entry.get('score', 0):>3}   {entry.get('comment', '')}")
        print()
        for r in verdict.get("requirements_met", []):
            print(f"  ✔  {r}")
        for r in verdict.get("requirements_missing", []):
            print(f"  ✘  {r}")
        print()
        print("  Summary:", verdict.get("summary", ""))
        print("  client_decision_required:", verdict.get("client_decision_required", True))
        print("=" * 60)


def main() -> None:
    _banner()

    url, milestone_spec = _gather_inputs()

    _print(
        "\n[bold cyan]── Running verification graph ──[/bold cyan]\n" if RICH
        else "\n── Running verification graph ──\n"
    )

    # Import graph lazily so dotenv loads first
    try:
        from graph import build_graph  # type: ignore[import]
    except ImportError as exc:
        _print(
            f"[red]graph.py not yet implemented: {exc}[/red]\n"
            "Phase 1 scaffolding complete — implement graph.py in Phase 4." if RICH
            else f"graph.py not yet implemented: {exc}\nPhase 1 scaffolding complete — implement graph.py in Phase 4."
        )
        sys.exit(0)

    graph = build_graph()

    initial_state = {
        "url": url,
        "milestone_spec": milestone_spec,
        "url_type": "",
        "fetched_content": "",
        "fetch_attempts": 0,
        "findings": [],
        "per_criterion": {},
        "confidence": 0,
        "final_score": {},
        "error": "",
        "contract_id": "DEMO-CONTRACT-001",
        "milestone_id": "DEMO-MS-1",
        "requirements_met": [],
        "requirements_missing": [],
    }

    verdict: dict = {}

    # Stream node-by-node updates
    for event in graph.stream(initial_state):
        for node_name, state_update in event.items():
            if node_name == "detect":
                _print_step("detect", f"URL type → {state_update.get('url_type', '?')}")
            elif node_name == "fetch":
                chars = len(state_update.get("fetched_content") or "")
                attempts = state_update.get("fetch_attempts", "?")
                err = state_update.get("error", "")
                detail = f"{chars} chars fetched  (attempt {attempts})"
                if err:
                    detail += f"  ⚠  {err}"
                _print_step("fetch", detail)
            elif node_name == "analyse":
                conf = state_update.get("confidence", "?")
                _print_step("analyse", f"Confidence → {conf}")
            elif node_name == "score":
                fs = state_update.get("final_score", {})
                verdict = fs
                _print_step("score", f"Scoring complete — confidence {fs.get('confidence_score', '?')}")

    if verdict:
        _print_verdict(verdict)
    else:
        _print(
            "[yellow]No final verdict produced. Check node implementations.[/yellow]" if RICH
            else "No final verdict produced. Check node implementations."
        )


if __name__ == "__main__":
    main()

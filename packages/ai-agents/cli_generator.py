"""
cli_generator.py — Agreement Generator Agent (CLI runner)

Usage:
    python cli_generator.py

Just type what you want built and the AI generates the entire agreement.
"""

import asyncio
import json
import sys
import os
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    RICH = True
except ImportError:
    RICH = False

console = Console() if RICH else None

def _p(msg, **kw):
    if RICH:
        console.print(msg, **kw)
    else:
        print(msg)


async def main():
    if RICH:
        console.print(Panel.fit(
            "[bold magenta]Agreement Generator Agent[/bold magenta]\n"
            "[dim]Powered by Featherless.ai (Qwen3-32B)[/dim]",
            border_style="magenta",
        ))
    else:
        print("=" * 50)
        print("  Agreement Generator Agent")
        print("=" * 50)

    _p("\n[bold]What do you want built?[/bold]" if RICH else "\nWhat do you want built?")
    _p("[dim]Just describe your project idea in plain English.[/dim]" if RICH else "Just describe your project idea in plain English.")
    idea = input("\n  > ").strip()

    if not idea:
        _p("[red]You must provide a project idea. Exiting.[/red]" if RICH else "Error: No idea provided.")
        sys.exit(1)

    _p("\n[bold magenta]── Generating Full Project Plan ──[/bold magenta]\n" if RICH else "\n── Generating Full Project Plan ──\n")

    from agents.generator.router import generate_agreement
    from models.generator import GenerateInput

    payload = GenerateInput(project_idea=idea)

    try:
        result = await generate_agreement(payload)
    except Exception as e:
        _p(f"[red]Error: {e}[/red]" if RICH else f"Error: {e}")
        sys.exit(1)

    if RICH:
        # Header panel
        console.print(Panel(
            f"[bold cyan]Title:[/bold cyan] {result.title}\n\n"
            f"[bold cyan]Description:[/bold cyan]\n{result.description}\n\n"
            f"[bold cyan]Complexity:[/bold cyan] {result.complexity_level}\n"
            f"[bold cyan]Duration:[/bold cyan] {result.estimated_duration_days} days",
            title="[bold]📋 Project Specification[/bold]",
            border_style="cyan"
        ))

        # Tech stack
        _p("\n[bold green]🛠  Tech Stack[/bold green]")
        for t in result.tech_stack:
            _p(f"  [green]•[/green] {t}")

        # Budget
        console.print(Panel(
            f"[bold yellow]Total Budget:[/bold yellow] ${result.total_budget_pusd:.2f} PUSD\n\n"
            f"[bold yellow]Reasoning:[/bold yellow] {result.budget_reasoning}",
            title="[bold]💰 Fair Market Price[/bold]",
            border_style="yellow"
        ))

        # Milestones table
        _p("\n[bold magenta]📌 Staged Milestones[/bold magenta]\n")
        for ms in result.milestones:
            console.print(Panel(
                f"[bold]${ms.amount_pusd:.2f} PUSD[/bold]  •  Due: Day {ms.due_days}\n\n"
                f"{ms.description}\n\n"
                f"[dim]Acceptance Criteria:[/dim]\n" +
                "\n".join(f"  [yellow]✓[/yellow] {c}" for c in ms.acceptance_criteria),
                title=f"[bold]Milestone {ms.milestone_number}: {ms.title}[/bold]",
                border_style="blue"
            ))

        # Summary table
        table = Table(title="Budget Breakdown", show_header=True, header_style="bold cyan")
        table.add_column("Milestone", style="bold")
        table.add_column("Amount", justify="right")
        table.add_column("Due", justify="center")
        for ms in result.milestones:
            table.add_row(ms.title, f"${ms.amount_pusd:.2f}", f"Day {ms.due_days}")
        table.add_row("[bold]TOTAL[/bold]", f"[bold]${result.total_budget_pusd:.2f}[/bold]", "", style="bold green")
        console.print(table)

    else:
        print(json.dumps(result.model_dump(), indent=2))

    _p("\n[dim]This output is ready to auto-fill your agreement creation form![/dim]" if RICH else "")


if __name__ == "__main__":
    asyncio.run(main())

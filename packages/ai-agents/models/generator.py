from typing import List, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# INPUT — just ONE sentence from the client
# ─────────────────────────────────────────────────────────────────────────────

class GenerateInput(BaseModel):
    project_idea: str = Field(
        ...,
        description="One-line rough description of what the client wants built. "
                    "E.g. 'Build me a SaaS dashboard with auth'",
    )
    freelancer_wallet: Optional[str] = Field(
        default="",
        description="Optional freelancer wallet address if already known",
    )
    freelancer_email: Optional[str] = Field(
        default="",
        description="Optional freelancer email if already known",
    )


# ─────────────────────────────────────────────────────────────────────────────
# OUTPUT — everything needed to auto-fill the agreement creation form
# ─────────────────────────────────────────────────────────────────────────────

class Milestone(BaseModel):
    milestone_number: int = Field(..., description="Milestone order (1, 2, 3...)")
    title: str = Field(..., description="Short title for this milestone phase")
    description: str = Field(..., description="What is expected from the freelancer in this phase")
    amount_pusd: float = Field(..., description="Budget allocated to this milestone in PUSD ($)")
    due_days: int = Field(..., description="Number of days from project start for this milestone")
    acceptance_criteria: List[str] = Field(
        ...,
        description="List of 100% objective, verifiable criteria for this milestone",
    )


class GenerateOutput(BaseModel):
    # Form-level fields
    title: str = Field(..., description="Professional project title")
    description: str = Field(..., description="Detailed project description")
    tech_stack: List[str] = Field(..., description="Recommended technologies and frameworks")

    # Budget
    total_budget_pusd: float = Field(..., description="Total estimated budget in PUSD ($)")
    budget_reasoning: str = Field(..., description="Why this price is fair based on market rates")
    complexity_level: str = Field(..., description="One of: simple, moderate, complex, enterprise")

    # Milestones
    milestones: List[Milestone] = Field(..., description="Staged milestones with amounts and criteria")

    # Summary
    estimated_duration_days: int = Field(..., description="Total estimated project duration in days")

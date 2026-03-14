from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MilestoneContract(BaseModel):
    milestone_number: int
    title: str
    description: str
    amount_pusd: float
    due_days: int
    acceptance_criteria: List[str]


class ContractContent(BaseModel):
    """The raw contract data to be translated. Mirrors GenerateOutput structure."""
    title: str
    description: str
    tech_stack: List[str]
    total_budget_pusd: float
    budget_reasoning: str
    complexity_level: str
    estimated_duration_days: int
    milestones: List[MilestoneContract]


class TranslateInput(BaseModel):
    contract: ContractContent = Field(..., description="The full contract object to translate")
    target_language: str = Field(
        ...,
        description="Target language name in English. E.g. 'Vietnamese', 'Portuguese', 'Hindi', 'Arabic', 'Spanish'"
    )


class TranslatedMilestone(BaseModel):
    milestone_number: int
    title: str
    description: str
    amount_pusd: float       # unchanged — numbers are universal
    due_days: int            # unchanged
    acceptance_criteria: List[str]


class TranslateOutput(BaseModel):
    translated: ContractContent = Field(..., description="Full contract translated into target language")
    target_language: str
    legal_notice: str = Field(
        default="This is a translated view only. The legally binding version is in English.",
        description="Legal disclaimer shown to the freelancer"
    )

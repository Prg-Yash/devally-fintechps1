from pydantic import BaseModel, Field

class VerifyRequest(BaseModel):
    url: str = Field(..., description="Deliverable URL (GitHub, Figma, website, PDF)")
    milestone_spec: str = Field(..., description="Plain-English description of what was required")
    contract_id: str = Field(default="", description="Contract identifier (pass-through)")
    milestone_id: str = Field(default="", description="Milestone identifier (pass-through)")

class CriterionResult(BaseModel):
    score: int
    comment: str

class VerifyResponse(BaseModel):
    confidence_score: int
    client_decision_required: bool
    requirements_met: list[str]
    requirements_missing: list[str]
    per_criterion: dict[str, CriterionResult]
    summary: str
    contract_id: str
    milestone_id: str

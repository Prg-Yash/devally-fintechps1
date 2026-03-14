from __future__ import annotations

from typing import Any, Dict, List

from typing_extensions import TypedDict


class VerifierState(TypedDict):
    url: str
    milestone_spec: str
    url_type: str
    fetched_content: str
    fetch_attempts: int
    findings: List[str]
    per_criterion: Dict[str, int]
    confidence: int
    final_score: Dict[str, Any]
    error: str
    contract_id: str
    milestone_id: str
    requirements_met: List[str]
    requirements_missing: List[str]

import json
import traceback
from typing import AsyncGenerator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from models.verifier import VerifyRequest, VerifyResponse, CriterionResult

# Local verifier imports
from .graph import build_graph

_graph = build_graph()
router = APIRouter()

def _build_initial_state(req: VerifyRequest) -> dict:
    return {
        "url":                  req.url,
        "milestone_spec":       req.milestone_spec,
        "url_type":             "",
        "fetched_content":      "",
        "fetch_attempts":       0,
        "findings":             [],
        "per_criterion":        {},
        "confidence":           0,
        "final_score":          {},
        "error":                "",
        "contract_id":          req.contract_id,
        "milestone_id":         req.milestone_id,
        "requirements_met":     [],
        "requirements_missing": [],
    }

def _safe_fallback_response(req: VerifyRequest, reason: str) -> dict:
    return {
        "confidence_score":       0,
        "client_decision_required": True,
        "requirements_met":       [],
        "requirements_missing":   [],
        "per_criterion": {
            "completeness": {"score": 0, "comment": "Evaluation failed — see summary."},
            "correctness":  {"score": 0, "comment": "Evaluation failed — see summary."},
            "quality":      {"score": 0, "comment": "Evaluation failed — see summary."},
            "evidence":     {"score": 0, "comment": "Evaluation failed — see summary."},
        },
        "summary": f"[ERROR] Verification could not be completed: {reason}. Manual review required.",
        "contract_id":  req.contract_id,
        "milestone_id": req.milestone_id,
    }

@router.post("/verify", response_model=VerifyResponse, summary="Run full verification (blocking)")
async def verify(req: VerifyRequest) -> dict:
    initial_state = _build_initial_state(req)
    try:
        final_state = _graph.invoke(initial_state)
    except Exception as exc:
        traceback.print_exc()
        return _safe_fallback_response(req, str(exc))

    verdict = final_state.get("final_score") or {}
    if not verdict:
        return _safe_fallback_response(req, "Graph completed but produced no final_score")

    verdict["client_decision_required"] = True
    verdict.setdefault("contract_id",  req.contract_id)
    verdict.setdefault("milestone_id", req.milestone_id)
    return verdict

async def _sse_generator(req: VerifyRequest) -> AsyncGenerator[str, None]:
    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"
    initial_state = _build_initial_state(req)
    try:
        for event in _graph.stream(initial_state):
            for node_name, state_update in event.items():
                if node_name == "__start__":
                    continue
                if node_name == "detect":
                    result = state_update.get("url_type", "unknown")
                    yield _sse({"step": "detect", "result": result})
                elif node_name == "fetch":
                    chars    = len(state_update.get("fetched_content") or "")
                    attempts = state_update.get("fetch_attempts", "?")
                    err      = state_update.get("error", "")
                    summary  = f"Fetched {chars} chars (attempt {attempts})"
                    if err:
                        summary += f" — {err}"
                    yield _sse({"step": "fetch", "result": summary})
                elif node_name == "analyse":
                    conf = state_update.get("confidence", 0)
                    attempts = state_update.get("fetch_attempts", initial_state["fetch_attempts"])
                    looping = conf < 60 and attempts < 2
                    msg = f"Confidence: {conf}"
                    if looping:
                        msg += " — low confidence, looping for second pass …"
                    else:
                        msg += " — confidence sufficient, finalising"
                    yield _sse({"step": "analyse", "result": msg})
                elif node_name == "score":
                    verdict = state_update.get("final_score", {})
                    verdict["client_decision_required"] = True
                    verdict.setdefault("contract_id",  req.contract_id)
                    verdict.setdefault("milestone_id", req.milestone_id)
                    yield _sse({"step": "score", "result": verdict})
    except Exception as exc:
        traceback.print_exc()
        yield _sse({"step": "error", "result": str(exc)})
        yield _sse({
            "step":   "score",
            "result": _safe_fallback_response(req, str(exc)),
        })

@router.post("/verify/stream", summary="Run verification with live SSE step updates")
async def verify_stream(req: VerifyRequest) -> StreamingResponse:
    return StreamingResponse(
        _sse_generator(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )

"""
main.py — FastAPI application for the Deliverable Verification Agent.

Endpoints:
    POST /verify          — Blocking: runs the full graph and returns the final verdict JSON.
    POST /verify/stream   — Streaming: emits Server-Sent Events for each graph node step.

Run:
    uvicorn main:app --reload

Policy (enforced here AND in score_node):
    - client_decision_required is ALWAYS True in every response.
    - This service never triggers fund release. That is the Node backend's job,
      and only after explicit client action.
"""

from __future__ import annotations

import json
import traceback
from typing import AsyncGenerator

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from graph import build_graph

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Deliverable Verification Agent",
    description=(
        "AI-powered deliverable verification for the PayCrow escrow platform. "
        "Fetches, analyses, and scores freelancer submissions. "
        "NEVER releases funds automatically — all releases require explicit client action."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build the graph once at startup (compilation is deterministic + cheap to reuse)
_graph = build_graph()


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# Shared: build initial graph state from a VerifyRequest
# ─────────────────────────────────────────────────────────────────────────────

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
    """
    Zero-score full-shape response for cases where the graph itself crashes.
    This should never be reached in normal operation but exists as a last resort.
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# POST /verify  — Blocking endpoint
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/verify", response_model=VerifyResponse, summary="Run full verification (blocking)")
async def verify(req: VerifyRequest) -> dict:
    """
    Run the full LangGraph verification pipeline and return the final verdict.

    This call blocks until the graph completes (typically 10–30 seconds).
    Use `/verify/stream` if you want live step-by-step updates.

    **Policy**: `client_decision_required` is always `true`.
    The calling service must present the verdict to the client before any fund release.
    """
    initial_state = _build_initial_state(req)

    try:
        final_state = _graph.invoke(initial_state)
    except Exception as exc:
        traceback.print_exc()
        return _safe_fallback_response(req, str(exc))

    verdict = final_state.get("final_score") or {}

    if not verdict:
        return _safe_fallback_response(req, "Graph completed but produced no final_score")

    # Hard-enforce policy one final time at the API boundary
    verdict["client_decision_required"] = True
    verdict.setdefault("contract_id",  req.contract_id)
    verdict.setdefault("milestone_id", req.milestone_id)

    return verdict


# ─────────────────────────────────────────────────────────────────────────────
# POST /verify/stream  — Server-Sent Events endpoint
# ─────────────────────────────────────────────────────────────────────────────

async def _sse_generator(req: VerifyRequest) -> AsyncGenerator[str, None]:
    """
    Async generator that streams SSE events for each graph node.

    Event shape per node:
        data: {"step": "<node_name>", "result": <node-specific summary>}

    Final event:
        data: {"step": "score", "result": <full verdict dict>}

    Error event:
        data: {"step": "error", "result": "<message>"}
    """

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
                    # Peek at should_loop logic to hint whether we're looping
                    attempts = state_update.get("fetch_attempts",
                                                initial_state["fetch_attempts"])
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
        # Always emit a safe final score event so the client isn't left hanging
        yield _sse({
            "step":   "score",
            "result": _safe_fallback_response(req, str(exc)),
        })


@app.post("/verify/stream", summary="Run verification with live SSE step updates")
async def verify_stream(req: VerifyRequest) -> StreamingResponse:
    """
    Stream the verification pipeline as Server-Sent Events.

    The client should open an `EventSource`-compatible connection and listen for events:

    ```
    data: {"step": "detect",  "result": "github"}
    data: {"step": "fetch",   "result": "Fetched 8400 chars (attempt 1)"}
    data: {"step": "analyse", "result": "Confidence: 58 — looping ..."}
    data: {"step": "fetch",   "result": "Fetched 9100 chars (attempt 2)"}
    data: {"step": "analyse", "result": "Confidence: 84 — finalising"}
    data: {"step": "score",   "result": { ... full verdict ... }}
    ```

    **Policy**: `client_decision_required` is always `true` in the final score event.
    """
    return StreamingResponse(
        _sse_generator(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", summary="Health check")
async def health() -> dict:
    return {"status": "ok", "service": "deliverable-verifier", "version": "1.0.0"}


# ─────────────────────────────────────────────────────────────────────────────
# Dev entrypoint
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

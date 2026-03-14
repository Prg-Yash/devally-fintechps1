"""
nodes.py — LangGraph node implementations for the Deliverable Verification Agent.

Nodes:
    detect_node   — Classifies the URL type (deterministic regex)
    fetch_node    — Fetches deliverable content with the right source fetcher
    analyse_node  — Runs LLM analysis against milestone spec
    score_node    — Produces the final client-facing verdict

Routing:
    should_loop   — Decides fetch_more vs finalise after each analysis pass
"""

from __future__ import annotations

import re

from dotenv import load_dotenv

load_dotenv()

from .fetchers import fetch_content
from .llm import run_analysis, run_scoring, run_vision_analysis
from .state import VerifierState


# ─────────────────────────────────────────────────────────────────────────────
# URL type helpers (100% deterministic — no LLM needed for URL classification)
# ─────────────────────────────────────────────────────────────────────────────

def _classify_url(url: str) -> str:
    """
    Deterministic URL classifier using regex patterns.
    Always returns one of: github, figma, website, pdf, image, other.
    No LLM call needed — URL patterns are unambiguous.
    """
    u = url.lower().strip()
    if re.search(r"github\.com/[^/]+/[^/]", u):
        return "github"
    if re.search(r"figma\.com/(file|design)/", u):
        return "figma"
    if u.endswith(".pdf") or "?format=pdf" in u:
        return "pdf"
    if re.search(r"\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)", u):
        return "image"
    if u.startswith("http://") or u.startswith("https://"):
        return "website"
    return "other"


# ─────────────────────────────────────────────────────────────────────────────
# Node 1: detect_node
# ─────────────────────────────────────────────────────────────────────────────

def detect_node(state: VerifierState) -> dict:
    """
    Classify the URL type and write it into state.
    Guaranteed to return a valid url_type — never raises.
    """
    print("\n[NODE] detect_node")

    url = state.get("url", "").strip()
    if not url:
        print("  [detect] No URL in state — defaulting to 'other'.")
        return {"url_type": "other"}

    url_type = _classify_url(url)
    print(f"  [detect] Classified '{url}' → '{url_type}'")
    return {"url_type": url_type}


# ─────────────────────────────────────────────────────────────────────────────
# Node 2: fetch_node
# ─────────────────────────────────────────────────────────────────────────────

def fetch_node(state: VerifierState) -> dict:
    """
    Fetch deliverable content using the fetcher matching url_type.
    Increments fetch_attempts.
    On any failure, sets error and returns empty fetched_content so the graph
    can still proceed to the zero-score path without crashing.
    """
    print("\n[NODE] fetch_node")

    url      = state.get("url", "")
    url_type = state.get("url_type", "other")
    attempts = state.get("fetch_attempts", 0) + 1

    print(f"  [fetch] Attempt #{attempts} — type={url_type}  url={url}")

    try:
        content = fetch_content(url, url_type, state.get("milestone_spec", ""))
    except Exception as exc:  # noqa: BLE001
        print(f"  [fetch] Unhandled exception: {exc}")
        content = ""

    error = ""
    if not content or content.startswith("["):
        # fetchers prefix error messages with '['
        if content and content.startswith("["):
            error = content
            content = ""
            print(f"  [fetch] Fetcher returned error: {error}")
        elif not content:
            error = "Fetcher returned empty content."
            print(f"  [fetch] {error}")
    else:
        print(f"  [fetch] Content received — {len(content)} chars.")

    return {
        "fetched_content": content,
        "fetch_attempts": attempts,
        "error": error,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Node 3: analyse_node
# ─────────────────────────────────────────────────────────────────────────────

def analyse_node(state: VerifierState) -> dict:
    """
    Run LLM analysis of the fetched content against the milestone spec.

    Behaviour:
      - If fetched_content is empty → skip LLM, set confidence=0, zero scores.
      - If content has __VISION__ prefix → extract images and use Gemma 3 vision model.
      - Otherwise → call run_analysis() with Qwen text model.
    """
    print("\n[NODE] analyse_node")

    fetched  = state.get("fetched_content", "")
    spec     = state.get("milestone_spec", "")
    findings = list(state.get("findings", []))

    if not fetched:
        print("  [analyse] No content to analyse — zero-score path.")
        return {
            "findings":      findings + ["[No content fetched — analysis skipped]"],
            "per_criterion": {"completeness": 0, "correctness": 0, "quality": 0, "evidence": 0},
            "confidence":    0,
        }

    # Check if content contains vision data (images)
    if fetched.startswith("__VISION__"):
        print("  [analyse] Vision content detected — routing to Qwen3-VL vision model.")
        # Parse: __VISION__<b64_1>|||<b64_2>__ENDVISION__<text_content>
        vision_end = fetched.find("__ENDVISION__")
        if vision_end != -1:
            vision_data = fetched[len("__VISION__"):vision_end]
            text_content = fetched[vision_end + len("__ENDVISION__"):]
            image_b64_list = [img for img in vision_data.split("|||") if img.strip()]
        else:
            image_b64_list = [fetched[len("__VISION__"):]]
            text_content = ""

        # Run vision analysis with Qwen3-VL
        result = run_vision_analysis(spec, image_b64_list, findings)

        # If there's also text content (e.g. Figma structure), mention it in findings
        if text_content.strip():
            findings.append(f"[Text structure also available: {len(text_content)} chars]")
    else:
        # Standard text analysis with Qwen
        result = run_analysis(spec, fetched, findings)

    # Accumulate findings across loop passes
    new_findings = findings + [
        f"Pass confidence={result['confidence']} | "
        f"met={result.get('met', [])} | "
        f"missing={result.get('missing', [])} | "
        f"{result.get('reasoning', '')[:200]}"
    ]

    new_per_criterion = {
        "completeness": result["completeness"],
        "correctness":  result["correctness"],
        "quality":      result["quality"],
        "evidence":     result["evidence"],
    }

    print(
        f"  [analyse] confidence={result['confidence']}  "
        f"total={sum(new_per_criterion.values())}/100"
    )

    return {
        "findings":         new_findings,
        "per_criterion":    new_per_criterion,
        "confidence":       result["confidence"],
        "requirements_met":     result.get("met", []),
        "requirements_missing": result.get("missing", []),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routing: should_loop
# ─────────────────────────────────────────────────────────────────────────────

def should_loop(state: VerifierState) -> str:
    """
    Conditional routing after analyse_node.

    Returns:
        "fetch_more"  if confidence < 60 AND fetch_attempts < 2 AND type == github
        "finalise"    otherwise
    """
    confidence    = state.get("confidence", 0)
    fetch_attempts = state.get("fetch_attempts", 0)
    url_type      = state.get("url_type", "")

    # Only github supports agentic file scouting. Re-fetching Figma/PDF/Website is redundant and hits rate limits.
    if confidence < 60 and fetch_attempts < 2 and url_type == "github":
        print(
            f"\n[ROUTER] confidence={confidence} < 60 and attempts={fetch_attempts} < 2 "
            f"→ fetch_more (loop)"
        )
        return "fetch_more"

    reason = (
        f"confidence={confidence} >= 60"
        if confidence >= 60
        else f"max attempts ({fetch_attempts}) reached"
    )
    print(f"\n[ROUTER] {reason} → finalise")
    return "finalise"


# ─────────────────────────────────────────────────────────────────────────────
# Node 4: score_node
# ─────────────────────────────────────────────────────────────────────────────

def score_node(state: VerifierState) -> dict:
    """
    Produce the final client-facing verdict.

    Policy (NON-NEGOTIABLE):
      - client_decision_required is ALWAYS True
      - Python never triggers any blockchain/fund-release action
      - The verdict is advisory only — the client decides

    The final_score dict is the complete API response payload.
    """
    print("\n[NODE] score_node")

    spec          = state.get("milestone_spec", "")
    findings      = state.get("findings", [])
    per_criterion = state.get("per_criterion", {})
    contract_id   = state.get("contract_id", "")
    milestone_id  = state.get("milestone_id", "")

    verdict = run_scoring(spec, findings, per_criterion)

    # Enforce policy fields — overwrite any LLM attempt to set these
    verdict["client_decision_required"] = True

    # Attach pass-through metadata for the caller (Node backend / CLI)
    verdict["contract_id"]  = contract_id
    verdict["milestone_id"] = milestone_id

    print(
        f"  [score] Final verdict ready — "
        f"confidence={verdict.get('confidence_score')}  "
        f"client_decision_required={verdict['client_decision_required']}"
    )

    return {"final_score": verdict}

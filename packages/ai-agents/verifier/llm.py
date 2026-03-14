"""
llm.py — Groq LLM client and robust JSON parsing for the Verifier Agent.

Public API:
    run_analysis(milestone_spec, fetched_content, findings) -> dict
        Calls ANALYSE_PROMPT, returns parsed analysis dict.

    run_scoring(milestone_spec, findings, per_criterion) -> dict
        Calls SCORE_PROMPT, returns parsed final verdict dict.

Both functions ALWAYS return a valid dict — never raise.
On any failure they return a zero-score safe fallback.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from prompts import ANALYSE_PROMPT, SCORE_PROMPT, SCOUT_PROMPT


# ─────────────────────────────────────────────────────────────────────────────
# Groq client (singleton — temperature=0 for deterministic scoring)
# ─────────────────────────────────────────────────────────────────────────────

def _make_client() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise EnvironmentError(
            "GROQ_API_KEY is not set. Add it to your .env file and restart."
        )
    return ChatGroq(
        model="llama-3.1-8b-instant",
        temperature=0,
        api_key=api_key,
    )


# Lazy singleton — avoids crashing at import time if key isn't set yet
_client: ChatGroq | None = None


def _get_client() -> ChatGroq:
    global _client
    if _client is None:
        _client = _make_client()
    return _client


# ─────────────────────────────────────────────────────────────────────────────
# Raw LLM call
# ─────────────────────────────────────────────────────────────────────────────

def _call_llm(system_prompt: str, user_message: str) -> str:
    """
    Send a system + user message to Groq and return the raw text response.
    Raises on network / API errors (callers handle this).
    """
    client = _get_client()
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message),
    ]
    response = client.invoke(messages)
    return response.content or ""


# ─────────────────────────────────────────────────────────────────────────────
# JSON parsing — the core reliability layer
# ─────────────────────────────────────────────────────────────────────────────

_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _strip_fences(text: str) -> str:
    """
    Strip markdown code fences from LLM output.

    Handles:
        ```json { ... } ```
        ``` { ... } ```
        Raw JSON with no fences (returned as-is)
    Also strips any leading/trailing non-JSON prose before the first '{'.
    """
    # Try fence extraction first
    match = _FENCE_RE.search(text)
    if match:
        return match.group(1).strip()

    # No fence — find the first '{' or '[' and return from there
    for i, ch in enumerate(text):
        if ch in ("{", "["):
            return text[i:].strip()

    return text.strip()


def parse_json_safe(
    raw: str,
    context: str = "",
    *,
    retry_fn: "callable[[str], str] | None" = None,
) -> dict[str, Any] | None:
    """
    Parse a JSON string from LLM output with one automatic retry.

    Args:
        raw:        The raw LLM text output.
        context:    Human label for logging (e.g. 'analyse', 'score').
        retry_fn:   Callable that takes a stricter instruction and returns a
                    new raw LLM response string. If None, no retry is attempted.

    Returns:
        Parsed dict on success, or None on complete failure (both attempts).
    """
    cleaned = _strip_fences(raw)

    # Attempt 1 — parse the cleaned string
    try:
        result = json.loads(cleaned)
        if isinstance(result, dict):
            print(f"  [llm/{context}] JSON parsed OK on first attempt.")
            return result
        print(f"  [llm/{context}] Warning: JSON is valid but not a dict — got {type(result)}.")
        return {"_raw": result}
    except json.JSONDecodeError as exc:
        print(f"  [llm/{context}] JSON parse failed (attempt 1): {exc}")

    # Attempt 2 — retry with a stricter instruction if we have a retry callable
    if retry_fn is None:
        print(f"  [llm/{context}] No retry callable provided — returning None.")
        return None

    print(f"  [llm/{context}] Retrying with stricter format instruction …")
    try:
        stricter_response = retry_fn(
            "Your previous response was not valid JSON. "
            "Reply with ONLY the raw JSON object — no markdown, no backticks, no explanation. "
            "Ensure all quotes inside string values are escaped (e.g. \\\" instead of \"). "
            "Start your response with '{' and end with '}'."
        )
        cleaned2 = _strip_fences(stricter_response)
        result2 = json.loads(cleaned2)
        if isinstance(result2, dict):
            print(f"  [llm/{context}] JSON parsed OK on retry.")
            return result2
    except (json.JSONDecodeError, Exception) as exc:  # noqa: BLE001
        print(f"  [llm/{context}] JSON parse failed (attempt 2): {exc}")

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Safe fallback shapes (returned when all parsing attempts fail)
# ─────────────────────────────────────────────────────────────────────────────

def _analysis_fallback(reason: str) -> dict:
    return {
        "completeness": 0,
        "correctness":  0,
        "quality":      0,
        "evidence":     0,
        "confidence":   0,
        "met":          [],
        "missing":      [],
        "reasoning":    f"[PARSE ERROR] {reason}",
    }


def _scoring_fallback(reason: str) -> dict:
    return {
        "confidence_score":      0,
        "client_decision_required": True,
        "requirements_met":      [],
        "requirements_missing":  [],
        "per_criterion": {
            "completeness": {"score": 0, "comment": "Could not evaluate — parse error."},
            "correctness":  {"score": 0, "comment": "Could not evaluate — parse error."},
            "quality":      {"score": 0, "comment": "Could not evaluate — parse error."},
            "evidence":     {"score": 0, "comment": "Could not evaluate — parse error."},
        },
        "summary": f"[PARSE ERROR] {reason} — Manual review required.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# High-level analysis call
# ─────────────────────────────────────────────────────────────────────────────

def run_analysis(
    milestone_spec: str,
    fetched_content: str,
    findings: list[str],
) -> dict:
    """
    Run the ANALYSE_PROMPT against the fetched content.

    Returns a parsed dict with keys:
        completeness, correctness, quality, evidence,
        confidence, met, missing, reasoning

    Never raises — returns _analysis_fallback on any error.
    """
    findings_str = "\n".join(findings) if findings else "(none — first pass)"

    filled_prompt = ANALYSE_PROMPT.format(
        milestone_spec=milestone_spec,
        fetched_content=fetched_content,
        findings=findings_str,
    )

    print("  [llm/analyse] Calling Groq …")

    # We need a closure for the retry that sends the stricter instruction
    # as a follow-up user message in the same logical conversation.
    try:
        raw_response = _call_llm(
            system_prompt=filled_prompt,
            user_message="Produce the JSON analysis now.",
        )
    except Exception as exc:  # noqa: BLE001
        reason = f"LLM call failed: {exc}"
        print(f"  [llm/analyse] {reason}")
        return _analysis_fallback(reason)

    def _retry_analyse(stricter_msg: str) -> str:
        return _call_llm(
            system_prompt=filled_prompt,
            user_message=stricter_msg,
        )

    result = parse_json_safe(raw_response, context="analyse", retry_fn=_retry_analyse)

    if result is None:
        reason = "Both JSON parse attempts failed on analysis prompt."
        print(f"  [llm/analyse] {reason}")
        return _analysis_fallback(reason)

    # Clamp values to expected ranges
    result["completeness"] = max(0, min(25, int(result.get("completeness", 0))))
    result["correctness"]  = max(0, min(30, int(result.get("correctness",  0))))
    result["quality"]      = max(0, min(25, int(result.get("quality",      0))))
    result["evidence"]     = max(0, min(20, int(result.get("evidence",     0))))
    result["confidence"]   = max(0, min(100, int(result.get("confidence",  0))))
    result.setdefault("met",       [])
    result.setdefault("missing",   [])
    result.setdefault("reasoning", "")

    print(
        f"  [llm/analyse] Done — confidence={result['confidence']}  "
        f"total={result['completeness'] + result['correctness'] + result['quality'] + result['evidence']}/100"
    )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# High-level scoring call
# ─────────────────────────────────────────────────────────────────────────────

def run_scoring(
    milestone_spec: str,
    findings: list[str],
    per_criterion: dict,
) -> dict:
    """
    Run the SCORE_PROMPT to produce the final client-facing verdict.

    Returns a parsed dict with keys:
        confidence_score, client_decision_required,
        requirements_met, requirements_missing,
        per_criterion (with score+comment), summary

    Never raises — returns _scoring_fallback on any error.
    """
    findings_str    = "\n".join(findings) if findings else "(no analysis findings recorded)"
    per_crit_str    = json.dumps(per_criterion, indent=2) if per_criterion else "{}"

    filled_prompt = SCORE_PROMPT.format(
        milestone_spec=milestone_spec,
        findings=findings_str,
        per_criterion=per_crit_str,
    )

    print("  [llm/score] Calling Groq …")

    try:
        raw_response = _call_llm(
            system_prompt=filled_prompt,
            user_message="Produce the final verdict JSON now.",
        )
    except Exception as exc:  # noqa: BLE001
        reason = f"LLM call failed: {exc}"
        print(f"  [llm/score] {reason}")
        return _scoring_fallback(reason)

    def _retry_score(stricter_msg: str) -> str:
        return _call_llm(
            system_prompt=filled_prompt,
            user_message=stricter_msg,
        )

    result = parse_json_safe(raw_response, context="score", retry_fn=_retry_score)

    if result is None:
        reason = "Both JSON parse attempts failed on scoring prompt."
        print(f"  [llm/score] {reason}")
        return _scoring_fallback(reason)

    # Enforce mandatory fields and policy
    result["client_decision_required"] = True   # ALWAYS — non-negotiable
    result.setdefault("confidence_score",     0)
    result.setdefault("requirements_met",     [])
    result.setdefault("requirements_missing", [])
    result.setdefault("summary",              "")
    result.setdefault("per_criterion",        {})

    # Clamp confidence score
    result["confidence_score"] = max(0, min(100, int(result["confidence_score"])))

    print(f"  [llm/score] Done — final confidence={result['confidence_score']}")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# High-level scout call for GitHub repository scanning
# ─────────────────────────────────────────────────────────────────────────────

def run_scout(milestone_spec: str, file_list: list[str]) -> list[str]:
    """
    Run the SCOUT_PROMPT to select the most relevant files from a repo.
    Returns a list of file paths.
    """
    file_list_str = "\n".join(file_list)
    filled_prompt = SCOUT_PROMPT.format(
        milestone_spec=milestone_spec,
        file_list=file_list_str,
    )

    print(f"  [llm/scout] Calling Groq to select files out of {len(file_list)} …")

    try:
        raw_response = _call_llm(
            system_prompt=filled_prompt,
            user_message="Return ONLY the JSON array of strings now.",
        )
    except Exception as exc:  # noqa: BLE001
        print(f"  [llm/scout] LLM call failed: {exc}")
        return []

    def _retry_scout(msg: str) -> str:
        return _call_llm(filled_prompt, msg)

    # Re-use our robust json parser
    cleaned = _strip_fences(raw_response)
    try:
        result = json.loads(cleaned)
    except Exception:  # noqa: BLE001
        try:
            stricter_response = _retry_scout(
                "Your previous response was not a valid JSON array. "
                "Reply with ONLY a JSON array — e.g. [\"file1.txt\", \"file2.js\"] — no markdown, no explanation."
            )
            cleaned2 = _strip_fences(stricter_response)
            result = json.loads(cleaned2)
        except Exception as exc:  # noqa: BLE001
            print(f"  [llm/scout] JSON parse failed: {exc}")
            return []

    if isinstance(result, list):
        print(f"  [llm/scout] Selected {len(result)} files.")
        return [str(x) for x in result]
    
    return []

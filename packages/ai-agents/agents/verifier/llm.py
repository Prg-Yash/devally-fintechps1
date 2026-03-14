"""
llm.py — Featherless.ai LLM client and robust JSON parsing for the Verifier Agent.

Dual-Model Architecture:
    TEXT  model: Qwen/Qwen3-32B          — for code analysis, scoring, and scout
    VISION model: Qwen/Qwen3-VL-30B-A3B-Instruct  — for Figma / visual design analysis

Both are accessed via Featherless.ai's OpenAI-compatible API.

Public API:
    run_analysis(milestone_spec, fetched_content, findings) -> dict
        Calls ANALYSE_PROMPT, returns parsed analysis dict.

    run_scoring(milestone_spec, findings, per_criterion) -> dict
        Calls SCORE_PROMPT, returns parsed final verdict dict.

    run_scout(milestone_spec, file_list) -> list[str]
        Calls SCOUT_PROMPT, returns list of relevant file paths.

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

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from .prompts import ANALYSE_PROMPT, SCORE_PROMPT, SCOUT_PROMPT, VISION_ANALYSE_PROMPT


# ─────────────────────────────────────────────────────────────────────────────
# Featherless.ai configuration
# ─────────────────────────────────────────────────────────────────────────────

FEATHERLESS_BASE_URL = os.getenv(
    "FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1"
)

# Model IDs
TEXT_MODEL   = "Qwen/Qwen3-32B"
VISION_MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct"


# ─────────────────────────────────────────────────────────────────────────────
# Client factories (singleton per model — temperature=0 for determinism)
# ─────────────────────────────────────────────────────────────────────────────

def _make_client(model: str) -> ChatOpenAI:
    api_key = os.getenv("FEATHERLESS_API_KEY", "").strip()
    if not api_key:
        raise EnvironmentError(
            "FEATHERLESS_API_KEY is not set. Add it to your .env file and restart."
        )
    return ChatOpenAI(
        model=model,
        temperature=0,
        api_key=api_key,
        base_url=FEATHERLESS_BASE_URL,
    )


# Lazy singletons — avoids crashing at import time if key isn't set yet
_text_client: ChatOpenAI | None = None
_vision_client: ChatOpenAI | None = None


def _get_text_client() -> ChatOpenAI:
    global _text_client
    if _text_client is None:
        _text_client = _make_client(TEXT_MODEL)
    return _text_client


def _get_vision_client() -> ChatOpenAI:
    global _vision_client
    if _vision_client is None:
        _vision_client = _make_client(VISION_MODEL)
    return _vision_client


# ─────────────────────────────────────────────────────────────────────────────
# Raw LLM call
# ─────────────────────────────────────────────────────────────────────────────

def _call_llm(system_prompt: str, user_message: str, *, use_vision: bool = False) -> str:
    """
    Send a system + user message to Featherless and return the raw text response.
    Raises on network / API errors (callers handle this).

    Args:
        system_prompt: The system-level instruction prompt.
        user_message:  The user-level message.
        use_vision:    If True, use Gemma 3 (vision model). Otherwise use Qwen (text model).
    """
    client = _get_vision_client() if use_vision else _get_text_client()
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message),
    ]
    response = client.invoke(messages)
    raw = response.content or ""
    # Qwen3 sometimes wraps output in <think>...</think> tags — strip them
    raw = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
    return raw


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

    print(f"  [llm/analyse] Calling Featherless ({TEXT_MODEL}) …")

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

    print(f"  [llm/score] Calling Featherless ({TEXT_MODEL}) …")

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

    print(f"  [llm/scout] Calling Featherless ({TEXT_MODEL}) to select files out of {len(file_list)} …")

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


# ─────────────────────────────────────────────────────────────────────────────
# Vision analysis call (Qwen3-VL — for images / Figma screenshots)
# ─────────────────────────────────────────────────────────────────────────────

def _call_vision_llm(system_prompt: str, user_text: str, image_b64_list: list[str]) -> str:
    """
    Send text + images to Qwen3-VL (vision model) via Featherless.
    Images are passed as base64-encoded data URIs.
    """
    client = _get_vision_client()

    # Build multimodal content: text + images
    content_parts = []
    for img_b64 in image_b64_list:
        # Auto-detect mime type from base64 header or default to png
        if img_b64.startswith("/9j/"):
            mime = "image/jpeg"
        elif img_b64.startswith("UklGR"):
            mime = "image/webp"
        else:
            mime = "image/png"
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{img_b64}"},
        })
    content_parts.append({"type": "text", "text": user_text})

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=content_parts),
    ]
    response = client.invoke(messages)
    return response.content or ""


def run_vision_analysis(
    milestone_spec: str,
    image_b64_list: list[str],
    findings: list[str],
) -> dict:
    """
    Run visual analysis on one or more images using Qwen3-VL (vision model).

    Args:
        milestone_spec: What the client expects.
        image_b64_list: List of base64-encoded image strings.
        findings:       Previous findings from prior passes.

    Returns a parsed dict with keys:
        completeness, correctness, quality, evidence,
        confidence, met, missing, reasoning

    Never raises — returns _analysis_fallback on any error.
    """
    findings_str = "\n".join(findings) if findings else "(none — first pass)"

    filled_prompt = VISION_ANALYSE_PROMPT.format(
        milestone_spec=milestone_spec,
        findings=findings_str,
    )

    print(f"  [llm/vision] Calling Featherless ({VISION_MODEL}) with {len(image_b64_list)} image(s) …")

    try:
        raw_response = _call_vision_llm(
            system_prompt=filled_prompt,
            user_text="Analyze the provided images against the milestone specification. Produce the JSON analysis now.",
            image_b64_list=image_b64_list,
        )
    except Exception as exc:  # noqa: BLE001
        reason = f"Vision LLM call failed: {exc}"
        print(f"  [llm/vision] {reason}")
        return _analysis_fallback(reason)

    def _retry_vision(stricter_msg: str) -> str:
        return _call_vision_llm(
            system_prompt=filled_prompt,
            user_text=stricter_msg,
            image_b64_list=image_b64_list,
        )

    result = parse_json_safe(raw_response, context="vision", retry_fn=_retry_vision)

    if result is None:
        reason = "Both JSON parse attempts failed on vision analysis."
        print(f"  [llm/vision] {reason}")
        return _analysis_fallback(reason)

    # Clamp values
    result["completeness"] = max(0, min(25, int(result.get("completeness", 0))))
    result["correctness"]  = max(0, min(30, int(result.get("correctness",  0))))
    result["quality"]      = max(0, min(25, int(result.get("quality",      0))))
    result["evidence"]     = max(0, min(20, int(result.get("evidence",     0))))
    result["confidence"]   = max(0, min(100, int(result.get("confidence",  0))))
    result.setdefault("met",       [])
    result.setdefault("missing",   [])
    result.setdefault("reasoning", "")

    print(
        f"  [llm/vision] Done — confidence={result['confidence']}  "
        f"total={result['completeness'] + result['correctness'] + result['quality'] + result['evidence']}/100"
    )
    return result

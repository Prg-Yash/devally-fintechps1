"""
agents/translator/router.py — AI Contract Translator Agent

Takes a full contract object (in English) and translates ALL text fields
into the freelancer's chosen language, while preserving the JSON structure
so the frontend can render it in exactly the same UI components.

Numeric fields (amounts, days) are never touched.
The on-chain English version is always the legal binding document.

Uses Qwen/Qwen3-32B via Featherless.ai — supports 100+ languages natively.
"""

import os
import re
import json
import logging
import httpx

from fastapi import APIRouter, HTTPException
from models.translator import TranslateInput, TranslateOutput, ContractContent

logger = logging.getLogger(__name__)

FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")
FEATHERLESS_BASE_URL = os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1")
MODEL_NAME = "Qwen/Qwen3-32B"

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# System Prompt
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a professional legal and technical document translator for a global freelance escrow platform.

You will receive a JSON contract object written in English. Your job is to translate ALL text fields into the specified target language, while keeping the JSON structure EXACTLY the same.

STRICT RULES:
1. Translate ONLY the following text fields:
   - title
   - description
   - budget_reasoning
   - complexity_level (translate the word: simple/moderate/complex/enterprise)
   - Each milestone's: title, description
   - Each milestone's acceptance_criteria (each string in the array)
   - tech_stack items MAY be left in English if they are proper nouns (React, Python, etc.)

2. NEVER change numeric fields: total_budget_pusd, amount_pusd, due_days, estimated_duration_days, milestone_number

3. Output ONLY valid raw JSON. No markdown fences. No explanations. No extra text.

4. Maintain professional, formal, and legally precise language in the translation.

5. Do not add or remove any keys from the JSON structure."""


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/translate",
    response_model=TranslateOutput,
    summary="Translate a contract into the freelancer's language"
)
async def translate_contract(payload: TranslateInput):
    api_key = os.getenv("FEATHERLESS_API_KEY", FEATHERLESS_API_KEY)
    if not api_key:
        raise HTTPException(status_code=500, detail="Featherless API key not configured")

    # Serialize the contract to clean JSON for the LLM
    contract_json = payload.contract.model_dump()
    contract_str = json.dumps(contract_json, ensure_ascii=False, indent=2)

    user_message = (
        f"Translate this contract into {payload.target_language}.\n\n"
        f"Contract (English):\n{contract_str}\n\n"
        f"Output the fully translated contract as valid JSON. "
        f"Do not change numeric fields. Do not add or remove keys."
    )

    request_payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.1,  # Very low — we want consistent, faithful translation
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    logger.info(f"Translating contract '{payload.contract.title}' → {payload.target_language}")

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{FEATHERLESS_BASE_URL.rstrip('/')}/chat/completions",
                headers=headers,
                json=request_payload
            )
            response.raise_for_status()
        except httpx.RequestError as exc:
            logger.error(f"Network error: {exc}")
            raise HTTPException(status_code=502, detail="Upstream AI provider is unreachable")
        except httpx.HTTPStatusError as exc:
            logger.error(f"Featherless error {exc.response.status_code}: {exc.response.text}")
            raise HTTPException(status_code=502, detail="Upstream AI provider returned an error")

    raw = response.json()["choices"][0]["message"]["content"]

    # Strip Qwen3 <think> tags
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()

    # Strip markdown fences if present
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if match:
        cleaned = match.group(1).strip()
    else:
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        if start != -1 and end != -1:
            cleaned = cleaned[start:end + 1]

    try:
        translated_json = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed: {e}\nRaw: {cleaned[:500]}")
        raise HTTPException(status_code=500, detail="AI produced invalid JSON during translation")

    # Preserve numeric fields from original (safety guarantee — never trust LLM with numbers)
    translated_json["total_budget_pusd"] = contract_json["total_budget_pusd"]
    translated_json["estimated_duration_days"] = contract_json["estimated_duration_days"]
    for i, ms in enumerate(translated_json.get("milestones", [])):
        if i < len(contract_json["milestones"]):
            original_ms = contract_json["milestones"][i]
            ms["amount_pusd"] = original_ms["amount_pusd"]
            ms["due_days"] = original_ms["due_days"]
            ms["milestone_number"] = original_ms["milestone_number"]

    try:
        translated_contract = ContractContent(**translated_json)
    except Exception as e:
        logger.error(f"Contract validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Translated contract structure invalid: {e}")

    return TranslateOutput(
        translated=translated_contract,
        target_language=payload.target_language,
        legal_notice=(
            f"This is a {payload.target_language} translated view only. "
            f"The legally binding version is in English as stored on-chain."
        )
    )

"""
agents/generator/router.py — Agreement Generator Agent

Takes ONE rough sentence from the client and produces:
  - Professional title & description
  - Tech stack recommendations
  - Fair market price estimate with reasoning
  - Multiple staged milestones with amounts, due dates, and verifiable criteria

Uses Qwen/Qwen3-32B via Featherless.ai (direct httpx call, no LangChain needed).
"""

import os
import re
import json
import logging
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from models.generator import GenerateInput, GenerateOutput

logger = logging.getLogger(__name__)

FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")
FEATHERLESS_BASE_URL = os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1")
MODEL_NAME = "Qwen/Qwen3-32B"

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# The System Prompt — this is the core intelligence of the generator
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert Technical Product Manager, Project Estimator, and Market Rate Analyst for a freelance escrow platform called PayCrow.

A client will give you a rough, informal idea of what they want built. Your job is to:

1. **Generate a professional project title and detailed description.**
2. **Recommend the ideal tech stack** for the project.
3. **Estimate a fair market budget** based on current freelancer rates (2024-2026 global market). Consider:
   - Junior devs: $15-30/hr, Mid: $40-75/hr, Senior: $80-150/hr
   - Simple landing page: $50-200
   - Auth + CRUD app: $300-800
   - Full SaaS MVP: $2,000-8,000
   - Complex enterprise system: $10,000+
4. **Break the project into 3-6 staged milestones**, each with:
   - A clear title
   - What the freelancer must deliver in that phase
   - A portion of the total budget
   - Number of days from project start
   - 3-5 acceptance criteria that are 100% objective and verifiable

You must output EXACTLY a valid JSON object. No markdown fences, no explanation text. ONLY raw JSON.

{
  "title": "<Professional project title>",
  "description": "<Detailed 2-4 sentence project description>",
  "tech_stack": ["<Technology 1>", "<Technology 2>", "..."],
  "total_budget_pusd": <number>,
  "budget_reasoning": "<1-2 sentence explanation of why this price is fair>",
  "complexity_level": "<one of: simple, moderate, complex, enterprise>",
  "estimated_duration_days": <number>,
  "milestones": [
    {
      "milestone_number": 1,
      "title": "<Phase title>",
      "description": "<What must be delivered>",
      "amount_pusd": <number — portion of total budget>,
      "due_days": <number — days from project start>,
      "acceptance_criteria": [
        "<100% verifiable criterion 1>",
        "<100% verifiable criterion 2>",
        "<100% verifiable criterion 3>"
      ]
    }
  ]
}

CRITICAL RULES:
- Milestone amounts MUST add up to total_budget_pusd exactly.
- Acceptance criteria MUST be 100% objective — never use words like "beautiful", "clean", "fast", "user-friendly".
- Use verifiable terms like "renders without console errors", "API returns 200 for valid requests", "includes unit tests with >80% coverage".
- due_days must be cumulative (milestone 2 due_days > milestone 1 due_days).
- Budget must be realistic for freelance market rates. Do not inflate or deflate."""


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateOutput, summary="Generate full project agreement from one idea")
async def generate_agreement(payload: GenerateInput):
    api_key = os.getenv("FEATHERLESS_API_KEY", FEATHERLESS_API_KEY)
    if not api_key:
        raise HTTPException(status_code=500, detail="Featherless API key not configured")

    today = datetime.now().strftime("%Y-%m-%d")

    user_message = (
        f"Client's project idea: {payload.project_idea}\n"
        f"Today's date: {today}\n"
        f"Generate the complete project specification, fair market budget, "
        f"and staged milestones with acceptance criteria."
    )

    request_payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.3,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    logger.info(f"Generating agreement for idea: '{payload.project_idea}'")

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{FEATHERLESS_BASE_URL.rstrip('/')}/chat/completions",
                headers=headers,
                json=request_payload
            )
            response.raise_for_status()
        except httpx.RequestError as exc:
            logger.error(f"Network error to Featherless: {exc}")
            raise HTTPException(status_code=502, detail="Upstream AI provider is unreachable")
        except httpx.HTTPStatusError as exc:
            logger.error(f"Featherless returned {exc.response.status_code}: {exc.response.text}")
            raise HTTPException(status_code=502, detail="Upstream AI provider returned an error")

    response_data = response.json()
    raw_content = response_data["choices"][0]["message"]["content"]

    # Clean up Qwen3 quirks
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw_content).strip()

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
        parsed = json.loads(cleaned)

        # Validate milestone amounts add up
        milestones = parsed.get("milestones", [])
        total = parsed.get("total_budget_pusd", 0)
        milestone_sum = sum(m.get("amount_pusd", 0) for m in milestones)

        # Auto-correct minor rounding differences
        if milestones and abs(milestone_sum - total) > 1:
            diff = total - milestone_sum
            milestones[-1]["amount_pusd"] = round(milestones[-1]["amount_pusd"] + diff, 2)

        return GenerateOutput(**parsed)

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON: {e}\nRaw: {cleaned[:500]}")
        raise HTTPException(status_code=500, detail="AI produced invalid JSON output")
    except Exception as e:
        logger.error(f"Validation error: {e}\nParsed: {json.dumps(parsed, indent=2)[:500]}")
        raise HTTPException(status_code=500, detail=f"AI output format was invalid: {e}")

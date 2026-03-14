# Deliverable Verification Agent

This document is the implementation plan for the AI Deliverable Verification Agent that powers your escrow platform's core USP.

The goal is to let a freelancer submit a deliverable URL and get a deterministic, explainable verdict with a confidence score breakdown for client review.

## 1. Product Goal

Given:

- A deliverable URL (GitHub, Figma, website, PDF, Google Doc fallback)
- A milestone specification
- Contract metadata (`contract_id`, `milestone_id`)

The agent must:

1. Classify URL type
2. Fetch content with a source-specific strategy
3. Analyze submission quality against milestone requirements
4. Output strict structured scoring and rationale
5. Never release funds automatically; only return analysis and scoring
6. Loop for a second pass when first confidence is low
7. Stream every step to frontend in near real time

## 2. Architecture Overview

Runtime stack:

- Python 3.11+
- FastAPI (REST + SSE)
- LangGraph (workflow and loop control)
- LangChain + ChatGroq (`llama-3.1-70b-versatile`, `temperature=0`)
- External fetchers: GitHub API, Figma API, website scraping, PDF extraction

High-level flow:

1. API receives verification request
2. Graph starts at `detect`
3. Graph fetches content via source-specific fetcher
4. Graph analyzes content using strict JSON-scored prompt
5. Router decides:
   - `fetch_more` when confidence < 60 and attempts < 2
   - `finalise` otherwise
6. Final score node produces verdict JSON with detailed criterion comments
7. API returns final payload and passes through contract metadata for caller context

## 3. Project Structure (Planned)

```text
verifier/
├── README.md             # This plan
├── main.py               # FastAPI app with /verify and /verify/stream
├── graph.py              # LangGraph StateGraph wiring
├── nodes.py              # detect/fetch/analyse/score + routing
├── fetchers.py           # GitHub/Figma/Website/PDF fetchers
├── state.py              # VerifierState TypedDict
├── prompts.py            # ANALYSE_PROMPT and SCORE_PROMPT
├── requirements.txt      # Python dependencies
└── .env                  # GROQ_API_KEY and FIGMA_TOKEN
```

## 4. State Contract

`VerifierState` fields:

- `url: str`
- `milestone_spec: str`
- `url_type: str` (`github|figma|website|pdf|other`)
- `fetched_content: str`
- `fetch_attempts: int` (initial `0`)
- `findings: list[str]`
- `per_criterion: dict`
- `confidence: int` (`0-100`)
- `final_score: dict`
- `error: str`

Scoring note:

- Your rubric later defines `25 + 30 + 25 + 20 = 100`.
- We will follow this 100-point rubric (completeness/correctness/quality/evidence).
- `per_criterion` still stays a simple dict of ints in state, with comments added in final verdict object.

## 5. URL Detection Strategy

Primary approach:

- LLM classification node with strict output contract:
  - System instruction: return only one word from `github, figma, website, pdf, other`

Reliability hardening:

- Add post-processing normalization (`strip`, lowercase)
- If LLM output is unexpected, fallback to regex-based heuristics:
  - `github.com/<owner>/<repo>` -> `github`
  - `figma.com/file/` -> `figma`
  - `.pdf` suffix -> `pdf`
  - `http(s)` -> `website`
  - else `other`

Reason:

- Keeps deterministic behavior even when LLM output drifts.

## 6. Fetcher Plan

### 6.1 GitHub fetcher (`fetch_github`)

Inputs:

- Repository URL (`https://github.com/{owner}/{repo}`)

Execution plan:

1. Parse owner/repo from URL
2. Call tree API:
   - `GET /repos/{owner}/{repo}/git/trees/main?recursive=1`
3. Handle 404:
   - Return `Repository not found or private`
4. Filter by extensions:
   - `.js .ts .jsx .tsx .py .sol .css .html .md`
5. Fetch `README.md` first (if available)
6. Fetch raw file contents from `raw.githubusercontent.com`
7. Concatenate as:
   - `=== <path> ===\n<content>\n`
8. Hard cap at 15000 chars

Edge handling:

- If default branch is not `main`, fallback to `master` and then repository default branch API lookup (recommended robustness upgrade).

### 6.2 Figma fetcher (`fetch_figma`)

Inputs:

- Figma file URL (`https://www.figma.com/file/{file_key}/...`)

Execution plan:

1. Extract `file_key`
2. Read `FIGMA_TOKEN` from env
3. If missing, return `Figma token not configured`
4. Call:
   - `GET https://api.figma.com/v1/files/{file_key}`
   - Header: `X-Fig-Token`
5. Traverse document nodes to summarize:
   - Page names
   - Frame names
   - Component names
   - Text nodes
6. Return structured summary text

### 6.3 Website fetcher (`fetch_website`)

Execution plan:

1. `httpx.get` with timeout 10s
2. Parse with BeautifulSoup (`html.parser`)
3. Remove `script` and `style` tags
4. Extract:
   - title
   - meta description
   - h1/h2/h3
   - paragraph text
   - nav links
5. Build structured text output
6. Cap at 8000 chars

### 6.4 PDF fetcher (`extract_pdf`)

Execution plan:

1. Download bytes with `httpx`
2. Open via `fitz.open(stream=..., filetype='pdf')`
3. Extract all page text
4. Cap at 12000 chars
5. Return plain text

## 7. Prompting Plan

### 7.1 Analysis prompt (`ANALYSE_PROMPT`)

Purpose:

- Strict technical assessment against milestone requirements
- Must return valid JSON only

Expected JSON shape:

- `completeness` (0-25)
- `correctness` (0-30)
- `quality` (0-25)
- `evidence` (0-20)
- `confidence` (0-100)
- `met` (list)
- `missing` (list)
- `reasoning` (3-4 sentences)

### 7.2 Final scoring prompt (`SCORE_PROMPT`)

Purpose:

- Produce final user-facing verdict in plain English for non-technical clients
- Return valid JSON only

Final verdict shape:

- `confidence_score`
- `requirements_met`
- `requirements_missing`
- `per_criterion` with score + comment
- `summary`
- `client_decision_required` (always `true`)

## 8. JSON Robustness Plan

Because LLM outputs can include fenced JSON, we include a parser helper:

1. Strip surrounding markdown fences (for example, fenced json blocks)
2. Parse JSON
3. If parsing fails:
   - retry exactly once with stricter instruction
4. If second parse fails:
   - return safe zero-score result with explicit error message

This behavior is required for both analysis and final scoring stages.

## 9. Node-by-Node Behavior

### 9.1 `detect_node`

- Prints `detect_node` for traceability
- Calls classifier LLM
- Sets `url_type`

### 9.2 `fetch_node`

- Prints `fetch_node`
- Uses `url_type` to select fetcher
- Increments `fetch_attempts`
- Catches all exceptions and sets `error`
- If no content returned, sets empty fallback and allows graph to move to scoring path

### 9.3 `analyse_node`

- Prints `analyse_node`
- Skips LLM analysis if `fetched_content` empty (zero-score path)
- Calls analysis prompt with:
  - `milestone_spec`
  - `fetched_content`
  - previous `findings`
- Updates:
  - `findings`
  - `per_criterion`
  - `confidence`

### 9.4 `should_loop`

- Routing function only
- Logic:
  - if `confidence < 60` and `fetch_attempts < 2` -> `fetch_more`
  - else -> `finalise`

### 9.5 `score_node`

- Prints `score_node`
- Consolidates all findings and criterion values
- Produces final verdict JSON
- Enforces manual-release policy:
  - No automatic release output
  - Set `client_decision_required=true` in all cases
  - Include clear scoring comments so client can decide confidently
- Adds integration note:
  - Python does not call chain directly
  - upstream Node service should release only after explicit client action

## 10. Graph Plan (LangGraph)

Graph topology:

- Entry: `detect`
- Sequence: `detect -> fetch -> analyse`
- Conditional after analyse:
  - `fetch_more -> fetch`
  - `finalise -> score`
- Exit: `score -> END`

Loop guarantees:

- Max fetch attempts: 2
- Prevents infinite loops

## 11. API Design

### 11.1 POST `/verify`

Request:

```json
{
  "url": "https://github.com/user/repo",
  "milestone_spec": "Build a Solidity escrow contract with deposit, release, and dispute functions. Must include unit tests.",
  "contract_id": "0xabc123",
  "milestone_id": "1"
}
```

Response shape:

```json
{
  "confidence_score": 88,
  "client_decision_required": true,
  "requirements_met": [],
  "requirements_missing": [],
  "per_criterion": {
    "completeness": { "score": 22, "comment": "..." },
    "correctness": { "score": 27, "comment": "..." },
    "quality": { "score": 21, "comment": "..." },
    "evidence": { "score": 18, "comment": "..." }
  },
  "summary": "...",
  "contract_id": "0xabc123",
  "milestone_id": "1"
}
```

### 11.2 POST `/verify/stream`

Uses Server-Sent Events (`text/event-stream`) and `graph.stream()`.

Event examples:

```text
data: {"step": "detect", "result": "github"}

data: {"step": "fetch", "result": "Fetched 12 files, 8400 chars"}

data: {"step": "analyse", "result": "Confidence: 58, looping..."}

data: {"step": "analyse", "result": "Confidence: 88, finalising"}

data: {"step": "score", "result": {"confidence_score": 88, ...}}
```

Frontend can subscribe via `EventSource` and render a live timeline.

## 12. Error Handling Contract

All error cases must still return full score schema with safe defaults.

Required behaviors:

1. GitHub 404 -> `Repository not found or private`
2. Missing Figma token -> zero-score response with `Figma token required`
3. Invalid JSON from LLM:
   - retry once with stricter format instruction
   - on second failure return zero-score error result
4. Empty fetched content:
   - skip analysis
   - finalize with zero-score verdict and explicit reason
5. Never crash API route

Uniform fallback shape:

- confidence: 0
- client_decision_required: true
- requirements lists included as empty or explicit missing details
- summary clearly explains why score is zero

## 13. Security and Operational Considerations

- Do not execute any downloaded code
- Truncate fetched content before LLM calls (hard caps)
- Add request timeout boundaries for all network calls
- Restrict URL schemes to `http` and `https`
- Optionally block localhost/internal IP URLs to reduce SSRF risk
- Log node timings and API failures for observability
- Keep LLM temperature fixed at `0` for deterministic scoring behavior

## 14. Data Boundaries and Web3 Integration

Python verifier responsibilities:

- Analyze submission and return decision payload

Node blockchain backend responsibilities:

- Read verifier output
- Show score breakdown and findings to client
- Trigger smart contract method only when client explicitly approves release:
  - `releaseMilestone(contract_id, milestone_id)`

Separation principle:

- AI layer evaluates
- Client decides release
- Blockchain layer executes funds movement only after client decision

## 15. Implementation Phases

Phase 1: Scaffolding

- Create folder/files
- Add `requirements.txt`
- Add `.env` template

Phase 2: Fetch layer

- Implement all 4 fetchers
- Add caps and source-specific error messages

Phase 3: LLM + prompts + JSON parser

- Add Groq client configuration
- Add robust JSON extraction and retry

Phase 4: Nodes and routing

- Implement detect/fetch/analyse/score and `should_loop`

Phase 5: Graph

- Wire StateGraph and conditional edge loop

Phase 6: FastAPI routes

- Add `/verify` and `/verify/stream`
- Map graph outputs to response schema

Phase 7: Validation

- Dry-run with sample GitHub, Figma, website, and PDF links
- Test failure scenarios and ensure full-schema responses

Phase 8: Integration handoff

- Share API contract and manual client-release behavior with Node backend

## 16. Testing Plan

Unit tests:

- URL classification normalization
- GitHub URL parsing
- Figma key extraction
- JSON fence stripping and parse retry behavior
- Loop routing logic

Integration tests:

- `/verify` end-to-end with mocked HTTP calls and mocked LLM outputs
- `/verify/stream` event order and payload shape

Failure-case tests:

- Missing env vars
- 404 repository
- Invalid/non-JSON LLM response
- Empty fetch content

## 17. Success Criteria (Definition of Done)

The verifier is complete when:

1. Every required file exists and has non-placeholder implementation
2. `/verify` returns stable structured verdicts
3. `/verify/stream` emits all major node updates
4. Loop behavior runs exactly as specified
5. All mandatory error cases return safe full-shape responses
6. Verifier output never triggers release automatically
7. Node backend can consume result, show it to client, and release only on client action

## 18. Setup Checklist (for when coding starts)

1. Create virtual env
2. Install dependencies from `requirements.txt`
3. Add `.env` with `GROQ_API_KEY` and optional `FIGMA_TOKEN`
4. Run server:
   - `uvicorn main:app --reload`
5. Test endpoints with sample payloads

---

When you confirm this plan, the next step will be implementing each file exactly according to this design, with no placeholders and with all fallback/error flows included.

"""
test_all.py — Test suite for parsing, routing, and FastAPI integrations.
Run with: pytest tests/test_all.py
"""
import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Import app components (we modify sys.path if tests are run externally, but pytest handles it usually)
# We assume this is run from the 'verifier' directory.
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from main import app
from nodes import _classify_url_regex, should_loop
from llm import _strip_fences, parse_json_safe

client = TestClient(app)

# ── 1. Unit Tests for Parsing & Regex ─────────────────────────────────────────

def test_url_classification_regex():
    assert _classify_url_regex("https://github.com/microsoft/vscode") == "github"
    assert _classify_url_regex("https://www.figma.com/file/abc/design") == "figma"
    assert _classify_url_regex("http://example.com/spec.pdf") == "pdf"
    assert _classify_url_regex("https://google.com") == "website"
    assert _classify_url_regex("ftp://unknown") == "other"

def test_json_fence_stripping():
    # Standard format
    assert _strip_fences("```json\n{\"a\": 1}\n```") == '{"a": 1}'
    # Without language tag
    assert _strip_fences("```\n{\"b\": 2}\n```") == '{"b": 2}'
    # Prose before and after
    assert _strip_fences("Here is my result:\n```json\n{\"c\": 3}\n```\nHope this helps!") == '{"c": 3}'
    # No fences, just prose then JSON
    assert _strip_fences("Result:\n{\"d\": 4}") == '{"d": 4}'

def test_parse_json_safe_retry():
    # Should work on first try
    good = '{"success": true}'
    assert parse_json_safe(good, "test")["success"] is True

    # Should retry if invalid, let's provide a mock retry function
    bad = "Not JSON at all"
    def mock_retry(msg):
        return '{"recovered": true}'
    
    recovered = parse_json_safe(bad, "test", retry_fn=mock_retry)
    assert recovered is not None
    assert recovered["recovered"] is True

# ── 2. Unit Tests for Graph Routing ───────────────────────────────────────────

def test_should_loop_routing():
    # Confidence < 60, attempts < 2 => fetch_more
    assert should_loop({"confidence": 50, "fetch_attempts": 1}) == "fetch_more"
    # Confidence >= 60 => finalise
    assert should_loop({"confidence": 85, "fetch_attempts": 1}) == "finalise"
    # Max attempts reached => finalise
    assert should_loop({"confidence": 30, "fetch_attempts": 2}) == "finalise"

# ── 3. Integration Tests for FastAPI with Mocked LLM & HTTP ────────────────────

@patch("fetchers.httpx.get")
@patch("nodes._get_classifier")
@patch("llm._call_llm")
def test_mocked_verify_endpoint(mock_call_llm, mock_get_classifier, mock_httpx_get):
    # 1. Mock the URL classifier LLM to return "github"
    mock_classifier = MagicMock()
    mock_classifier.invoke.return_value.content = "github"
    mock_get_classifier.return_value = mock_classifier

    # 2. Mock HTTPX to return a fake GitHub tree, and then a fake README content
    class MockResponse:
        def __init__(self, json_data=None, text_data=None, status_code=200):
            self._json = json_data
            self.text = text_data
            self.status_code = status_code
        def json(self): return self._json

    def side_effect(url, **kwargs):
        if "api.github.com/repos" in url and "trees" not in url:
            # default branch probe
            return MockResponse(json_data={"default_branch": "main"})
        if "api.github.com" in url and "trees" in url:
            # tree response
            return MockResponse(json_data={"tree": [{"path": "README.md", "type": "blob"}]})
        if "raw.githubusercontent.com" in url:
            return MockResponse(text_data="This is a mocked README file.")
        return MockResponse(status_code=404)

    mock_httpx_get.side_effect = side_effect

    # 3. Mock LLM Analysis and Scoring calls
    # LLM is called twice in the happy path (1 for analyse, 1 for score)
    # If confidence is > 60, it won't loop.
    mock_call_llm.side_effect = [
        # Analyse pass 1
        '{"completeness": 20, "correctness": 25, "quality": 15, "evidence": 15, "confidence": 80, "met": ["A"], "missing": [], "reasoning": "Looks good."}',
        # Score pass
        '{"confidence_score": 80, "summary": "Great work.", "per_criterion": {"completeness": {"score": 20, "comment": "Good"}, "correctness": {"score": 25, "comment": "Okay"}, "quality": {"score": 15, "comment": "Basic"}, "evidence": {"score": 15, "comment": "Present"}}}'
    ]

    payload = {
        "url": "https://github.com/fake/repo",
        "milestone_spec": "A test milestone",
        "contract_id": "C-123",
        "milestone_id": "M-456"
    }

    res = client.post("/verify", json=payload)
    assert res.status_code == 200
    
    data = res.json()
    assert data["confidence_score"] == 80
    assert data["client_decision_required"] is True
    assert data["contract_id"] == "C-123"
    assert "completeness" in data["per_criterion"]
    
    # Ensure LLM was called 2 times (analyse + score)
    assert mock_call_llm.call_count == 2

"""
fetchers.py — Source-specific content fetchers for the Deliverable Verification Agent.

Public API:
    fetch_content(url: str, url_type: str) -> str
        Dispatches to the correct fetcher and always returns a plain-text string.
        On error it returns a human-readable error message (never raises).

Individual fetchers (also importable for testing):
    fetch_github(url)
    fetch_figma(url)
    fetch_website(url)
    extract_pdf(url)
"""

from __future__ import annotations

import base64
import os
import re
from typing import Optional

import httpx

# ── Content caps (chars) ──────────────────────────────────────────────────────
GITHUB_CAP  = 20_000
WEBSITE_CAP =  8_000
PDF_CAP     = 12_000
FIGMA_CAP   = 10_000

# ── File extensions to fetch from GitHub repos ────────────────────────────────
GITHUB_EXTENSIONS = {
    ".js", ".ts", ".jsx", ".tsx",
    ".py", ".sol",
    ".css", ".html",
    ".md", ".json", ".yaml", ".yml",
    ".go", ".rs", ".java", ".cs", ".dart", ".rb",
}

# ── Shared httpx timeout ──────────────────────────────────────────────────────
TIMEOUT = httpx.Timeout(15.0)


# ─────────────────────────────────────────────────────────────────────────────
# Top-level dispatcher
# ─────────────────────────────────────────────────────────────────────────────

def fetch_content(url: str, url_type: str, milestone_spec: str = "") -> str:
    """
    Route the URL to the correct fetcher based on url_type.
    Always returns a string — never raises.
    For image/figma vision results, returns '__VISION__' prefix + base64 data.
    """
    url_type = (url_type or "").strip().lower()

    fetcher_map = {
        "github":  fetch_github,
        "figma":   fetch_figma,
        "website": fetch_website,
        "pdf":     extract_pdf,
        "image":   fetch_image,
    }

    fetcher = fetcher_map.get(url_type)

    if fetcher is None:
        # unknown type — try scraping as a generic website
        print(f"  [fetchers] Unknown url_type '{url_type}', falling back to website fetcher.")
        fetcher = fetch_website

    try:
        if fetcher == fetch_github:
            result = fetcher(url, milestone_spec=milestone_spec)
        else:
            result = fetcher(url)
        return result if result else "[fetch] No content returned."
    except Exception as exc:  # noqa: BLE001
        return f"[fetch] Unexpected error in {url_type} fetcher: {exc}"


# ─────────────────────────────────────────────────────────────────────────────
# 6.1  GitHub fetcher
# ─────────────────────────────────────────────────────────────────────────────

def _github_headers() -> dict:
    token = os.getenv("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _parse_github_owner_repo(url: str) -> tuple[str, str]:
    """Extract (owner, repo) from a GitHub URL. Raises ValueError on bad format."""
    # Strip trailing .git and path fragments like /tree/main/...
    clean = re.sub(r"\.git$", "", url.rstrip("/"))
    match = re.search(r"github\.com/([^/]+)/([^/?#]+)", clean)
    if not match:
        raise ValueError(f"Cannot parse owner/repo from URL: {url}")
    return match.group(1), match.group(2)


def _resolve_default_branch(owner: str, repo: str, headers: dict) -> str:
    """
    Resolve the default branch for a repo via the GitHub API.
    Falls back to 'main' on any failure.
    """
    try:
        r = httpx.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers,
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json().get("default_branch", "main")
    except Exception:  # noqa: BLE001
        pass
    return "main"


def _fetch_tree(owner: str, repo: str, branch: str, headers: dict) -> Optional[list]:
    """
    Fetch the recursive file tree for a branch.
    Returns list of tree items or None on 404/error.
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    try:
        r = httpx.get(url, headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            return r.json().get("tree", [])
        if r.status_code == 404:
            return None
    except Exception:  # noqa: BLE001
        pass
    return None


def fetch_github(url: str, milestone_spec: str = "") -> str:
    """
    Fetch source files from a public (or token-accessible) GitHub repo.

    Strategy:
      1. Parse owner/repo
      2. Try tree on 'main', then 'master', then repo default branch
      3. Filter files by GITHUB_EXTENSIONS
      4. If milestone_spec is provided, use Scout LLM to pick the most relevant 5-10 files
      5. Prioritise README.md first
      6. Fetch raw content and concatenate up to GITHUB_CAP chars
    """
    print(f"  [github] Fetching: {url}")
    headers = _github_headers()

    try:
        owner, repo = _parse_github_owner_repo(url)
    except ValueError as exc:
        return f"[github] {exc}"

    # Branch fallback chain: main → master → API default
    tree: Optional[list] = None
    resolved_branch = "main"

    for branch in ("main", "master"):
        tree = _fetch_tree(owner, repo, branch, headers)
        if tree is not None:
            resolved_branch = branch
            print(f"  [github] Branch resolved: {branch}")
            break

    if tree is None:
        # Last resort: ask the API for the default branch name
        resolved_branch = _resolve_default_branch(owner, repo, headers)
        if resolved_branch not in ("main", "master"):
            tree = _fetch_tree(owner, repo, resolved_branch, headers)

    if tree is None:
        return "[github] Repository not found or private (checked: main, master, default branch)."

    # Filter to code/doc files only
    code_files = [
        item["path"]
        for item in tree
        if item.get("type") == "blob"
        and any(item["path"].endswith(ext) for ext in GITHUB_EXTENSIONS)
    ]

    if not code_files:
        return "[github] Repository found but contains no recognized source files."

    # README first, everything else second
    readme_files = [p for p in code_files if p.lower() in ("readme.md", "readme.rst", "readme.txt")]
    other_files  = [p for p in code_files if p not in readme_files]
    ordered_files = readme_files + other_files

    if milestone_spec and len(ordered_files) > 5:
        print(f"  [github] {len(ordered_files)} candidate files found. Using AI scout...")
        from llm import run_scout
        selected = run_scout(milestone_spec, ordered_files)
        if selected:
            # ensure valid paths and keep ordering
            selected_set = set(selected)
            for r in readme_files:
                selected_set.add(r)
            ordered_files = [p for p in ordered_files if p in selected_set]

    raw_base = f"https://raw.githubusercontent.com/{owner}/{repo}/{resolved_branch}"
    parts: list[str] = []
    total_chars = 0

    print(f"  [github] Fetching raw content for {len(ordered_files)} files …")

    for path in ordered_files:
        if total_chars >= GITHUB_CAP:
            break
        raw_url = f"{raw_base}/{path}"
        try:
            r = httpx.get(raw_url, headers={"Accept": "text/plain"}, timeout=TIMEOUT)
            if r.status_code == 200:
                snippet = r.text[: GITHUB_CAP - total_chars]
                parts.append(f"=== {path} ===\n{snippet}")
                total_chars += len(snippet)
        except Exception:  # noqa: BLE001
            parts.append(f"=== {path} ===\n[Could not fetch this file]\n")

    combined = "\n\n".join(parts)
    print(f"  [github] Done — {total_chars} chars from {len(parts)} files.")
    return combined[:GITHUB_CAP]


# ─────────────────────────────────────────────────────────────────────────────
# 6.2  Figma fetcher
# ─────────────────────────────────────────────────────────────────────────────

def _extract_figma_key(url: str) -> Optional[str]:
    """
    Extract the file key from URLs like:
      https://www.figma.com/file/{file_key}/...
      https://www.figma.com/design/{file_key}/...
    """
    match = re.search(r"figma\.com/(?:file|design)/([A-Za-z0-9]+)", url)
    return match.group(1) if match else None


def _walk_figma_node(node: dict, lines: list[str], depth: int = 0) -> None:
    """Recursively walk Figma document nodes and collect structural info."""
    indent = "  " * depth
    node_type = node.get("type", "")
    name = node.get("name", "")

    if node_type in ("DOCUMENT", "CANVAS"):
        lines.append(f"{indent}[{node_type}] {name}")
    elif node_type == "FRAME":
        lines.append(f"{indent}  Frame: {name}")
    elif node_type == "COMPONENT":
        lines.append(f"{indent}  Component: {name}")
    elif node_type == "TEXT":
        chars = node.get("characters", "").strip()
        if chars:
            lines.append(f"{indent}  Text: {chars[:200]}")
    elif node_type == "GROUP":
        lines.append(f"{indent}  Group: {name}")
    elif node_type in ("INSTANCE",):
        lines.append(f"{indent}  Instance of: {name}")

    for child in node.get("children", []):
        _walk_figma_node(child, lines, depth + 1)


def fetch_figma(url: str) -> str:
    """
    Fetch Figma file structure via the Figma REST API.
    Requires FIGMA_TOKEN in environment.
    """
    print(f"  [figma] Fetching: {url}")

    token = os.getenv("FIGMA_TOKEN", "").strip()
    if not token:
        return "[figma] Figma token not configured. Set FIGMA_TOKEN in .env and retry."

    file_key = _extract_figma_key(url)
    if not file_key:
        return f"[figma] Cannot extract file key from URL: {url}"

    try:
        r = httpx.get(
            f"https://api.figma.com/v1/files/{file_key}",
            headers={"X-Figma-Token": token},
            timeout=TIMEOUT,
        )
    except httpx.RequestError as exc:
        return f"[figma] Network error: {exc}"

    if r.status_code == 403:
        return "[figma] Access denied — check that your FIGMA_TOKEN has read access to this file."
    if r.status_code == 404:
        return "[figma] Figma file not found. Check the URL and sharing permissions."
    if r.status_code == 429:
        return "[figma] Rate limit exceeded by Figma API. Please wait a minute before trying again."
    if r.status_code != 200:
        return f"[figma] Unexpected status {r.status_code}: {r.text[:300]}"

    data = r.json()
    doc  = data.get("document", {})
    name = data.get("name", "Unknown file")
    last_modified = data.get("lastModified", "")

    lines: list[str] = [
        f"Figma File: {name}",
        f"Last Modified: {last_modified}",
        "",
        "── Document Structure ─────────────────────────────────",
    ]

    _walk_figma_node(doc, lines, depth=0)

    combined = "\n".join(lines)

    # --- Try to export frame images for vision analysis ---
    image_b64_list = _figma_export_images(file_key, doc, token)
    if image_b64_list:
        # Return vision marker + base64 images separated by |||, followed by text structure
        images_payload = "|||".join(image_b64_list)
        print(f"  [figma] Done — {len(image_b64_list)} frame images + {len(combined)} chars of structure.")
        return f"__VISION__{images_payload}__ENDVISION__{combined[:FIGMA_CAP]}"

    print(f"  [figma] Done (text-only) — {len(combined)} chars.")
    return combined[:FIGMA_CAP]


def _figma_export_images(file_key: str, doc: dict, token: str, max_frames: int = 5) -> list[str]:
    """
    Export top-level frames from a Figma file as PNG images (base64).
    Uses the Figma Images API: GET /v1/images/:file_key?ids=...
    Returns a list of base64-encoded PNG strings, or empty list on failure.
    """
    # Collect frame node IDs from the top-level canvases
    frame_ids: list[str] = []
    for canvas in doc.get("children", []):
        for child in canvas.get("children", []):
            if child.get("type") in ("FRAME", "COMPONENT"):
                frame_ids.append(child["id"])
                if len(frame_ids) >= max_frames:
                    break
        if len(frame_ids) >= max_frames:
            break

    if not frame_ids:
        print("  [figma] No top-level frames found for image export.")
        return []

    ids_param = ",".join(frame_ids)
    try:
        r = httpx.get(
            f"https://api.figma.com/v1/images/{file_key}?ids={ids_param}&format=png&scale=1",
            headers={"X-Figma-Token": token},
            timeout=httpx.Timeout(30.0),
        )
        if r.status_code != 200:
            print(f"  [figma] Image export API returned {r.status_code}")
            return []
    except httpx.RequestError as exc:
        print(f"  [figma] Image export network error: {exc}")
        return []

    image_urls = r.json().get("images", {})
    results: list[str] = []

    for node_id, img_url in image_urls.items():
        if not img_url:
            continue
        try:
            img_r = httpx.get(img_url, timeout=httpx.Timeout(15.0))
            if img_r.status_code == 200:
                b64 = base64.b64encode(img_r.content).decode("ascii")
                results.append(b64)
                print(f"  [figma] Exported frame {node_id} — {len(img_r.content)} bytes")
        except Exception:  # noqa: BLE001
            print(f"  [figma] Failed to download image for frame {node_id}")

    return results


# ─────────────────────────────────────────────────────────────────────────────
# 6.3  Website fetcher
# ─────────────────────────────────────────────────────────────────────────────

def fetch_website(url: str) -> str:
    """
    Scrape a public website and return structured plain text.
    Strips scripts/styles, extracts headings, paragraphs, and nav links.
    """
    print(f"  [website] Fetching: {url}")

    # Block obviously non-HTTP schemes
    if not url.startswith(("http://", "https://")):
        return f"[website] Unsupported URL scheme: {url}"

    try:
        from bs4 import BeautifulSoup  # noqa: PLC0415
    except ImportError:
        return "[website] beautifulsoup4 not installed — run: pip install beautifulsoup4"

    try:
        r = httpx.get(
            url,
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; VerifierBot/1.0)"},
        )
    except httpx.RequestError as exc:
        return f"[website] Network error: {exc}"

    if r.status_code != 200:
        return f"[website] HTTP {r.status_code} — could not retrieve page."

    soup = BeautifulSoup(r.text, "html.parser")

    # Remove noise
    for tag in soup(["script", "style", "noscript", "header", "footer", "svg", "iframe"]):
        tag.decompose()

    parts: list[str] = []

    # Title
    title_tag = soup.find("title")
    if title_tag:
        parts.append(f"Title: {title_tag.get_text(strip=True)}")

    # Meta description
    meta_desc = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    if meta_desc and meta_desc.get("content"):
        parts.append(f"Meta Description: {meta_desc['content']}")

    parts.append("")

    # Headings
    headings = soup.find_all(["h1", "h2", "h3"])
    if headings:
        parts.append("── Headings ──")
        for h in headings:
            text = h.get_text(strip=True)
            if text:
                parts.append(f"  {h.name.upper()}: {text}")
        parts.append("")

    # Paragraph text
    paras = [p.get_text(strip=True) for p in soup.find_all("p") if p.get_text(strip=True)]
    if paras:
        parts.append("── Content ──")
        for p in paras[:40]:  # avoid bloating with tiny <p> tags from nav etc.
            parts.append(f"  {p}")
        parts.append("")

    # Nav links (good signal for what the site covers)
    nav_links = []
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        href = a["href"]
        if text and len(text) < 60:
            nav_links.append(f"  {text} → {href}")
    if nav_links:
        parts.append("── Links ──")
        parts.extend(nav_links[:30])

    combined = "\n".join(parts)
    print(f"  [website] Done — {len(combined)} chars.")
    return combined[:WEBSITE_CAP]


# ─────────────────────────────────────────────────────────────────────────────
# 6.4  PDF fetcher
# ─────────────────────────────────────────────────────────────────────────────

def extract_pdf(url: str) -> str:
    """
    Download a PDF from a URL and extract all text using PyMuPDF (fitz).
    """
    print(f"  [pdf] Fetching: {url}")

    try:
        import fitz  # PyMuPDF  # noqa: PLC0415
    except ImportError:
        return "[pdf] PyMuPDF not installed — run: pip install pymupdf"

    if not url.startswith(("http://", "https://")):
        return f"[pdf] Unsupported URL scheme: {url}"

    try:
        r = httpx.get(
            url,
            timeout=httpx.Timeout(30.0),  # PDFs can be slow to download
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; VerifierBot/1.0)"},
        )
    except httpx.RequestError as exc:
        return f"[pdf] Network error: {exc}"

    if r.status_code != 200:
        return f"[pdf] HTTP {r.status_code} — could not download PDF."

    content_type = r.headers.get("content-type", "")
    if "pdf" not in content_type and not url.lower().endswith(".pdf"):
        # Best-effort: still try to parse it as PDF; fitz will error if it isn't
        print("  [pdf] Warning: content-type is not PDF — attempting parse anyway.")

    try:
        doc = fitz.open(stream=r.content, filetype="pdf")
    except Exception as exc:  # noqa: BLE001
        return f"[pdf] Could not open as PDF: {exc}"

    pages: list[str] = []
    total_chars = 0

    for page_num, page in enumerate(doc, start=1):
        if total_chars >= PDF_CAP:
            break
        text = page.get_text("text").strip()
        if text:
            snippet = text[: PDF_CAP - total_chars]
            pages.append(f"── Page {page_num} ──\n{snippet}")
            total_chars += len(snippet)

    doc.close()

    if not pages:
        return "[pdf] PDF opened but no extractable text found (may be a scanned/image PDF)."

    combined = "\n\n".join(pages)
    print(f"  [pdf] Done — {total_chars} chars from {len(pages)} pages.")
    return combined[:PDF_CAP]


# ─────────────────────────────────────────────────────────────────────────────
# 6.5  Image fetcher (direct image URLs — jpg, png, webp)
# ─────────────────────────────────────────────────────────────────────────────

IMAGE_MAX_BYTES = 5 * 1024 * 1024  # 5 MB max per image


def fetch_image(url: str) -> str:
    """
    Download an image from a direct URL and return as base64 with __VISION__ prefix.
    Supports jpg, png, webp.
    """
    print(f"  [image] Fetching: {url}")

    if not url.startswith(("http://", "https://")):
        return f"[image] Unsupported URL scheme: {url}"

    try:
        r = httpx.get(
            url,
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; VerifierBot/1.0)"},
        )
    except httpx.RequestError as exc:
        return f"[image] Network error: {exc}"

    if r.status_code != 200:
        return f"[image] HTTP {r.status_code} — could not download image."

    if len(r.content) > IMAGE_MAX_BYTES:
        return f"[image] Image too large ({len(r.content)} bytes, max {IMAGE_MAX_BYTES})."

    b64 = base64.b64encode(r.content).decode("ascii")
    print(f"  [image] Done — {len(r.content)} bytes downloaded, base64 encoded.")
    return f"__VISION__{b64}__ENDVISION__Image from {url}"

"""Shared helpers for CampusProof Python scripts (owner: P3).

- wm_get(): the only way to call Wikimedia APIs (User-Agent + cache + Retry-After).
- serper_images(): cached web image search (saves free credits).
- read_ts_prompt(): reads the canonical vision prompt from lib/vision/prompt.ts, so Python spikes
  and the TypeScript app always use the same text.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parents[1]
CACHE_DIR = SCRIPTS_DIR / ".cache"

load_dotenv(REPO_ROOT / ".env.local")

WIKIMEDIA_UA = os.environ.get(
    "WIKIMEDIA_USER_AGENT",
    "CampusProof/0.1 (https://github.com/Amir10202010/campusproof)",
)

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WDQS_SPARQL = "https://query.wikidata.org/sparql"

_session = requests.Session()
_session.headers.update({"User-Agent": WIKIMEDIA_UA, "Api-User-Agent": WIKIMEDIA_UA})


def _cache_path(namespace: str, payload: Any) -> Path:
    digest = hashlib.sha1(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return CACHE_DIR / namespace / f"{digest}.json"


def wm_get(url: str, params: dict[str, Any] | None = None, *, use_cache: bool = True, timeout: float = 30.0) -> dict:
    """GET a Wikimedia endpoint with the required User-Agent, on-disk cache and 429 handling."""
    params = {"format": "json", **(params or {})}
    path = _cache_path("wikimedia", [url, params])
    if use_cache and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    for _ in range(4):
        response = _session.get(url, params=params, timeout=timeout)
        if response.status_code == 429:
            time.sleep(min(float(response.headers.get("Retry-After", "5")), 30.0))
            continue
        response.raise_for_status()
        data = response.json()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        time.sleep(0.35)  # stay far below 200 requests/minute
        return data
    raise RuntimeError(f"Wikimedia kept returning 429 for {url}")


def serper_images(query: str, *, gl: str = "kz", hl: str = "ru", num: int = 10, use_cache: bool = True) -> dict:
    """Web image search via Serper (1 credit per request with ≤10 results). Cached on disk."""
    payload = {"q": query, "gl": gl, "hl": hl, "num": num}
    path = _cache_path("serper", payload)
    if use_cache and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    api_key = os.environ.get("SERPER_API_KEY")
    if not api_key:
        raise RuntimeError("SERPER_API_KEY is missing in .env.local")
    response = requests.post(
        "https://google.serper.dev/images",
        headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def read_ts_prompt(name: str = "VISION_SYSTEM_PROMPT") -> str:
    """Extract `export const <name> = `...`;` from lib/vision/prompt.ts."""
    source = (REPO_ROOT / "lib" / "vision" / "prompt.ts").read_text(encoding="utf-8")
    match = re.search(rf"export const {name}\s*=\s*`([\s\S]*?)`;", source)
    if not match:
        raise RuntimeError(f"{name} not found in lib/vision/prompt.ts")
    return match.group(1)


def write_json(path: str | Path, data: Any) -> Path:
    target = REPO_ROOT / path if not Path(path).is_absolute() else Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return target

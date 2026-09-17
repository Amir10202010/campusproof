"""Spike S4 — which FREE Gemini model should the pipeline use for vision?

Owner: P3 · Issue #22 · Needs: GEMINI_API_KEY (free tier, Google AI Studio) · Spec: docs/architecture.md §5.5

Input: eval/spike_vision/labels.json — 36 labeled images (collect them from real S2/S3 results; include traps:
stock photos, renders, logos/maps, photos of OTHER universities):
  [{"id": "img_01", "path": "eval/spike_vision/img_01.jpg", "university": "Satbayev University",
    "city": "Almaty", "true_category": "library", "belongs": true, "trap": null}, ...]

For each candidate model: send the images in batches of 12 (exactly like the app: LIMITS.VISION_BATCH_SIZE),
3 runs for latency, and measure:
  - category accuracy on images with belongs=true
  - trap catch rate (image_type != photo, stock_like, names_institution == "other")
  - names_institution correctness
  - p50 / p90 latency per 12-image batch
  - prompt/output tokens per batch (response.usage_metadata)
Also open https://aistudio.google.com/rate-limit and write down the free RPM / RPD of each model for OUR project.
Decision rule: the most accurate model whose p90 batch latency is ≤ 8 s AND whose free RPD allows ≥ 150 profiles/day
(3 requests per profile). Write the decision into docs/spikes.md; tell P1 (Amir) the value for VISION_MODEL in Vercel.

Free quota is small: runs are cached on disk (.cache/vision/) — re-running the script doesn't spend requests.
Free tier data may be used by Google to improve products — only public web photos go here, nothing personal.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import time
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

from common import CACHE_DIR, REPO_ROOT, read_ts_prompt, write_json

# Verify the list against https://ai.google.dev/gemini-api/docs/models (free tier: .../pricing)
CANDIDATE_MODELS = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-2.5-flash"]
BATCH_SIZE = 12
LONG_EDGE_PX = 640
RUNS = 3

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])  # loaded from .env.local by common.py


def jpeg_bytes(path: Path) -> bytes:
    """Resize to 640 px long edge, JPEG — the same input the TypeScript pipeline sends."""
    image = Image.open(path).convert("RGB")
    image.thumbnail((LONG_EDGE_PX, LONG_EDGE_PX))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def run_batch(model: str, batch: list[dict], context: str, run: int) -> tuple[list[dict], float, dict]:
    """One vision request. Cached per (model, images, run) so re-runs cost nothing."""
    key = hashlib.sha1(json.dumps([model, [b["id"] for b in batch], run]).encode()).hexdigest()
    cache_file = CACHE_DIR / "vision" / f"{key}.json"
    if cache_file.exists():
        cached = json.loads(cache_file.read_text(encoding="utf-8"))
        return cached["images"], cached["seconds"], cached["usage"]

    contents: list = []
    for item in batch:
        contents.append(f"Image {item['id']}:")
        contents.append(types.Part.from_bytes(data=jpeg_bytes(REPO_ROOT / item["path"]), mime_type="image/jpeg"))
    contents.append(context)

    started = time.perf_counter()
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=read_ts_prompt("VISION_SYSTEM_PROMPT"),
            response_mime_type="application/json",
            response_json_schema=json.loads(read_ts_prompt("VISION_OUTPUT_JSON_SCHEMA")),
            media_resolution=types.MediaResolution.MEDIA_RESOLUTION_MEDIUM,  # also try LOW: fewer tokens
        ),
    )
    seconds = time.perf_counter() - started
    usage = {
        "prompt_tokens": response.usage_metadata.prompt_token_count,
        "output_tokens": response.usage_metadata.candidates_token_count,
    }
    images = json.loads(response.text)["images"]
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps({"images": images, "seconds": seconds, "usage": usage}), encoding="utf-8")
    return images, seconds, usage


def main() -> None:
    labels = json.loads((REPO_ROOT / "eval/spike_vision/labels.json").read_text(encoding="utf-8"))
    results = {}
    for model in CANDIDATE_MODELS:
        # TODO(P3): group labels by university; context text = university name/city + "which university to check";
        #           batches of 12; RUNS runs; catch 429 (quota) → record and move on; compute the metrics listed above.
        results[model] = {}
    write_json("eval/spikes/s4_vision.json", results)


if __name__ == "__main__":
    main()

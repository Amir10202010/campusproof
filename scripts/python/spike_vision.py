"""Spike S4 — which vision model should the pipeline use?

Owner: P3 · Deadline: T+6 (16:00) · Needs: ANTHROPIC_API_KEY · Spec: docs/architecture.md §5.5, §16 (S4)

Input: eval/spike_vision/labels.json — 40 labeled images (collect them in the morning from real
S2/S3 results; include traps: stock photos, renders, logos/maps, photos of OTHER universities):
  [{"id": "img_01", "path": "eval/spike_vision/img_01.jpg", "university": "Satbayev University",
    "city": "Almaty", "true_category": "library", "belongs": true, "trap": null}, ...]

For each candidate model: send the 40 images in batches of 8 (5 runs for latency), measure:
  - category accuracy on images with belongs=true
  - trap catch rate (image_type != photo, stock_like, names_institution == "other")
  - names_institution correctness
  - p50 / p90 latency per 8-image batch
  - input/output tokens → cost per profile (40 images) using docs/architecture.md §14 prices
Decision rule: the most accurate model whose p90 batch latency is ≤ 8 s. Write it into docs/spikes.md.
"""

from __future__ import annotations

import base64
import io
import json
import time
from pathlib import Path

import anthropic
from PIL import Image

from common import REPO_ROOT, read_ts_prompt, write_json

CANDIDATE_MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"]
BATCH_SIZE = 8
LONG_EDGE_PX = 640

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY (loaded from .env.local by common.py)


def image_block(path: Path) -> dict:
    """Resize to 640 px long edge, JPEG, base64 — the same input the TS pipeline will send."""
    image = Image.open(path).convert("RGB")
    image.thumbnail((LONG_EDGE_PX, LONG_EDGE_PX))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    data = base64.standard_b64encode(buffer.getvalue()).decode()
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}}


def model_options(model: str) -> dict:
    """Latency-oriented settings per model (see docs/architecture.md §5.5)."""
    if model == "claude-opus-5":
        return {"output_config_extra": {"effort": "low"}}
    if model == "claude-sonnet-5":
        return {"thinking": {"type": "disabled"}}
    return {}  # claude-haiku-4-5: no thinking by default; effort is not supported


def run_batch(model: str, batch: list[dict], context: str, schema: dict) -> tuple[list[dict], float, dict]:
    content: list[dict] = []
    for item in batch:
        content.append({"type": "text", "text": f"Image {item['id']}:"})
        content.append(image_block(REPO_ROOT / item["path"]))
    content.append({"type": "text", "text": context})

    options = model_options(model)
    output_config = {"format": {"type": "json_schema", "schema": schema}, **options.pop("output_config_extra", {})}
    started = time.perf_counter()
    response = client.messages.create(
        model=model,
        max_tokens=4000,
        system=read_ts_prompt("VISION_SYSTEM_PROMPT"),
        messages=[{"role": "user", "content": content}],
        output_config=output_config,
        **options,
    )
    elapsed = time.perf_counter() - started
    text = next(block.text for block in response.content if block.type == "text")
    usage = {"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens}
    return json.loads(text)["images"], elapsed, usage


def main() -> None:
    labels = json.loads((REPO_ROOT / "eval/spike_vision/labels.json").read_text(encoding="utf-8"))
    schema = json.loads(read_ts_prompt("VISION_OUTPUT_JSON_SCHEMA"))
    results = {}
    for model in CANDIDATE_MODELS:
        # TODO(P3): batches of 8; context text = university name/city + category definitions;
        #           repeat 5 times for latency; compute the metrics listed in the docstring.
        results[model] = {}
    write_json("eval/spikes/s4_vision.json", results)


if __name__ == "__main__":
    main()

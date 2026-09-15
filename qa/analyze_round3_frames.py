from __future__ import annotations

import json
import math
from pathlib import Path
from statistics import mean

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent / "round3-frames"
PHASES = ("opening-to-dark", "dark-to-weight", "weight-to-resolve")


def load_small(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGB").resize((240, 150), Image.Resampling.LANCZOS)


def luminance(image: Image.Image) -> float:
    r, g, b = ImageStat.Stat(image).mean
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def rmse(left: Image.Image, right: Image.Image) -> float:
    diff = ImageChops.difference(left, right)
    squared = sum(value * value for value in ImageStat.Stat(diff).rms)
    return math.sqrt(squared / 3)


def reference_luminance(name: str) -> float:
    path = ROOT.parents[1] / "img" / name
    return luminance(load_small(path))


def phase_metrics(name: str) -> dict:
    paths = sorted((ROOT / name).glob("[0-9][0-9].png"))
    if len(paths) != 24:
        raise AssertionError(f"{name}: expected 24 frames, found {len(paths)}")
    frames = [load_small(path) for path in paths]
    lumas = [luminance(frame) for frame in frames]
    deltas = [rmse(frames[index - 1], frames[index]) for index in range(1, len(frames))]
    delta_jerk = [abs(deltas[index] - deltas[index - 1]) for index in range(1, len(deltas))]
    return {
        "frame_count": len(paths),
        "luminance": {"first": lumas[0], "min": min(lumas), "max": max(lumas), "last": lumas[-1]},
        "frame_rmse": {"mean": mean(deltas), "max": max(deltas), "max_step_change": max(delta_jerk)},
    }


def main() -> None:
    metrics = {name: phase_metrics(name) for name in PHASES}
    approach_luma = reference_luminance("corridor-approach.webp")
    between_luma = reference_luminance("corridor-between.webp")

    opening_first = metrics["opening-to-dark"]["luminance"]["first"]
    darkest = min(item["luminance"]["min"] for item in metrics.values())
    assertions = {
        "24_frames_per_transition": all(item["frame_count"] == 24 for item in metrics.values()),
        "opening_is_light": opening_first >= approach_luma * 0.70,
        "no_frame_below_corridor_floor": darkest >= between_luma * 0.50,
        "no_single_frame_discontinuity": all(
            item["frame_rmse"]["max_step_change"] < 22 for item in metrics.values()
        ),
    }
    result = {
        "references": {"approach_luminance": approach_luma, "between_luminance": between_luma},
        "phases": metrics,
        "assertions": assertions,
        "pass": all(assertions.values()),
        "note": "Sphere shape is gated separately by exact rendered plane aspect equality in the browser scrub metrics.",
    }
    output = ROOT / "round3-frame-analysis.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result["pass"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

"""Corridor v3 QA: measure mean luminance and highlight-clip fraction on a
captured frame PNG (from qa/scrub_corridor_v3.js output), for checking against
the opening-exposure acceptance criteria (mean luma 95-115 at t=0, <1% pixels
above luma 240).

Usage: python3 qa/check_frame_luma.py qa/corridor-v3-frames/t0.png [...]
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image
import numpy as np


def frame_luma(path: Path) -> tuple[float, float]:
    im = Image.open(path).convert('RGB')
    arr = np.asarray(im).astype(float)
    luma = 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]
    return luma.mean(), (luma > 240).mean()


def main() -> None:
    paths = sys.argv[1:] or ['qa/corridor-v3-frames/t0.png']
    for p in paths:
        mean_luma, frac_over_240 = frame_luma(Path(p))
        print(f"{p}: mean_luma={mean_luma:.1f} frac_over_240={frac_over_240 * 100:.3f}%")


if __name__ == '__main__':
    main()

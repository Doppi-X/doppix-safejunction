"""Vehicle speeds from a 4-point ground calibration (built during the final).

The engineer clicks the corners of a rectangle on the road whose size is known (a zebra crossing,
a lane between markings) and types its width and length in metres. A homography maps image foot
points onto that ground plane, so distances and speeds are in metres and km/h.

Reported like a speed survey: mean, median and 85th-percentile speed of moving vehicles, and the
share over the limit and over limit + 10 km/h. The 85th percentile is the usual basis for setting
and checking speed limits (ITE).
Pedestrian fatality risk rises steeply with impact speed (SWOV), which is why these numbers matter.

Accuracy depends on the clicked rectangle and on the box foot point, so treat values as estimates
(roughly ±10–15 %, not measured against radar). Only samples near the calibrated area are used,
because a homography extrapolates badly far from its four points.
"""
from __future__ import annotations

import cv2
import numpy as np

from . import config
from .autoscene import Track, frame_size
from .perception import Perception

MIN_SPAN_S = 1.0          # a vehicle needs this much time inside the calibrated area
WINDOW_S = 1.0            # speed over 1 s displacement
MOVING_KMH = 5.0          # slower = queued, not part of the free-flow statistics
REGION_SCALE = 2.0        # use samples within the calibration quad scaled ×2 around its centre


def homography(p: Perception, calib: dict) -> tuple[np.ndarray, np.ndarray] | None:
    pts = np.asarray(calib.get("points") or [], dtype=np.float32)
    w, l = float(calib.get("width_m") or 0), float(calib.get("length_m") or 0)
    if pts.shape != (4, 2) or w <= 0 or l <= 0:
        return None
    W, H = frame_size(p)
    src = pts * [W, H]
    dst = np.float32([[0, 0], [w, 0], [w, l], [0, l]])
    c = src.mean(0)
    region = (c + (src - c) * REGION_SCALE).astype(np.float32)
    return cv2.getPerspectiveTransform(src.astype(np.float32), dst), region


def measure(p: Perception, tracks: list[Track], calib: dict) -> dict | None:
    hr = homography(p, calib)
    if hr is None:
        return None
    Hm, region = hr
    limit = float(calib.get("limit_kmh") or 60)
    per_track = []
    for t in tracks:
        if t.cls not in config.VEHICLES or len(t.t) < 5:
            continue
        foot = t.foot.astype(np.float32)
        keep = np.array([cv2.pointPolygonTest(region.reshape(-1, 1, 2), (float(x), float(y)), False) >= 0 for x, y in foot])
        if keep.sum() < 5 or t.t[keep][-1] - t.t[keep][0] < MIN_SPAN_S:
            continue
        g = cv2.perspectiveTransform(foot[keep].reshape(-1, 1, 2), Hm).reshape(-1, 2)
        ts = t.t[keep]
        # rolling median of the ground position (5 samples ≈ 0.5 s) removes box jitter
        k = 2
        gs = np.array([np.median(g[max(0, i - k):i + k + 1], axis=0) for i in range(len(g))])
        sp, j = [], 0
        for i in range(len(ts)):
            while ts[i] - ts[j] > WINDOW_S:
                j += 1
            if ts[i] - ts[j] >= 0.6 * WINDOW_S:
                sp.append(np.linalg.norm(gs[i] - gs[j]) / (ts[i] - ts[j]) * 3.6)
        if sp:
            per_track.append((int(t.tid), float(np.median(sp))))
    moving = np.array([v for _, v in per_track if v >= MOVING_KMH])
    if not len(moving):
        return {"vehicles": 0, "limit_kmh": limit, "per_track": per_track, "note": "no moving vehicle crossed the calibrated area"}
    return {
        "vehicles": int(len(moving)), "limit_kmh": limit,
        "mean_kmh": round(float(moving.mean()), 1), "median_kmh": round(float(np.median(moving)), 1),
        "p85_kmh": round(float(np.percentile(moving, 85)), 1), "max_kmh": round(float(moving.max()), 1),
        "share_over_limit": round(float((moving > limit).mean()), 3),
        "share_over_limit_10": round(float((moving > limit + 10).mean()), 3),
        "histogram": np.histogram(moving, bins=np.arange(0, max(90, moving.max() + 10), 10))[0].tolist(),
        "per_track": [[i, round(v, 1)] for i, v in per_track],
        "method": "4-point homography; median of 1 s displacements per vehicle; estimates, not radar-checked",
    }

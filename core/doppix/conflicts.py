"""Post-encroachment time (PET) conflicts (built during the final).

PET is the surrogate safety measure used by city video-safety studies (e.g. Bellevue WA with
Brisk Synergies / AMAG): the time between one road user LEAVING a spot and another ARRIVING at it.
No crash is needed; small PET means the two missed each other by a fraction of a second.

Severity bins follow Bellevue's screening study: < 1.5 s serious (driver reaction time),
1.5–3 s moderate, 3–5 s interaction (FHWA SSAM's upper limit is 5 s).

Image-plane version (no calibration): the frame is cut into small cells; a pedestrian occupies the
cell of its foot point, a vehicle the cells under the lower quarter of its box (its ground footprint).
Only cells on the learned carriageway count, so a pedestrian on the pavement behind a car is not a
conflict. Riders (a person moving inside a motorcycle/bicycle box) are not pedestrians. Pairs: pedestrian/bicycle vs vehicle, and vehicle vs vehicle only when their headings
differ by more than 30° (excludes car-following). A pair needs a MOVING vehicle; overlapping
occupancy (both in the cell at the same time) is an image-plane overlap, not a conflict.

Exposure for ranking: pedestrians and vehicles that entered the carriageway (Bellevue reports
conflicts per 1,000 road users).
"""
from __future__ import annotations

import numpy as np

from . import config
from .autoscene import MOVING_REL, FlowField, Track, drivable_mask, frame_size
from .perception import Perception

CELLS_W = 64                 # PET cells across the frame (30 px at FRAME_W = 1920)
GAP = 0.35                   # s: occupancy samples closer than this belong to one visit
MAX_PET = 5.0
BINS = [("serious", 1.5), ("moderate", 3.0), ("interaction", 5.0)]
VRU = (config.PERSON, config.BICYCLE)
FOOT_H = 0.15                # lower share of a vehicle box taken as its ground footprint
VRU_MOVING = 0.6             # VRU speed in body heights / s: waiting at the kerb is not a conflict
ROAD_MIN = 8                 # moving-vehicle samples for a cell to count as carriageway


def severity(pet: float) -> str:
    return next(name for name, hi in BINS if pet < hi)


def _visits(track: Track, cell: float, gw: int, gh: int, road: np.ndarray, rf: float) -> dict:
    """cell -> list of (t_in, t_out) when this track occupied it (on the carriageway only)."""
    occ: dict[tuple[int, int], list[float]] = {}
    for t, (x1, y1, x2, y2) in zip(track.t, track.box):
        if track.cls in VRU:
            pts = [((x1 + x2) / 2, y2)]
        else:
            ys = np.linspace(y2 - FOOT_H * (y2 - y1), y2, 3)
            m = 0.15 * (x2 - x1)
            xs = np.arange(x1 + m + cell / 2, x2 - m, cell) if x2 - x1 - 2 * m > cell else [(x1 + x2) / 2]
            pts = [(x, y) for x in xs for y in ys]
        seen = set()
        for x, y in pts:
            cx, cy = int(x // cell), int(y // cell)
            if 0 <= cx < gw and 0 <= cy < gh and (cx, cy) not in seen and road[min(int(y // rf), road.shape[0] - 1), min(int(x // rf), road.shape[1] - 1)]:
                seen.add((cx, cy))
                occ.setdefault((cx, cy), []).append(float(t))
    out = {}
    for c, ts in occ.items():
        ts.sort()
        iv, s = [], ts[0]
        for a, b in zip(ts, ts[1:]):
            if b - a > GAP:
                iv.append((s, a))
                s = b
        iv.append((s, ts[-1]))
        out[c] = iv
    return out


def _heading(track: Track, t0: float, t1: float) -> np.ndarray | None:
    m = (track.t >= t0 - 0.5) & (track.t <= t1 + 0.5)
    f = track.foot[m]
    if len(f) < 2:
        return None
    d = f[-1] - f[0]
    n = np.linalg.norm(d)
    return d / n if n > 1e-6 else None


def _moving(track: Track, t0: float, t1: float) -> bool:
    m = (track.t >= t0 - 0.7) & (track.t <= t1 + 0.7)
    if m.sum() < 2:
        return False
    f, t = track.foot[m], track.t[m]
    speed = np.linalg.norm(f[-1] - f[0]) / max(t[-1] - t[0], 1e-6)
    if track.cls in VRU:     # scale by body height: a walking person moves ~1 height per second
        return speed / max(float(np.median(track.box[m, 3] - track.box[m, 1])), 1.0) > VRU_MOVING
    return speed / max(float(np.median(track.size[m])), 1.0) > MOVING_REL


def riders(tracks: list[Track]) -> set[int]:
    """Person tracks that are the rider of a motorcycle/bicycle (they move inside its box)."""
    two = [t for t in tracks if t.cls in (config.MOTORCYCLE, config.BICYCLE)]
    out = set()
    for pt in (t for t in tracks if t.cls == config.PERSON):
        for b in two:
            common, ia, ib = np.intersect1d(np.round(pt.t, 2), np.round(b.t, 2), return_indices=True)
            if len(common) < 3:
                continue
            pb, bb = pt.box[ia], b.box[ib]
            cx = (pb[:, 0] + pb[:, 2]) / 2
            inside = (cx > bb[:, 0]) & (cx < bb[:, 2]) & (pb[:, 3] > bb[:, 1]) & (pb[:, 3] < bb[:, 3] + 0.1 * (bb[:, 3] - bb[:, 1]))
            if inside.mean() >= 0.5:
                out.add(pt.tid)
                break
    return out


def detect(p: Perception, tracks: list[Track], ff: FlowField) -> tuple[list[dict], dict]:
    W, H = frame_size(p)
    cell = W / CELLS_W
    gw, gh = CELLS_W, int(np.ceil(H / cell))
    # short clips have few passing vehicles: scale the carriageway threshold with clip length (2..8)
    road = drivable_mask(ff, min_count=int(np.clip(round(p.duration / 30), 2, ROAD_MIN)))
    rid = riders(tracks)
    tracks = [t for t in tracks if t.tid not in rid]
    by_id = {t.tid: t for t in tracks}
    users = [t for t in tracks if t.cls in VRU or t.cls in config.VEHICLES]
    visits = {t.tid: _visits(t, cell, gw, gh, road, ff.cell) for t in users}

    cells: dict[tuple[int, int], list] = {}
    for tid, v in visits.items():
        for c, iv in v.items():
            for a, b in iv:
                cells.setdefault(c, []).append((a, b, tid))

    best: dict[tuple[int, int], dict] = {}
    for c, lst in cells.items():
        lst.sort()
        for i, (a1, b1, t1) in enumerate(lst):
            for a2, b2, t2 in lst[i + 1:]:
                if a2 - b1 >= MAX_PET:
                    break
                if t1 == t2 or a2 <= b1:          # same user, or both there at once (image overlap)
                    continue
                A, B = by_id[t1], by_id[t2]       # A leaves, then B arrives
                veh_a, veh_b = A.cls in config.VEHICLES, B.cls in config.VEHICLES
                if not (veh_a or veh_b):
                    continue
                if veh_a and veh_b:
                    ha, hb = _heading(A, a1, b1), _heading(B, a2, b2)
                    if ha is None or hb is None or float(ha @ hb) > np.cos(np.radians(30)):
                        continue
                if not _moving(A, a1, b1) or not _moving(B, a2, b2):
                    continue
                pet = a2 - b1
                key = (min(t1, t2), max(t1, t2))
                if key not in best or pet < best[key]["pet"]:
                    vru = A if not veh_a else B if not veh_b else None
                    best[key] = {"t": round(a2, 2), "pet": round(pet, 2), "severity": severity(pet),
                                 "first": config.CLASS_NAMES[A.cls], "second": config.CLASS_NAMES[B.cls],
                                 "kind": "vehicle-vehicle" if vru is None else f"{config.CLASS_NAMES[vru.cls]}-vehicle",
                                 "tids": [int(t1), int(t2)],
                                 "x": round((c[0] + 0.5) * cell / W, 3), "y": round((c[1] + 0.5) * cell / H, 3)}
    conflicts = sorted(best.values(), key=lambda d: d["t"])

    peds = sum(1 for t in tracks if t.cls in VRU and visits.get(t.tid))
    vehs = sum(1 for t in tracks if t.cls in config.VEHICLES and visits.get(t.tid))
    counts = {name: sum(1 for c in conflicts if c["severity"] == name) for name, _ in BINS}
    vru_serious = sum(1 for c in conflicts if c["severity"] == "serious" and c["kind"] != "vehicle-vehicle")
    summary = {"counts": counts, "exposure_pedestrians": peds, "exposure_vehicles": vehs,
               "vru_serious": vru_serious,
               "serious_per_1000_pedestrians": round(1000 * vru_serious / peds, 1) if peds else None,
               "serious_per_1000_road_users": round(1000 * counts["serious"] / max(1, peds + vehs), 1),
               "method": "PET image-plane, carriageway cells only; bins <1.5 / 1.5-3 / 3-5 s (Bellevue WA screening)"}
    return conflicts, summary

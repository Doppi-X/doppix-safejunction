"""Scene-agnostic event rules on top of the learned scene (built during the final).

They need no drawn zones, so they run on any fixed traffic camera, including the
video the jury hands us:

* wrong_way       a vehicle moving against the learned flow of the lane it is in
* stopped_vehicle a vehicle stationary >= 10 s in the learned carriageway while traffic
                  around it keeps moving (not parked at the kerb, not in a queue)
* congestion      most vehicles in view crawling or stopped for >= 8 s
* near_miss       the calibrated time-to-collision risk (risk.py) crossing 0.5

Zone-based rules (red_light, stop_line, jaywalking, failure_to_yield) still need a
scene: either our reference intersection or zones drawn in the web app.
"""
from __future__ import annotations

import numpy as np

from . import config, risk
from .autoscene import MOVING_REL, FlowField, Track, build_tracks, drivable_mask, frame_size, learn_flow
from .perception import Perception
from .segments import finalize, mask_to_intervals, merge

G = {
    # wrong_way
    "ww_min_cell_count": 12,     # learned cell must have this many moving samples (leave-one-out)
    "ww_min_consistency": 0.75,  # |mean unit vector| in that cell: one clear direction
    "ww_cos": -0.6,              # moving against it: cos(angle) below this
    "ww_min_share": 0.6,         # share of the track's confident moving samples that are opposite
    "ww_min_samples": 10,        # ~1 s of confident opposite samples at 10 fps
    "ww_min_travel": 3.0,        # box sizes travelled against the flow (turns and jitter stay below)
    "ww_min_sec": 2.5,           # seconds against the flow
    # stopped_vehicle
    "sv_still_rel": 0.12,        # box sizes per second: "stationary"
    "sv_min_sec": 10.0,
    "sv_lane_count": 8,          # moving vehicles must use this spot (it is a lane, not a kerb)
    "sv_queue_radius": 2.5,      # box sizes: another still vehicle this close = a queue
    # congestion
    "cg_slow_rel": 0.25,
    "cg_min_vehicles": 4,
    "cg_min_share": 0.6,
    "cg_min_sec": 8.0,
}


def wrong_way(tracks: list[Track], ff: FlowField) -> list[tuple[float, float, int]]:
    out = []
    for tr in tracks:
        if tr.cls not in config.VEHICLES or tr.tid not in ff.by_track:
            continue
        vec, cnt = ff.without(tr.tid)
        v = tr.velocity()
        sp = np.linalg.norm(v, axis=1)
        moving = sp / np.maximum(tr.size, 1) > MOVING_REL
        if moving.sum() < G["ww_min_samples"]:
            continue
        cells = ff.cell_of(tr.foot)
        cv, cc = vec[cells[:, 1], cells[:, 0]], cnt[cells[:, 1], cells[:, 0]]
        consistency = np.linalg.norm(cv, axis=1) / np.maximum(cc, 1)
        confident = moving & (cc >= G["ww_min_cell_count"]) & (consistency >= G["ww_min_consistency"])
        if confident.sum() < G["ww_min_samples"]:
            continue
        dom = cv / np.maximum(np.linalg.norm(cv, axis=1, keepdims=True), 1e-9)
        cos = (v * dom).sum(1) / np.maximum(sp, 1e-9)
        opposite = confident & (cos < G["ww_cos"])
        if opposite.sum() / confident.sum() < G["ww_min_share"]:
            continue
        idx = np.nonzero(opposite)[0]
        if len(idx) < G["ww_min_samples"]:
            continue
        travel = np.linalg.norm(tr.foot[idx[-1]] - tr.foot[idx[0]]) / np.median(tr.size[idx])
        if travel >= G["ww_min_travel"] and tr.t[idx[-1]] - tr.t[idx[0]] >= G["ww_min_sec"]:
            out.append((float(tr.t[idx[0]]), float(tr.t[idx[-1]]), tr.tid))
    return out


def stopped_and_congestion(tracks: list[Track], ff: FlowField, times: np.ndarray):
    veh = [tr for tr in tracks if tr.cls in config.VEHICLES]
    lane = drivable_mask(ff, G["sv_lane_count"])
    # per processed frame: which vehicles are present / still / slow
    t_index = {round(float(t), 3): i for i, t in enumerate(times)}
    present = np.zeros(len(times)); slow = np.zeros(len(times))
    still_pos: dict[int, list] = {}
    rel_speed = {}
    for tr in veh:
        rs = np.linalg.norm(tr.velocity(2.0), axis=1) / np.maximum(tr.size, 1)
        rel_speed[tr.tid] = rs
        for t, r, f, s in zip(tr.t, rs, tr.foot, tr.size):
            i = t_index.get(round(float(t), 3))
            if i is None:
                continue
            present[i] += 1
            slow[i] += r < G["cg_slow_rel"]
            if r < G["sv_still_rel"]:
                still_pos.setdefault(i, []).append((tr.tid, f, s))
    cong_mask = (slow >= G["cg_min_vehicles"]) & (slow >= G["cg_min_share"] * np.maximum(present, 1))
    congestion = [(s, e) for s, e in merge(mask_to_intervals(times, cong_mask), 2.0) if e - s >= G["cg_min_sec"]]

    stopped = []
    for tr in veh:
        rs = rel_speed[tr.tid]
        cells = ff.cell_of(tr.foot)
        in_lane = lane[cells[:, 1], cells[:, 0]]
        alone = np.ones(len(tr.t), bool)
        for k, (t, f, s) in enumerate(zip(tr.t, tr.foot, tr.size)):
            i = t_index.get(round(float(t), 3))
            near = [1 for tid, g, _ in still_pos.get(i, []) if tid != tr.tid and np.linalg.norm(g - f) < G["sv_queue_radius"] * s]
            alone[k] = len(near) == 0
        m = (rs < G["sv_still_rel"]) & in_lane & alone
        for s, e in merge(mask_to_intervals(tr.t, m), 1.5):
            if e - s >= G["sv_min_sec"] and not any(min(e, ce) - max(s, cs) > 0.5 * (e - s) for cs, ce in congestion):
                stopped.append((s, e, tr.tid))
    return stopped, congestion


def near_miss(p: Perception, theta: float = 0.5) -> list[tuple[float, float]]:
    curve = np.array(risk.replay(p))
    if not len(curve):
        return []
    return [(s, e) for s, e in merge(mask_to_intervals(curve[:, 0], curve[:, 1] >= theta), 2.0)]


def detect(p: Perception):
    """Events, the track ids behind each, and the learned scene (for display)."""
    tracks = build_tracks(p)
    ff = learn_flow(p, tracks)
    dur = p.duration
    events, involved = [], []
    ww = wrong_way(tracks, ff)
    sv, cg = stopped_and_congestion(tracks, ff, p.times)
    groups = [("wrong_way", [(s, e) for s, e, _ in ww], ww, 1.0),
              ("stopped_vehicle", [(s, e) for s, e, _ in sv], sv, 2.0),
              ("congestion", cg, [], 3.0),
              ("near_miss", near_miss(p), [], 1.0)]
    for label, ivs, who, gap in groups:
        for s, e in finalize(ivs, dur, min_len=0.5, gap=gap):
            events.append([s, e, label])
            involved.append(sorted({tid for a, b, tid in who if a < e and b > s}))
    order = np.argsort([e[0] for e in events], kind="stable")
    return [events[i] for i in order], [involved[i] for i in order], ff


def flow_json(ff: FlowField, p: Perception) -> dict:
    """Learned scene for the web app: cell size, counts, unit directions, consistency."""
    W, H = frame_size(p)
    mean = ff.vec / np.maximum(ff.count[..., None], 1)
    return {"gw": ff.gw, "gh": ff.gh, "cell_w": ff.cell / W, "cell_h": ff.cell / H,
            "count": ff.count.astype(int).tolist(),
            "dir": np.round(mean, 2).tolist()}

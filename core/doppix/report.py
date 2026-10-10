"""City-facing report: what happened, where, and what to change (built during the final).

Recommendations are fixed rules over measured numbers, not an LLM: each one names
the statistic that triggered it, so an engineer can check it against the video.
"""
from __future__ import annotations

import numpy as np

from .autoscene import FlowField, build_tracks, frame_size
from .perception import Perception

NAMES = {
    "red_light": "red-light running", "stop_line": "stop-line violations", "jaywalking": "pedestrians on the roadway",
    "failure_to_yield": "vehicles not yielding to pedestrians", "stopped_vehicle": "stopped vehicles",
    "congestion": "congestion", "wrong_way": "wrong-way driving", "near_miss": "near misses",
}


SEVERITY = {"red_light": 3, "wrong_way": 3, "failure_to_yield": 3, "near_miss": 3, "jaywalking": 2,
            "stop_line": 1, "stopped_vehicle": 1, "congestion": 1}


def summary_row(doc: dict, **meta) -> dict:
    """One camera in the city dashboard: counts, rates per 10 min, risk index, hotspots. No pixels."""
    rep = doc.get("report") or {}
    per = rep.get("per_class", {})
    minutes = max(doc["duration"] / 60, 1e-6)
    return {**meta, "duration_s": doc["duration"], "mode": doc.get("scene_mode"),
            "counts": {k: v["count"] for k, v in per.items()},
            "per_10min": {k: round(v["count"] / minutes * 10, 1) for k, v in per.items()},
            "risk_index": round(sum(SEVERITY.get(k, 1) * v["count"] for k, v in per.items()) / minutes * 10, 1),
            "vehicles": rep.get("vehicles_seen"), "pedestrians": rep.get("pedestrians_seen"),
            "hotspots": rep.get("hotspots", []), "rates_reliable": rep.get("rates_reliable", False),
            "aspect": round(doc["width"] / doc["height"], 4), "conflicts": rep.get("conflicts")}


def hotspots(p: Perception, events: list, involved: list | None) -> list:
    """Where each event happened: median foot point of every road user involved, in 0..1 image coords."""
    if not involved:
        return []
    t = p.times[p.dets[:, 0].astype(int)]
    tid = p.dets[:, 1].astype(int)
    out = []
    for (s, e, lab), ids in zip(events, involved):
        for i in ids:
            m = (tid == i) & (t >= s) & (t <= e)
            if not m.any():
                continue
            r = p.dets[m]
            out.append([round(float(np.median((r[:, 4] + r[:, 6]) / 2)), 3), round(float(np.median(r[:, 7])), 3), lab])
    return out


def build(p: Perception, events: list, curve: list, ff: FlowField, involved: list | None = None,
          conflicts: tuple | None = None) -> dict:
    dur_h = max(p.duration, 1e-6) / 3600
    per_class = {}
    for s, e, lab in events:
        per_class.setdefault(lab, {"count": 0, "seconds": 0.0})
        per_class[lab]["count"] += 1
        per_class[lab]["seconds"] += e - s
    for v in per_class.values():
        v["per_hour"] = round(v["count"] / dur_h, 1)
        v["seconds"] = round(v["seconds"], 1)

    # traffic volume: distinct tracks seen moving (rough, tracker fragments counted once per id)
    tracks = build_tracks(p)
    from . import config
    veh = sum(1 for t in tracks if t.cls in config.VEHICLES)
    ped = sum(1 for t in tracks if t.cls == config.PERSON)

    # hotspots: where violations happen (foot points of the tracks behind events are in the doc; here, risk peaks)
    c = np.array(curve) if curve else np.zeros((0, 2))
    risk_stats = {"max": round(float(c[:, 1].max()), 3) if len(c) else 0.0,
                  "share_above_0_3": round(float((c[:, 1] >= 0.3).mean()), 4) if len(c) else 0.0}

    # rates per hour from a short clip are noise: below 5 min only counts are reported
    reliable = p.duration >= 300
    if not reliable:
        for v in per_class.values():
            v["per_hour"] = None
    score = sum(SEVERITY.get(k, 1) * v["count"] for k, v in per_class.items()) / dur_h
    recs = []
    pc = lambda k: per_class.get(k, {}).get("per_hour") or 0
    if pc("red_light") >= 6:
        recs.append(f"Red-light running at {pc('red_light')}/h: check the amber and all-red clearance times; consider an enforcement camera on this approach.")
    if pc("failure_to_yield") >= 6:
        recs.append(f"{pc('failure_to_yield')}/h vehicles cut through pedestrians on the crossing: a leading pedestrian interval (3–5 s green for walkers first) or a raised crossing.")
    if pc("jaywalking") >= 10:
        recs.append(f"{pc('jaywalking')}/h pedestrians cross outside the zebra: check whether the desire line needs a new crossing or a fence.")
    if pc("stop_line") >= 6:
        recs.append(f"{pc('stop_line')}/h vehicles stop on the crossing on red: move the stop line back or add a box-junction marking.")
    if pc("wrong_way") > 0:
        recs.append(f"Wrong-way driving seen ({per_class['wrong_way']['count']}×): add 'no entry' signs and lane arrows at the entry where it starts.")
    if pc("congestion") >= 6:
        recs.append(f"Congestion {per_class['congestion']['seconds']:.0f} s in {p.duration / 60:.0f} min: review the signal cycle split for this direction.")
    cf, cs = conflicts or ([], None)
    pet_rec = None
    if cs and cs["vru_serious"] >= 3 and (cs["serious_per_1000_pedestrians"] or 0) >= 50:
        pet_rec = (f"{cs['vru_serious']} serious pedestrian/cyclist conflicts (PET < 1.5 s), {cs['serious_per_1000_pedestrians']} per 1,000 "
                   "pedestrians: see the red dots on the hotspot map; consider a refuge island, kerb extension or a leading pedestrian interval there.")
        recs.append(pet_rec)
    if not reliable:
        recs = [f"Clip is {p.duration:.0f} s long: events are listed, but hourly rates and recommendations need "
                "at least 5 minutes (a pilot camera collects whole days)."] + ([f"Indicative, from this clip: {pet_rec}"] if pet_rec else [])
    elif not recs:
        recs.append("No rule crossed its threshold in this clip; keep monitoring to collect a full day.")
    return {"duration_min": round(p.duration / 60, 2), "per_class": per_class, "vehicles_seen": veh,
            "pedestrians_seen": ped, "risk": risk_stats, "safety_index": round(score, 1) if reliable else None,
            "rates_reliable": reliable, "recommendations": recs,
            "hotspots": hotspots(p, events, involved) + [[c["x"], c["y"], "conflict"] for c in cf if c["severity"] == "serious"],
            "conflicts": cs}

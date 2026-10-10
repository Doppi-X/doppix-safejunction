"""Evaluate the zero-config (scene-agnostic) rules.

1. False alarms on real traffic: all four sample videos, compared with our own labels
   (stopped_vehicle, congestion) and with "no wrong-way driving happened" (true for these videos).
2. Synthetic wrong-way injection: take a real moving car and play its trajectory backwards,
   so it drives against its own lane. Recall = share of injected cars caught.
   Declared as synthetic: the data is our cached tracks, reversed in time.

    python eval/eval_generic.py --cache <dir with C38xx.npz> --labels <dir with C38xx.MP4.json> --out eval/results/generic.json
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))
from doppix import config, generic  # noqa: E402
from doppix.autoscene import MOVING_REL, Track, build_tracks, learn_flow  # noqa: E402
from doppix.perception import Perception  # noqa: E402


def iou(a, b):
    inter = max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
    return inter / max(1e-9, max(a[1], b[1]) - min(a[0], b[0]))


def f1(pred, gt, thr=0.3):
    used, tp = set(), 0
    for p in pred:
        best = max(((iou(p, g), k) for k, g in enumerate(gt) if k not in used), default=(0, None))
        if best[0] >= thr:
            tp += 1
            used.add(best[1])
    fp, fn = len(pred) - tp, len(gt) - tp
    return {"tp": tp, "fp": fp, "fn": fn, "f1": round(2 * tp / max(1, 2 * tp + fp + fn), 3)}


def reversed_track(tr: Track, new_id: int) -> Track:
    """Same path and timing, driven backwards: positions in reverse order."""
    return Track(new_id, tr.cls, tr.t.copy(), tr.box[::-1].copy(), tr.conf[::-1].copy())


ap = argparse.ArgumentParser()
ap.add_argument("--cache", required=True)
ap.add_argument("--labels", required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()

report = {"videos": {}, "injection": {}}
inj_total = inj_hit = 0
for npz in sorted(Path(args.cache).glob("*.npz")):
    vid = npz.stem
    p = Perception.load(npz)
    ev, _, ff = generic.detect(p)
    lab = json.loads((Path(args.labels) / f"{vid}.MP4.json").read_text(encoding="utf-8"))
    gt = lambda c: [(e["start"], e["end"]) for e in lab["events"] if e["label"] == c]
    pr = lambda c: [(s, e) for s, e, l in ev if l == c]
    report["videos"][vid] = {
        "duration": round(p.duration, 1),
        "wrong_way_alarms": len(pr("wrong_way")),
        "near_miss_alarms": len(pr("near_miss")),
        "stopped_vehicle": f1(pr("stopped_vehicle"), gt("stopped_vehicle")),
        "congestion": f1(pr("congestion"), gt("congestion")),
    }

    # injection: reverse up to 15 long, clearly moving cars (one at a time)
    tracks = build_tracks(p)
    cand = []
    for tr in tracks:
        if tr.cls not in config.VEHICLES or len(tr.t) < 20:
            continue
        sp = np.linalg.norm(tr.velocity(), axis=1) / np.maximum(tr.size, 1)
        travel = np.linalg.norm(tr.foot[-1] - tr.foot[0]) / np.median(tr.size)
        if (sp > MOVING_REL).mean() > 0.7 and travel > 3:
            cand.append(tr)
    rng = np.random.default_rng(42)
    pick = [cand[i] for i in rng.choice(len(cand), size=min(15, len(cand)), replace=False)] if cand else []
    hit = 0
    for tr in pick:
        fake = reversed_track(tr, 10_000_000 + tr.tid)
        others = [t for t in tracks if t.tid != tr.tid]       # the real car is replaced by its reversed copy
        ff2 = learn_flow(p, others + [fake])
        found = generic.wrong_way(others + [fake], ff2)
        hit += any(tid == fake.tid for _, _, tid in found)
    report["injection"][vid] = {"injected": len(pick), "caught": hit}
    inj_total += len(pick)
    inj_hit += hit
    print(vid, report["videos"][vid], report["injection"][vid], flush=True)

report["injection_recall"] = round(inj_hit / max(1, inj_total), 3)
report["wrong_way_false_alarms_per_hour"] = round(
    sum(v["wrong_way_alarms"] for v in report["videos"].values())
    / (sum(v["duration"] for v in report["videos"].values()) / 3600), 2)
Path(args.out).parent.mkdir(parents=True, exist_ok=True)
Path(args.out).write_text(json.dumps(report, indent=1), encoding="utf-8")
print("injection recall", report["injection_recall"], "| wrong-way false alarms/h", report["wrong_way_false_alarms_per_hour"])

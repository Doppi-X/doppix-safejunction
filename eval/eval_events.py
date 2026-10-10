"""Score the event rules (Part A metric) with a given detector.

Runs perception on the four sample videos (cached as .npz per weights file), applies the rules
with the calibrated reference scene, and scores against our own event labels with the
organisers' official scorer (eval/official_evaluate.py, copied unmodified from the elimination).

    python eval/eval_events.py --videos <dir with C38xx.MP4> --labels <dir with C38xx.MP4.json> \
        --cache <dir> [--weights weights/detector.pt] --out eval/results/events.json
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))
sys.path.insert(0, str(ROOT / "eval"))
from doppix import config, perception, rules  # noqa: E402
from doppix.perception import Perception  # noqa: E402
from official_evaluate import evaluate_part_a  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--videos", required=True)
    ap.add_argument("--labels", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--weights", default=str(config.WEIGHTS))
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    config.WEIGHTS = Path(a.weights)
    cache = Path(a.cache)
    cache.mkdir(parents=True, exist_ok=True)

    gt, pred = {}, {}
    for lab in sorted(Path(a.labels).glob("*.MP4.json")):
        name = lab.name[:-5]
        npz = cache / f"{Path(name).stem}.npz"
        if npz.exists():
            p = Perception.load(npz)
        else:
            print("perception:", name, flush=True)
            p = perception.run(str(Path(a.videos) / name))
            p.save(npz)
        ev = json.loads(lab.read_text(encoding="utf-8"))["events"]
        gt[name] = {"duration": p.duration, "fps": p.fps, "events": [[e["start"], e["end"], e["label"]] for e in ev]}
        pred[name] = {"events": rules.detect(p), "risk": []}

    rep = evaluate_part_a(gt, pred)
    out = {"weights": Path(a.weights).name, "score_a": round(rep["score_a"], 4),
           "per_class_f1_at_0.5": {c: round(rep["per_class"][c]["0.5"]["f1"], 3) for c in rep["classes"]}}
    print(json.dumps(out, indent=1))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

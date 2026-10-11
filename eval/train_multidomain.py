"""Multi-domain fine-tune and a real-night test on cameras never seen in training (built during the final).

Data: reviewed frames from our labeling tool (02_data/detector/ann, status "reviewed").
- Old junction: only C3896 and C3905. The team does not trust the box labels of C3897 and C3902, so
  they are excluded.
- New open-licence clips: night, rain, dusk, snow, drone, other cities. Labeled by the team and by an
  AI annotator (Claude) correcting YOLO drafts; the annotator is stored in every file.

Test sets, never trained on:
- REAL NIGHT: every reviewed frame of the TEST_VIDEOS (whole videos held out = unseen cameras);
- DAY: the old junction's last 20 % of frames per video (the split the elimination detector used).

All models are scored with ONE evaluator (AP50 per class, VOC all-point; mean over classes present):
- our daylight detector;
- our low-light fine-tune;
- general COCO YOLO26m (classes mapped; road users only, it has no light state);
- the new multi-domain model.

Road users (6 classes) and traffic lights are reported separately.

    python eval/train_multidomain.py --ann <02_data/detector/ann> --frames <02_data/detector/frames> \
        --work <dir> [--epochs 30] [--skip-train]
"""
import argparse
import json
import random
import shutil
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))
from doppix import config  # noqa: E402

OLD_TRUSTED = ["C3896", "C3905"]
TEST_VIDEOS = ["night_crosswalk_trafficlight_street", "night_raised_philadelphia", "fog_night_moscow"]
NAMES = ["person", "bicycle", "car", "motorcycle", "bus", "truck", "light_red", "light_not_red"]
COCO_MAP = {0: 0, 1: 1, 2: 2, 3: 3, 5: 4, 7: 5}


def reviewed(ann_dir: Path, video: str):
    for f in sorted((ann_dir / video).glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("status") == "reviewed":
            yield f.stem, d


def write_split(items, frames: Path, out: Path, split: str):
    (out / "images" / split).mkdir(parents=True, exist_ok=True)
    (out / "labels" / split).mkdir(parents=True, exist_ok=True)
    for video, idx, d in items:
        name = f"{video}_{idx}"
        shutil.copy(frames / video / f"{idx}.jpg", out / "images" / split / f"{name}.jpg")
        (out / "labels" / split / f"{name}.txt").write_text(
            "".join(f"{b['class_id']} {b['x_center']} {b['y_center']} {b['width']} {b['height']}\n" for b in d["boxes"]))


def ap50(preds, gts, cls):
    """preds: list of (img, conf, box); gts: dict img -> list of boxes for this class."""
    npos = sum(len(v) for v in gts.values())
    if npos == 0:
        return None
    preds = sorted(preds, key=lambda x: -x[1])
    used = {k: np.zeros(len(v), bool) for k, v in gts.items()}
    tp = np.zeros(len(preds)); fp = np.zeros(len(preds))
    for i, (img, _, b) in enumerate(preds):
        g = np.asarray(gts.get(img, []))
        if len(g):
            x1 = np.maximum(g[:, 0], b[0]); y1 = np.maximum(g[:, 1], b[1]); x2 = np.minimum(g[:, 2], b[2]); y2 = np.minimum(g[:, 3], b[3])
            inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
            iou = inter / ((g[:, 2] - g[:, 0]) * (g[:, 3] - g[:, 1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)
            j = int(iou.argmax())
            if iou[j] >= 0.5 and not used[img][j]:
                used[img][j] = True; tp[i] = 1; continue
        fp[i] = 1
    tp, fp = np.cumsum(tp), np.cumsum(fp)
    rec, prec = tp / npos, tp / np.maximum(tp + fp, 1e-9)
    mrec = np.concatenate([[0], rec, [1]]); mpre = np.concatenate([[0], prec, [0]])
    for k in range(len(mpre) - 2, -1, -1):
        mpre[k] = max(mpre[k], mpre[k + 1])
    idx = np.where(mrec[1:] != mrec[:-1])[0]
    return float(np.sum((mrec[idx + 1] - mrec[idx]) * mpre[idx + 1]))


def evaluate(weights: Path, items, frames: Path, cmap=None):
    import cv2
    import torch
    from ultralytics import YOLO
    model = YOLO(str(weights))
    dev = 0 if torch.cuda.is_available() else "cpu"
    gts = {c: {} for c in range(8)}
    preds = {c: [] for c in range(8)}
    for video, idx, d in items:
        img = f"{video}_{idx}"
        im = cv2.imread(str(frames / video / f"{idx}.jpg")); h, w = im.shape[:2]
        for b in d["boxes"]:
            x, y, bw, bh = b["x_center"] * w, b["y_center"] * h, b["width"] * w, b["height"] * h
            gts[b["class_id"]].setdefault(img, []).append([x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2])
        r = model.predict(im, imgsz=1280, conf=0.001, device=dev, verbose=False, max_det=600)[0]
        for bb, c, s in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist()):
            c = int(c)
            if cmap is not None:
                if c not in cmap:
                    continue
                c = cmap[c]
            preds[c].append((img, s, bb))
    per = {NAMES[c]: ap50(preds[c], gts[c], c) for c in range(8)}
    users = [v for k, v in per.items() if v is not None and k not in ("light_red", "light_not_red")]
    lights = [v for k, v in per.items() if v is not None and k in ("light_red", "light_not_red")]
    n_gt = {NAMES[c]: sum(len(v) for v in gts[c].values()) for c in range(8)}
    return {"road_users_mAP50": round(float(np.mean(users)), 3) if users else None,
            "lights_mAP50": round(float(np.mean(lights)), 3) if lights and cmap is None else None,
            "per_class_AP50": {k: (round(v, 3) if v is not None else None) for k, v in per.items()},
            "gt_boxes": n_gt, "frames": len(items)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ann", required=True)
    ap.add_argument("--frames", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--batch", type=int, default=6)
    ap.add_argument("--skip-train", action="store_true")
    ap.add_argument("--init", default=str(config.WEIGHTS), help="weights to start from")
    ap.add_argument("--name", default="multidomain")
    a = ap.parse_args()
    ann, frames, work = Path(a.ann), Path(a.frames), Path(a.work)
    work.mkdir(parents=True, exist_ok=True)

    # C3897/C3902: box labels not trusted by the team. Night drone: packed motorbikes, mostly left unlabeled.
    skip = ("C3897", "C3902", "night_intersection_topdown_drone")
    videos = sorted(p.name for p in ann.iterdir() if p.is_dir() and not p.name.startswith(skip))
    train, day_test, night_test = [], [], []
    for v in videos:
        items = [(v, i, d) for i, d in reviewed(ann, v)]
        if v in TEST_VIDEOS:
            night_test += items
        elif v in OLD_TRUSTED:
            cut = int(len(items) * 0.8)                 # last 20 % of each old video = day test
            train += items[:cut]; day_test += items[cut:]
        else:
            train += items
    print("train frames", len(train), "day test", len(day_test), "night test (unseen cameras)", len(night_test), flush=True)
    annotators = {}
    for _, _, d in train + night_test:
        annotators[d.get("annotator")] = annotators.get(d.get("annotator"), 0) + 1
    print("annotators", annotators, flush=True)

    best = work / "runs" / a.name / "weights" / "best.pt"
    if not a.skip_train:
        if work.exists():
            shutil.rmtree(work / "data", ignore_errors=True)
        random.seed(42)
        val = random.sample(train, max(1, len(train) // 10))      # early-stopping split, from train domains only
        tr = [x for x in train if x not in val]
        write_split(tr, frames, work / "data", "train")
        write_split(val, frames, work / "data", "val")
        yaml = work / "data.yaml"
        yaml.write_text(f"path: {(work / 'data').as_posix()}\ntrain: images/train\nval: images/val\nnames:\n" +
                        "".join(f"  {i}: {n}\n" for i, n in enumerate(NAMES)))
        from ultralytics import YOLO
        YOLO(a.init).train(data=str(yaml), epochs=a.epochs, imgsz=1280, batch=a.batch, seed=42, workers=0,
                                        project=str(work / "runs"), name=a.name, exist_ok=True, patience=10,
                                        hsv_v=0.6, degrees=0, mosaic=1.0, verbose=False)

    cands = {"daylight (ours)": (config.WEIGHTS, None), "low-light (ours)": (config.LOWLIGHT_WEIGHTS, None),
             "general COCO": (config.GENERAL_WEIGHTS, COCO_MAP)}
    if best.exists():
        cands["multi-domain (new)"] = (best, None)
    res = {"test_videos": TEST_VIDEOS, "train_frames": len(train), "annotators": annotators, "results": {}}
    for name, (w, cmap) in cands.items():
        res["results"][name] = {"real_night_unseen": evaluate(w, night_test, frames, cmap) if night_test else None,
                                "day_old_junction": evaluate(w, day_test, frames, cmap) if day_test else None}
        n, d = res["results"][name]["real_night_unseen"], res["results"][name]["day_old_junction"]
        print(f"{name:22s} night road-users {n and n['road_users_mAP50']}  lights {n and n['lights_mAP50']} | "
              f"day road-users {d and d['road_users_mAP50']}  lights {d and d['lights_mAP50']}", flush=True)
    (work / "multidomain_results.json").write_text(json.dumps(res, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

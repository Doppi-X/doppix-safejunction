"""Prepare new-domain frames for the team to label in our labeling tool (built during the final).

For each new open-licence clip: copy it into the labeler's video folder, extract N evenly spaced
frames at 1920 px (the labeler's frame width), and pre-label them as drafts. The drafts unite the
general COCO model (road users, better on unfamiliar viewpoints) with our detector (adds the
traffic-light state classes and Tashkent-style vehicles). Duplicates are removed at IoU 0.5.
Existing frames and any human-edited annotation are never touched.

    python eval/prep_labeling.py --videos <dir with .mp4> --labeler-data <02_data> [--n 15]
"""
import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))
from doppix import config  # noqa: E402

FRAME_W = 1920
COCO_TO_OURS = {0: 0, 1: 1, 2: 2, 3: 3, 5: 4, 7: 5}


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def draft(frame, ours, coco, conf=0.35):
    h, w = frame.shape[:2]
    boxes = []
    r = coco.predict(frame, imgsz=1280, conf=conf, classes=list(COCO_TO_OURS), device=dev(), verbose=False)[0]
    for b, c, s in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist()):
        boxes.append((b, COCO_TO_OURS[int(c)], s))
    r = ours.predict(frame, imgsz=1280, conf=conf, device=dev(), verbose=False)[0]
    for b, c, s in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist()):
        c = int(c)
        if c >= 6 or all(iou(b, o[0]) < 0.5 for o in boxes):     # light states always; road users if new
            boxes.append((b, c, s))
    return [{"class_id": c, "x_center": round((b[0] + b[2]) / 2 / w, 6), "y_center": round((b[1] + b[3]) / 2 / h, 6),
             "width": round((b[2] - b[0]) / w, 6), "height": round((b[3] - b[1]) / h, 6), "conf": round(s, 3)}
            for b, c, s in boxes]


def dev():
    import torch
    return 0 if torch.cuda.is_available() else "cpu"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--videos", required=True)
    ap.add_argument("--labeler-data", required=True, help="the labeler's 02_data folder")
    ap.add_argument("--n", type=int, default=15)
    a = ap.parse_args()
    from ultralytics import YOLO
    ours, coco = YOLO(str(config.WEIGHTS)), YOLO(str(config.GENERAL_WEIGHTS))
    data = Path(a.labeler_data)
    for v in sorted(Path(a.videos).glob("*.mp4")):
        dst = data / "samples" / v.name
        if not dst.exists():
            shutil.copy(v, dst)
        stem = v.stem
        fdir, adir = data / "detector" / "frames" / stem, data / "detector" / "ann" / stem
        fdir.mkdir(parents=True, exist_ok=True)
        adir.mkdir(parents=True, exist_ok=True)
        cap = cv2.VideoCapture(str(v))
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        made = 0
        for idx in np.linspace(0.03 * n, 0.97 * n, a.n).astype(int):
            fp, ap_ = fdir / f"{idx:06d}.jpg", adir / f"{idx:06d}.json"
            if fp.exists():
                continue
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok, f = cap.read()
            if not ok:
                continue
            if f.shape[1] != FRAME_W:
                f = cv2.resize(f, (FRAME_W, round(f.shape[0] * FRAME_W / f.shape[1])), interpolation=cv2.INTER_AREA)
            cv2.imwrite(str(fp), f, [cv2.IMWRITE_JPEG_QUALITY, 92])
            if not ap_.exists():
                ap_.write_text(json.dumps({"boxes": draft(f, ours, coco), "status": "pred", "annotator": "YOLO",
                                           "updated_at": datetime.now(timezone.utc).isoformat()}, indent=1), encoding="utf-8")
            made += 1
        cap.release()
        print(stem, "frames added:", made, flush=True)


if __name__ == "__main__":
    main()

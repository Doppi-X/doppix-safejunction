"""How detection quality holds at night, in rain, fog, with blur and low bit-rate (built during the final).

Our labeled validation frames (22 frames, 1,386 boxes, never used for training) are degraded
with SYNTHETIC corruptions and the detector is re-validated on each copy. All footage is daytime,
so night and rain are simulated; the method is declared, and real night video is the first thing
a pilot collects.

    python eval/robustness.py --val <dir with images/ and labels/> --out eval/results/robustness.json
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))
from doppix import config  # noqa: E402

RNG = np.random.default_rng(42)


def night(img):
    """Low light: strong gamma darkening, blue cast, sensor noise, bright light sources bloom."""
    f = img.astype(np.float32) / 255
    dark = np.power(f, 2.6) * 0.55
    dark[..., 0] *= 1.15                                   # BGR: a bit more blue
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    glow = cv2.GaussianBlur(np.clip(lum - 0.85, 0, 1), (0, 0), 6)[..., None] * 1.5   # lamps/headlights stay bright
    noisy = dark + glow + RNG.normal(0, 0.035, dark.shape)
    return np.clip(noisy * 255, 0, 255).astype(np.uint8)


def rain(img):
    """Rain streaks, lower contrast, slight blur, wet darkening."""
    h, w = img.shape[:2]
    drops = np.zeros((h, w), np.float32)
    n = int(h * w * 0.0025)
    ys, xs = RNG.integers(0, h, n), RNG.integers(0, w, n)
    drops[ys, xs] = 1.0
    k = np.zeros((25, 25), np.float32)
    cv2.line(k, (9, 0), (15, 24), 1.0, 1)                  # slanted streak
    streaks = cv2.filter2D(drops, -1, k / k.sum() * 6)
    f = img.astype(np.float32) / 255 * 0.8 + 0.08
    f = cv2.GaussianBlur(f, (0, 0), 1.2)
    f = f + np.clip(streaks, 0, 0.6)[..., None]
    return np.clip(f * 255, 0, 255).astype(np.uint8)


def fog(img):
    f = img.astype(np.float32) / 255
    return np.clip((f * 0.55 + 0.4) * 255, 0, 255).astype(np.uint8)


def motion_blur(img):
    k = np.zeros((15, 15), np.float32)
    k[7, :] = 1 / 15
    return cv2.filter2D(img, -1, k)


def low_bitrate(img):
    small = cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 25])
    return cv2.resize(cv2.imdecode(buf, cv2.IMREAD_COLOR), (img.shape[1], img.shape[0]))


CONDITIONS = {"clean (day)": None, "night": night, "rain": rain, "fog": fog,
              "motion blur": motion_blur, "low bit-rate 540p": low_bitrate}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--val", required=True, help="YOLO dataset root with images/val and labels/val")
    ap.add_argument("--out", required=True)
    ap.add_argument("--work", default=str(ROOT / "_robustness"))
    ap.add_argument("--samples", default=str(ROOT / "eval" / "results" / "robustness_samples"))
    a = ap.parse_args()
    from ultralytics import YOLO
    model = YOLO(str(config.WEIGHTS))
    val = Path(a.val)
    work = Path(a.work)
    samples = Path(a.samples)
    samples.mkdir(parents=True, exist_ok=True)
    results = {}
    names = config.CLASS_NAMES
    for cond, fn in CONDITIONS.items():
        d = work / cond.replace(" ", "_").replace("(", "").replace(")", "")
        if d.exists():
            shutil.rmtree(d)
        (d / "images" / "val").mkdir(parents=True)
        shutil.copytree(val / "labels" / "val", d / "labels" / "val")
        imgs = sorted((val / "images" / "val").glob("*.jpg"))
        for i, p in enumerate(imgs):
            img = cv2.imread(str(p))
            out = img if fn is None else fn(img)
            cv2.imwrite(str(d / "images" / "val" / p.name), out, [cv2.IMWRITE_JPEG_QUALITY, 95])
            if i == 0:
                cv2.imwrite(str(samples / f"{d.name}.jpg"), cv2.resize(out, (960, 540)), [cv2.IMWRITE_JPEG_QUALITY, 80])
        yaml = d / "data.yaml"
        yaml.write_text(f"path: {d.as_posix()}\ntrain: images/val\nval: images/val\nnames:\n" +
                        "".join(f"  {i}: {n}\n" for i, n in enumerate(names)), encoding="utf-8")
        r = model.val(data=str(yaml), imgsz=config.IMGSZ, batch=8, plots=False, verbose=False, seed=42)
        per = {names[int(c)]: round(float(r.box.ap[i]), 3) for i, c in enumerate(r.box.ap_class_index)}
        results[cond] = {"mAP50": round(float(r.box.map50), 3), "mAP50_95": round(float(r.box.map), 3),
                         "precision": round(float(r.box.mp), 3), "recall": round(float(r.box.mr), 3),
                         "per_class_mAP50_95": per}
        print(f"{cond:22s} mAP50 {results[cond]['mAP50']:.3f}  mAP50-95 {results[cond]['mAP50_95']:.3f}  "
              f"P {results[cond]['precision']:.3f} R {results[cond]['recall']:.3f}", flush=True)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps({"method": "synthetic corruptions of our 22 held-out labeled frames; see eval/robustness.py",
                                       "results": results}, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

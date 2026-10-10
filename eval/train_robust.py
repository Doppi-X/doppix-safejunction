"""Fine-tune our detector for night / rain / blur (built during the final).

Our labeled data is daytime only, and the robustness test (eval/robustness.py) shows the
drop at night. Each TRAIN frame gets synthetic night, rain and motion-blur copies with the
same labels (domain randomisation), and training continues from weights/detector.pt.
Validation frames are never augmented here and never trained on.

    python eval/train_robust.py --data <YOLO root with images/train, labels/train, images/val, labels/val>
"""
import argparse
import shutil
import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "eval"))
sys.path.insert(0, str(ROOT / "core"))
from doppix import config  # noqa: E402
from robustness import motion_blur, night, rain  # noqa: E402

AUG = {"night": night, "rain": rain, "blur": motion_blur}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--work", default=str(ROOT / "_robust_train"))
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--imgsz", type=int, default=1280)
    ap.add_argument("--batch", type=int, default=8)
    a = ap.parse_args()

    src, work = Path(a.data), Path(a.work)
    if work.exists():
        shutil.rmtree(work)
    for split in ("train", "val"):
        (work / "images" / split).mkdir(parents=True)
        (work / "labels" / split).mkdir(parents=True)
    for p in sorted((src / "images" / "train").glob("*.jpg")):
        lbl = src / "labels" / "train" / f"{p.stem}.txt"
        img = cv2.imread(str(p))
        cv2.imwrite(str(work / "images" / "train" / p.name), img)
        shutil.copy(lbl, work / "labels" / "train" / lbl.name)
        for name, fn in AUG.items():
            cv2.imwrite(str(work / "images" / "train" / f"{p.stem}_{name}.jpg"), fn(img), [cv2.IMWRITE_JPEG_QUALITY, 92])
            shutil.copy(lbl, work / "labels" / "train" / f"{p.stem}_{name}.txt")
    for p in sorted((src / "images" / "val").glob("*.jpg")):
        shutil.copy(p, work / "images" / "val" / p.name)
        shutil.copy(src / "labels" / "val" / f"{p.stem}.txt", work / "labels" / "val" / f"{p.stem}.txt")
    yaml = work / "data.yaml"
    yaml.write_text(f"path: {work.as_posix()}\ntrain: images/train\nval: images/val\nnames:\n" +
                    "".join(f"  {i}: {n}\n" for i, n in enumerate(config.CLASS_NAMES)), encoding="utf-8")
    print("train images:", len(list((work / "images" / "train").glob("*.jpg"))))

    from ultralytics import YOLO
    YOLO(str(config.WEIGHTS)).train(data=str(yaml), epochs=a.epochs, imgsz=a.imgsz, batch=a.batch, seed=42,
                                    deterministic=True, flipud=0, degrees=0, perspective=0, fliplr=0.5,
                                    project=str(work / "runs"), name="robust", patience=50, workers=4)


if __name__ == "__main__":   # Windows spawns dataloader workers: guard required
    main()

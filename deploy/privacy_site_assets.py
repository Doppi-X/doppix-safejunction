"""Re-render the site's sample videos and frames with heads and plates blurred (built during the final).

The elimination site showed the four sample clips unblurred. The final rules forbid showing
faces or plates of people who did not consent, so every clip and frame on the site goes
through the same privacy pass as user uploads (core/doppix/privacy.py).

    python deploy/privacy_site_assets.py --videos <dir with C38xx.MP4> --cache <dir with C38xx.npz> \
        --images <copy of frontend/public/data> --out <dir>
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))
from doppix import analyze, config, perception, privacy  # noqa: E402
from doppix.perception import Perception  # noqa: E402

VIDEOS = ["C3896", "C3897", "C3902", "C3905"]
HERO = ("C3896", 74, 18)                      # hero.mp4 = C3896 74–92 s (see Hero.jsx CLIP_START)
IMAGE_DIRS = ["img", "robustness", "gallery"]
SKIP = {"confusion.jpg", "training_curves.jpg"}   # charts, no camera pixels


def blur_image(path: Path, dst: Path, model) -> tuple[int, int]:
    img = cv2.imread(str(path))
    r = model.predict(img, imgsz=config.IMGSZ, conf=0.25, verbose=False)[0]
    b, c = r.boxes.xyxy.cpu().numpy(), r.boxes.cls.cpu().numpy().astype(int)
    heads = privacy.head_boxes(b[c == config.PERSON])
    plates = privacy.find_plates(img, b[np.isin(c, config.VEHICLES)], min_w=12)
    privacy.blur_regions(img, heads + plates)
    dst.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(dst), img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return len(heads), len(plates)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--videos", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--images", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out)
    (out / "video").mkdir(parents=True, exist_ok=True)

    model = perception.load_detector()   # site frames are daylight
    for d in IMAGE_DIRS:
        for f in sorted((Path(a.images) / d).glob("*.jpg")):
            if f.name in SKIP:
                continue
            print(d, f.name, blur_image(f, out / d / f.name, model), flush=True)

    for vid in VIDEOS:
        p = Perception.load(Path(a.cache) / f"{vid}.npz")
        stats = analyze.render_private_video(str(Path(a.videos) / f"{vid}.MP4"), p, out / "video" / f"{vid}.mp4")
        print(vid, stats, flush=True)

    vid, start, length = HERO
    subprocess.run([analyze.ffmpeg(), "-y", "-loglevel", "error", "-ss", str(start), "-t", str(length),
                    "-i", str(out / "video" / f"{vid}.mp4"), "-an", "-c:v", "libx264", "-crf", "28",
                    "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    str(out / "video" / "hero.mp4")], check=True)
    print("hero done")


if __name__ == "__main__":
    main()

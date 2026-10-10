"""City-dashboard rows for our reference intersection (the four elimination clips).

Same summary as an uploaded camera (core/doppix/report.summary_row), computed from cached
perception with the calibrated reference scene. Thumbnails are the privacy-blurred backgrounds.

    python eval/seed_network.py --cache <dir with C38xx.npz> --out frontend/public/data/network_seed.json
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))
from doppix import analyze, report  # noqa: E402
from doppix.perception import Perception  # noqa: E402

CLIPS = ["C3896", "C3897", "C3902", "C3905"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    rows = []
    for c in CLIPS:
        p = Perception.load(Path(a.cache) / f"{c}.npz")
        doc = analyze.build_doc(p, None)
        rows.append(report.summary_row(doc, id=f"ref-{c}", name=f"Reference junction · {c}", created=0,
                                       source="reference", frame=f"./data/img/{c}_bg.jpg"))
        print(c, rows[-1]["mode"], rows[-1]["risk_index"], rows[-1]["counts"])
    Path(a.out).write_text(json.dumps(rows, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()

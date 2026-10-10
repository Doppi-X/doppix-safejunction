"""Collect the unseen-camera run (deploy GPU server) into site data: blurred thumbnails + summary.

    python eval/collect_unseen.py --jobs new_jobs.json --server admin@host --key ~/.ssh/key
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = "D:/My_projects/safejunction_state"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", required=True)
    ap.add_argument("--server", required=True)
    ap.add_argument("--key", required=True)
    a = ap.parse_args()
    jobs = json.loads(Path(a.jobs).read_text())
    src = {s["file"]: s for s in json.loads((ROOT / "eval" / "new_videos_sources.json").read_text(encoding="utf-8"))}
    out_dir = ROOT / "frontend" / "public" / "data" / "unseen"
    out_dir.mkdir(parents=True, exist_ok=True)
    scp = ["scp", "-q", "-i", a.key, "-o", "BatchMode=yes"]
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for f, r in jobs.items():
            if r["status"] != "done":
                continue
            stem = f[:-4]
            subprocess.run(scp + [f"{a.server}:{STATE}/network/{r['id']}.jpg", str(out_dir / f"{stem}.jpg")], check=True)
            subprocess.run(scp + [f"{a.server}:{STATE}/jobs/{r['id']}/result.json", f"{tmp}/{stem}.json"], check=True)
            doc = json.loads(Path(tmp, f"{stem}.json").read_text(encoding="utf-8"))
            s = src[f]
            rows.append({"file": stem, "condition": s["condition"], "duration_s": doc["duration"], "detector": doc.get("detector"),
                         "detector_scores": doc.get("detector_scores"), "events": doc["events"],
                         "conflicts": (doc.get("report") or {}).get("conflicts"), "privacy": doc.get("privacy"),
                         "licence": s["licence"], "author": s["author"], "page_url": s["page_url"]})
    (ROOT / "frontend" / "public" / "data" / "unseen.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    (ROOT / "eval" / "results" / "new_cameras.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    for r in rows:
        print(r["file"], r["detector"], r["detector_scores"], len(r["events"]), (r["conflicts"] or {}).get("counts"))


if __name__ == "__main__":
    main()

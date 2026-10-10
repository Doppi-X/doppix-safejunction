"""Sayt serveri: statik sayt + jonli demo API (video yuklash -> pipeline -> natija).

    uvicorn app:app --host 0.0.0.0 --port 7860

Demo xuddi topshiriq yechimidagi modullarni ishlatadi (doppix: perception, rules, risk). Bitta ishchi
oqim navbatdagi videolarni ketma-ket qayta ishlaydi; frontend holatni /api/demo/{id} dan so'rab turadi.
"""
from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
import traceback
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

HERE = Path(__file__).resolve().parent
SRC = Path(os.environ.get("DOPPIX_SRC", HERE.parent.parent / "03_src"))
DIST = Path(os.environ.get("SITE_DIST", HERE.parent / "frontend" / "dist"))
JOBS = Path(os.environ.get("JOBS_DIR", HERE / "_jobs"))
SAMPLE = Path(os.environ.get("DEMO_SAMPLE", HERE / "sample.mp4"))
SAMPLE_CACHE = HERE / "sample_result"          # namuna klip natijasi (bir marta hisoblanadi, keyin darhol)
MAX_SEC = float(os.environ.get("DEMO_MAX_SEC", 60))
MAX_MB = int(os.environ.get("DEMO_MAX_MB", 400))
MAX_QUEUE = int(os.environ.get("DEMO_MAX_QUEUE", 6))
JOB_TTL = 3 * 3600
JOBS.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(SRC / "src"))
sys.path.insert(0, str(HERE))

import torch  # noqa: E402

CUDA = torch.cuda.is_available()
STRIDE = float(os.environ.get("DEMO_STRIDE", 0.1 if CUDA else 0.2))
IMGSZ = int(os.environ.get("DEMO_IMGSZ", 1280 if CUDA else 960))
torch.set_num_threads(max(1, os.cpu_count() or 1))

app = FastAPI(title="Do'ppiX demo")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

jobs: dict[str, dict] = {}
order: list[str] = []
work: queue.Queue[str] = queue.Queue()
lock = threading.Lock()


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def update(jid: str, **kw) -> None:
    with lock:
        jobs[jid].update(kw)


def cleanup() -> None:
    now = time.time()
    for d in JOBS.glob("*"):
        if d.is_dir() and now - d.stat().st_mtime > JOB_TTL:
            shutil.rmtree(d, ignore_errors=True)
            jobs.pop(d.name, None)


def process(jid: str) -> None:
    import cv2
    import numpy as np
    from doppix import align, perception, risk, rules
    from doppix.scene import Scene
    from doppix.tracks import light_state
    from docbuild import make_doc

    d = JOBS / jid
    src = d / jobs[jid]["file"]
    t0 = time.time()
    update(jid, status="running", stage="prepare", progress=0.01)
    cap = cv2.VideoCapture(str(src))
    ok = cap.isOpened() and cap.read()[0]
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    if not ok:
        raise RuntimeError("Could not decode this video. Please upload an MP4 (H.264/HEVC).")
    used = min(n / fps if n > 0 else MAX_SEC, MAX_SEC)
    update(jid, stage="perception", message=f"{used:.0f} s of video at {1 / STRIDE:.0f} fps")

    def prog(i, total):
        total = total or used * fps
        update(jid, progress=0.02 + 0.83 * min(1.0, i / max(1, total)),
               message=f"frame {i} / {int(total)} · {time.time() - t0:.0f} s elapsed")

    p = perception.run(str(src), stride_sec=STRIDE, progress=prog, max_sec=MAX_SEC, imgsz=IMGSZ)

    update(jid, stage="rules", progress=0.86, message="")
    base = Scene.load()
    ref = align.load_ref()
    M = align.estimate(ref, p.bg) if ref is not None and p.bg is not None else None
    scene_ok = M is not None
    scene = base.transformed(M)
    events, involved = rules.detect(p, base, detail=True) if scene_ok else ([], [])
    light = light_state(p, scene) if scene_ok else np.full(len(p.frame_idx), -1.0)

    update(jid, stage="risk", progress=0.9)
    curve = risk.replay(p)

    update(jid, stage="encode", progress=0.93)
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(src), "-t", f"{used:.2f}",
                    "-vf", "scale='min(960,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                    "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(d / "video.mp4")], check=True)

    note = None if scene_ok else ("This does not look like the hackathon intersection, so the scene layout could not "
                                  "be aligned. Showing detections, tracks and risk only; scene-based events are skipped.")
    doc = make_doc(p, scene if scene_ok else Scene(), light, events, curve,
                   scene_ok=scene_ok, note=note, elapsed=round(time.time() - t0, 1), stride=STRIDE, imgsz=IMGSZ,
                   involved=involved)
    (d / "result.json").write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    if jobs[jid].get("sample"):
        SAMPLE_CACHE.mkdir(exist_ok=True)
        for f in ("result.json", "video.mp4"):
            shutil.copy(d / f, SAMPLE_CACHE / f)
    update(jid, status="done", stage="done", progress=1.0, message="")


def worker() -> None:
    while True:
        jid = work.get()
        try:
            process(jid)
        except Exception as e:  # noqa: BLE001 — foydalanuvchiga xabar, server ishlashda davom etadi
            traceback.print_exc()
            update(jid, status="error", message=str(e)[:300])
        finally:
            with lock:
                if jid in order:
                    order.remove(jid)
            (JOBS / jid / jobs[jid]["file"]).unlink(missing_ok=True)


threading.Thread(target=worker, daemon=True).start()


def enqueue(jid: str, fname: str, sample: bool = False) -> dict:
    with lock:
        jobs[jid] = {"id": jid, "status": "queued", "stage": "queued", "progress": 0.0, "message": "", "file": fname,
                     "created": time.time(), "sample": sample}
        order.append(jid)
    work.put(jid)
    return status(jid)


@app.get("/api/health")
def health():
    return {"ok": True, "device": "cuda" if CUDA else "cpu", "max_sec": MAX_SEC, "max_mb": MAX_MB,
            "has_sample": SAMPLE.exists(), "queue": len(order), "stride": STRIDE, "imgsz": IMGSZ}


@app.post("/api/demo")
async def demo(request: Request):
    form = await request.form()
    up = form.get("file")
    if up is None or not hasattr(up, "read"):
        raise HTTPException(400, "no file")
    if len(order) >= MAX_QUEUE:
        raise HTTPException(429, "The demo queue is full, please try again in a minute.")
    cleanup()
    jid = uuid.uuid4().hex[:12]
    d = JOBS / jid
    d.mkdir(parents=True)
    ext = Path(up.filename or "v.mp4").suffix.lower() or ".mp4"
    if ext not in {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}:
        raise HTTPException(400, "Please upload a video file (mp4, mov, avi, mkv, webm).")
    size = 0
    with open(d / f"in{ext}", "wb") as f:
        while chunk := await up.read(2 ** 20):
            size += len(chunk)
            if size > MAX_MB * 2 ** 20:
                f.close()
                shutil.rmtree(d, ignore_errors=True)
                raise HTTPException(413, f"File is larger than {MAX_MB} MB.")
            f.write(chunk)
    return enqueue(jid, f"in{ext}")


@app.post("/api/demo/sample")
def demo_sample():
    if not SAMPLE.exists():
        raise HTTPException(404, "no sample clip on this server")
    if len(order) >= MAX_QUEUE:
        raise HTTPException(429, "The demo queue is full, please try again in a minute.")
    cleanup()
    jid = uuid.uuid4().hex[:12]
    (JOBS / jid).mkdir(parents=True)
    if (SAMPLE_CACHE / "result.json").exists() and (SAMPLE_CACHE / "video.mp4").exists():
        for f in ("result.json", "video.mp4"):
            shutil.copy(SAMPLE_CACHE / f, JOBS / jid / f)
        with lock:
            jobs[jid] = {"id": jid, "status": "done", "stage": "done", "progress": 1.0, "file": "in.mp4",
                         "message": "cached result", "created": time.time(), "sample": True}
        return status(jid)
    shutil.copy(SAMPLE, JOBS / jid / "in.mp4")
    return enqueue(jid, "in.mp4", sample=True)


def status(jid: str) -> dict:
    with lock:
        j = jobs.get(jid)
        if j is None:
            raise HTTPException(404, "unknown job (results are kept for 3 hours)")
        out = {k: v for k, v in j.items() if k != "file"}
        out["queue_pos"] = order.index(jid) if j["status"] == "queued" and jid in order else 0
    return out


@app.get("/api/demo/{jid}")
def demo_status(jid: str):
    return status(jid)


@app.get("/api/demo/{jid}/result")
def demo_result(jid: str):
    f = JOBS / jid / "result.json"
    if not f.exists():
        raise HTTPException(404, "not ready")
    return FileResponse(f, media_type="application/json")


@app.get("/api/demo/{jid}/video.mp4")
def demo_video(jid: str):
    f = JOBS / jid / "video.mp4"
    if not f.exists():
        raise HTTPException(404, "not ready")
    return FileResponse(f, media_type="video/mp4")


if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="site")

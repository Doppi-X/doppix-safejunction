"""SafeJunction API server (rewritten during the final).

    uvicorn app:app --host 0.0.0.0 --port 7860 --app-dir backend

POST /api/jobs              upload a video -> job id; perception starts at once
GET  /api/jobs/{id}         status, stage, progress, queue position
GET  /api/jobs/{id}/frame   first frame (heads and plates blurred) for drawing zones
POST /api/jobs/{id}/zones   zones drawn in the browser; re-runs the rules if the job is done
GET  /api/jobs/{id}/result  events, tracks, risk, learned flow, report
GET  /api/jobs/{id}/video.mp4  privacy-blurred video
POST /api/image             one image -> detections, counts, blurred image
GET  /api/health

One worker thread processes videos in order (one GPU). Results live for 6 h.
"""
from __future__ import annotations

import json
import os
import queue
import shutil
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
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "core"))

from doppix import analyze, config, perception, privacy  # noqa: E402
from doppix.perception import Perception  # noqa: E402

JOBS = Path(os.environ.get("JOBS_DIR", ROOT / "_jobs"))
JOBS.mkdir(parents=True, exist_ok=True)
DIST = Path(os.environ.get("SITE_DIST", ROOT / "frontend" / "dist"))
MAX_SEC = float(os.environ.get("MAX_SEC", 120))
MAX_MB = int(os.environ.get("MAX_MB", 500))
MAX_QUEUE = int(os.environ.get("MAX_QUEUE", 8))
TTL = 6 * 3600
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

import torch  # noqa: E402

CUDA = torch.cuda.is_available()
STRIDE = float(os.environ.get("STRIDE", 0.1 if CUDA else 0.25))
IMGSZ = int(os.environ.get("IMGSZ", 1280 if CUDA else 960))
DEVICE = torch.cuda.get_device_name(0) if CUDA else "CPU"

app = FastAPI(title="Do'ppiX SafeJunction")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

jobs: dict[str, dict] = {}
order: list[str] = []
work: queue.Queue[str] = queue.Queue()
lock = threading.Lock()


def update(jid: str, **kw) -> None:
    with lock:
        jobs[jid].update(kw)


def cleanup() -> None:
    now = time.time()
    for d in JOBS.glob("*"):
        if d.is_dir() and now - d.stat().st_mtime > TTL:
            shutil.rmtree(d, ignore_errors=True)
            jobs.pop(d.name, None)


def first_frame(src: Path, dst: Path) -> dict:
    """First frame, heads and plates blurred, for drawing zones; also probes the video."""
    import cv2
    cap = cv2.VideoCapture(str(src))
    ok, frame = cap.read()
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    if not ok:
        raise ValueError("Could not decode this video. Please upload an MP4 (H.264 or HEVC).")
    h, w = frame.shape[:2]
    model = perception.load_detector()
    r = model.predict(frame, imgsz=IMGSZ, conf=0.3, device=0 if CUDA else "cpu", verbose=False)[0]
    import numpy as np
    b, c = r.boxes.xyxy.cpu().numpy(), r.boxes.cls.cpu().numpy().astype(int)
    privacy.blur_regions(frame, privacy.head_boxes(b[c == config.PERSON]) + privacy.find_plates(frame, b[np.isin(c, config.VEHICLES)]))
    scale = min(1.0, 1280 / w)
    cv2.imwrite(str(dst), cv2.resize(frame, (int(w * scale), int(h * scale))), [cv2.IMWRITE_JPEG_QUALITY, 85])
    return {"width": w, "height": h, "fps": round(fps, 3), "duration": round(n / fps, 2) if n > 0 else None}


def process(jid: str) -> None:
    d = JOBS / jid
    src = d / jobs[jid]["file"]
    update(jid, status="running", stage="perception", progress=0.0)

    def say(stage, frac):
        weights = {"perception": (0.0, 0.7), "events": (0.7, 0.75), "privacy": (0.75, 0.99), "done": (1.0, 1.0)}
        a, b = weights.get(stage, (0, 1))
        update(jid, stage=stage, progress=round(a + (b - a) * min(1.0, frac), 3))

    analyze.analyze_video(str(src), d, zones=lambda: jobs[jid].get("zones"), max_sec=MAX_SEC,
                          stride_sec=STRIDE, imgsz=IMGSZ, progress=say)
    doc_path = d / "result.json"
    doc = json.loads(doc_path.read_text(encoding="utf-8"))
    doc["device"] = DEVICE
    doc_path.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    update(jid, status="done", stage="done", progress=1.0)


def worker() -> None:
    while True:
        jid = work.get()
        try:
            process(jid)
        except Exception as e:  # noqa: BLE001 - reported to the user, the server keeps running
            traceback.print_exc()
            update(jid, status="error", message=str(e)[:300])
        finally:
            with lock:
                if jid in order:
                    order.remove(jid)
            (JOBS / jid / jobs[jid]["file"]).unlink(missing_ok=True)


threading.Thread(target=worker, daemon=True).start()


def status(jid: str) -> dict:
    with lock:
        j = jobs.get(jid)
        if j is None:
            raise HTTPException(404, "Unknown job (results are kept for 6 hours).")
        out = {k: v for k, v in j.items() if k not in ("file",)}
        out["queue_pos"] = order.index(jid) if j["status"] == "queued" and jid in order else 0
    return out


async def save_upload(request: Request, allowed: set[str]) -> tuple[str, Path]:
    form = await request.form()
    up = form.get("file")
    if up is None or not hasattr(up, "read"):
        raise HTTPException(400, "No file in the request.")
    ext = Path(up.filename or "x.mp4").suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type {ext}.")
    cleanup()
    jid = uuid.uuid4().hex[:12]
    d = JOBS / jid
    d.mkdir(parents=True)
    size = 0
    with open(d / f"in{ext}", "wb") as f:
        while chunk := await up.read(2 ** 20):
            size += len(chunk)
            if size > MAX_MB * 2 ** 20:
                f.close()
                shutil.rmtree(d, ignore_errors=True)
                raise HTTPException(413, f"File is larger than {MAX_MB} MB.")
            f.write(chunk)
    return jid, d / f"in{ext}"


@app.get("/api/health")
def health():
    return {"ok": True, "device": DEVICE, "cuda": CUDA, "max_sec": MAX_SEC, "max_mb": MAX_MB,
            "stride_s": STRIDE, "imgsz": IMGSZ, "queue": len(order)}


@app.post("/api/jobs")
async def create_job(request: Request):
    if len(order) >= MAX_QUEUE:
        raise HTTPException(429, "The queue is full, please try again in a minute.")
    jid, src = await save_upload(request, VIDEO_EXT)
    try:
        info = first_frame(src, src.parent / "frame.jpg")
    except Exception as e:  # noqa: BLE001
        shutil.rmtree(src.parent, ignore_errors=True)
        raise HTTPException(400, str(e)) from e
    with lock:
        jobs[jid] = {"id": jid, "status": "queued", "stage": "queued", "progress": 0.0, "message": "",
                     "file": src.name, "created": time.time(), "zones": None, "video": info,
                     "processed_sec": min(MAX_SEC, info["duration"] or MAX_SEC)}
        order.append(jid)
    work.put(jid)
    return status(jid)


@app.get("/api/jobs/{jid}")
def job_status(jid: str):
    return status(jid)


@app.get("/api/jobs/{jid}/frame")
def job_frame(jid: str):
    f = JOBS / jid / "frame.jpg"
    if not f.exists():
        raise HTTPException(404, "No frame.")
    return FileResponse(f, media_type="image/jpeg")


@app.post("/api/jobs/{jid}/zones")
async def job_zones(jid: str, request: Request):
    zones = await request.json()
    status(jid)
    update(jid, zones=zones)
    d = JOBS / jid
    if jobs[jid]["status"] == "done" and (d / "perception.npz").exists():
        p = Perception.load(d / "perception.npz")
        old = json.loads((d / "result.json").read_text(encoding="utf-8"))
        doc = analyze.build_doc(p, zones)
        for k in ("privacy", "timing"):
            doc[k] = old.get(k)
        (d / "result.json").write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    return status(jid)


@app.get("/api/jobs/{jid}/result")
def job_result(jid: str):
    f = JOBS / jid / "result.json"
    if not f.exists():
        raise HTTPException(404, "Not ready.")
    return FileResponse(f, media_type="application/json")


@app.get("/api/jobs/{jid}/video.mp4")
def job_video(jid: str):
    f = JOBS / jid / "video.mp4"
    if not f.exists():
        raise HTTPException(404, "Not ready.")
    return FileResponse(f, media_type="video/mp4")


@app.post("/api/image")
async def image(request: Request):
    jid, src = await save_upload(request, IMAGE_EXT)
    t0 = time.perf_counter()
    try:
        res = analyze.analyze_image(str(src), src.parent / "image.jpg")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not analyse this image: {e}") from e
    finally:
        src.unlink(missing_ok=True)
    res["elapsed_s"] = round(time.perf_counter() - t0, 2)
    res["image_url"] = f"/api/images/{jid}.jpg"
    return res


@app.get("/api/images/{jid}.jpg")
def image_file(jid: str):
    f = JOBS / jid / "image.jpg"
    if not f.exists():
        raise HTTPException(404, "Not found.")
    return FileResponse(f, media_type="image/jpeg")


if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="site")

"""End-to-end analysis of one video or image (built during the final).

    video -> perception (YOLO26m + ByteTrack) -> scene (drawn zones | known camera | learned)
          -> events (zone rules + zero-config rules) -> risk curve -> privacy-blurred web video -> report

Used by the web backend and by `python -m doppix.analyze <video>`.
"""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np

from . import align, config, generic, perception, privacy, report, risk, rules
from .perception import CLS, CONF, K, X1, X2, Y1, Y2, Perception
from .scene import Scene
from .tracks import light_state

OUT_W = 960            # web video width
OUT_FPS = 15.0         # web video frame rate (half of a 30 fps source: smaller files, same timeline)
ZONE_RULES = {"red_light", "stop_line", "jaywalking", "failure_to_yield", "stopped_vehicle", "congestion"}
# On a newly drawn camera the zone stopped/congestion rules (geometry of our reference junction) are not
# used: the zero-config versions are. Drawn zones add only the crossing and signal rules.
DRAWN_RULES = {"red_light", "stop_line", "jaywalking", "failure_to_yield"}


def ffmpeg() -> str:
    import shutil
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def learned_carriageway(ff, p: Perception) -> list[np.ndarray]:
    """Road outline learned from where vehicles move (zero-config), in scene coordinates."""
    from .autoscene import drivable_mask, frame_size
    from .scene import H as SH, W as SW
    m = drivable_mask(ff, 4).astype(np.uint8)
    if not m.any():
        return []
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    big = cv2.resize(m * 255, (m.shape[1] * 8, m.shape[0] * 8), interpolation=cv2.INTER_NEAREST)
    cnts, _ = cv2.findContours(big, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    fw, fh = frame_size(p)
    out = []
    for c in cnts:
        if cv2.contourArea(c) < 64 * 6:                  # ignore specks (< ~6 cells)
            continue
        pts = c.reshape(-1, 2).astype(np.float32) / 8 * ff.cell          # -> frame px
        out.append((pts / [fw, fh] * [SW, SH]).astype(np.float32))        # -> scene px
    return out


def choose_scene(p: Perception, zones: dict | None, ff=None) -> tuple[Scene | None, str]:
    """Drawn zones win; else our reference intersection if the background matches; else none.
    Drawn zones without a road outline get the road learned from traffic."""
    if zones and any(zones.get(k) for k in ("carriageway", "crosswalk", "stop_line", "traffic_light")):
        scene = Scene.from_zones(zones)
        if not scene.carriageway and ff is not None:
            scene.carriageway = learned_carriageway(ff, p)
        return scene, "drawn"
    ref = align.load_ref()
    if ref is not None and p.bg is not None:
        M = align.estimate(ref, p.bg)
        if M is not None:
            return Scene.load().transformed(M), "reference"
    return None, "learned"


def events_for(p: Perception, zones: dict | None):
    """All events with the track ids behind each; zone rules replace the generic stop/congestion."""
    g_ev, g_inv, ff = generic.detect(p)
    scene, scene_mode = choose_scene(p, zones, ff)
    events, involved = [], []
    if scene is not None:
        z_ev, z_inv = rules.detect(p, scene, detail=True, align=False)
        own = DRAWN_RULES if scene_mode == "drawn" else ZONE_RULES
        for e, inv in zip(z_ev, z_inv):
            if e[2] in own:
                events.append(e)
                involved.append(inv)
        keep = [i for i, e in enumerate(g_ev) if e[2] not in own]
    else:
        keep = range(len(g_ev))
    events += [g_ev[i] for i in keep]
    involved += [g_inv[i] for i in keep]
    order = np.argsort([e[0] for e in events], kind="stable")
    events = [[round(float(events[i][0]), 3), round(float(events[i][1]), 3), events[i][2]] for i in order]
    involved = [involved[i] for i in order]
    light = light_state(p, scene) if scene is not None else np.full(len(p.frame_idx), -1.0)
    return events, involved, scene, scene_mode, ff, light


def render_private_video(src: str, p: Perception, dst: Path, max_sec: float | None = None, progress=None) -> dict:
    """Second pass over the video: blur heads and plates, write a small H.264 for the browser."""
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or p.fps
    n = p.n_frames if max_sec is None else min(p.n_frames, int(max_sec * fps))
    step = max(1, round(fps / OUT_FPS))
    W0, H0 = p.width, p.height
    out_h = int(round(OUT_W * H0 / W0 / 2) * 2)
    proc = subprocess.Popen([ffmpeg(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
                             "-s", f"{OUT_W}x{out_h}", "-r", f"{fps / step:.4f}", "-i", "-", "-c:v", "libx264",
                             "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                             str(dst)], stdin=subprocess.PIPE)
    k_of = {int(fi): k for k, fi in enumerate(p.frame_idx)}
    dets_by_k: dict[int, np.ndarray] = {}
    for r in p.dets:
        dets_by_k.setdefault(int(r[K]), []).append(r)
    blur_now: list = []
    plates_total = heads_total = 0
    i = 0
    while i < n:
        ok, frame = cap.read()
        if not ok:
            break
        if i in k_of or not blur_now and i % step == 0:
            # nearest processed frame at or before i -> its persons and vehicles
            k = k_of.get(i)
            if k is None:
                k = int(np.searchsorted(p.frame_idx, i, side="right")) - 1
            rows = np.asarray(dets_by_k.get(max(k, 0), []))
            blur_now = []
            if len(rows):
                rows = rows[rows[:, CONF] >= 0.25]
                px = rows[:, [X1, Y1, X2, Y2]] * [W0, H0, W0, H0]
                persons = px[rows[:, CLS] == config.PERSON]
                vehicles = px[np.isin(rows[:, CLS], config.VEHICLES)]
                heads = privacy.head_boxes(persons)
                plates = privacy.find_plates(frame, vehicles)
                blur_now = heads + plates
                heads_total += len(heads)
                plates_total += len(plates)
        if i % step == 0:
            privacy.blur_regions(frame, blur_now)
            proc.stdin.write(cv2.resize(frame, (OUT_W, out_h), interpolation=cv2.INTER_AREA).tobytes())
            if progress and (i // step) % 30 == 0:
                progress(i / max(1, n))
        i += 1
    cap.release()
    proc.stdin.close()
    proc.wait()
    return {"plates_blurred": plates_total, "heads_blurred": heads_total, "fps": round(fps / step, 2)}


def analyze_video(src: str, workdir: Path, zones=None, max_sec: float | None = None,
                  stride_sec: float = config.PART_A_STRIDE_SEC, imgsz: int = config.IMGSZ, progress=None) -> dict:
    """Full pipeline. progress(stage, fraction)."""
    from .docbuild import make_doc
    workdir.mkdir(parents=True, exist_ok=True)
    say = progress or (lambda *a: None)
    t0 = time.perf_counter()
    say("perception", 0.0)
    p = perception.run(src, stride_sec=stride_sec, max_sec=max_sec, imgsz=imgsz,
                       progress=lambda i, n: say("perception", i / max(1, n)))
    t_perc = time.perf_counter() - t0
    p.save(workdir / "perception.npz")
    say("events", 0.0)
    doc = build_doc(p, zones() if callable(zones) else zones)    # zones may be drawn while perception runs
    say("privacy", 0.0)
    t1 = time.perf_counter()
    priv = render_private_video(src, p, workdir / "video.mp4", max_sec, progress=lambda f: say("privacy", f))
    doc["privacy"] = priv
    doc["timing"] = {"perception_s": round(t_perc, 1), "privacy_render_s": round(time.perf_counter() - t1, 1),
                     "total_s": round(time.perf_counter() - t0, 1), "video_s": round(p.duration, 1),
                     "stride_s": stride_sec, "imgsz": imgsz}
    (workdir / "result.json").write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    say("done", 1.0)
    return doc


def build_doc(p: Perception, zones: dict | None) -> dict:
    """Events + risk + report for an already perceived video (cheap: re-run when zones change)."""
    from .docbuild import make_doc
    events, involved, scene, scene_mode, ff, light = events_for(p, zones)
    curve = risk.replay(p)
    doc = make_doc(p, scene if scene is not None else Scene(), light, events, curve, involved=involved,
                   scene_mode=scene_mode, flow=generic.flow_json(ff, p), zones_in=zones or {})
    doc["report"] = report.build(p, events, curve, ff)
    return doc


def analyze_image(src: str, dst: Path) -> dict:
    """Single image: detections, counts, plates and heads blurred."""
    from ultralytics import YOLO
    import torch
    img = cv2.imread(src)
    if img is None:
        raise ValueError("cannot read image")
    h, w = img.shape[:2]
    model = perception.load_detector()
    dev = 0 if torch.cuda.is_available() else "cpu"
    r = model.predict(img, imgsz=config.IMGSZ, conf=0.3, device=dev, verbose=False)[0]
    boxes = r.boxes.xyxy.cpu().numpy()
    cls = r.boxes.cls.cpu().numpy().astype(int)
    conf = r.boxes.conf.cpu().numpy()
    persons, vehicles = boxes[cls == config.PERSON], boxes[np.isin(cls, config.VEHICLES)]
    plates = privacy.find_plates(img, vehicles)
    heads = privacy.head_boxes(persons)
    privacy.blur_regions(img, heads + plates)
    scale = min(1.0, 1600 / w)
    cv2.imwrite(str(dst), cv2.resize(img, (int(w * scale), int(h * scale))), [cv2.IMWRITE_JPEG_QUALITY, 88])
    counts = {}
    for c in cls:
        counts[config.CLASS_NAMES[c]] = counts.get(config.CLASS_NAMES[c], 0) + 1
    light = [config.CLASS_NAMES[c] for c in cls if c in config.LIGHTS]
    return {"kind": "image", "width": w, "height": h, "counts": counts,
            "objects": [{"cls": config.CLASS_NAMES[c], "conf": round(float(s), 3),
                         "box": [round(float(v), 4) for v in (b / [w, h, w, h])]} for b, c, s in zip(boxes, cls, conf)],
            "plates_blurred": len(plates), "heads_blurred": len(heads),
            "traffic_light": (max(set(light), key=light.count) if light else None)}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--out", default="_out")
    ap.add_argument("--max-sec", type=float)
    a = ap.parse_args()
    d = analyze_video(a.video, Path(a.out), max_sec=a.max_sec, progress=lambda s, f: print(f"{s} {f:.0%}", end="\r"))
    print("\n", d["scene_mode"], len(d["events"]), "events", d["timing"], d["privacy"])

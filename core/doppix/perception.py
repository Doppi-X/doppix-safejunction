"""Perception: video -> kadrlar bo'yicha trayektoriyalar (detektor + ByteTrack).

Natija — `Perception`: har bir qayta ishlangan kadr uchun vaqt va o'sha kadrdagi
barcha trek qilingan obyektlar. Koordinatalar 0..1 ga normallashtirilgan (sahna
sxemasi ham shunday), shuning uchun kadr o'lchamiga bog'liq emas.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from . import config

# dets ustunlari
K, TID, CLS, CONF, X1, Y1, X2, Y2 = range(8)


@dataclass
class Perception:
    fps: float
    n_frames: int
    width: int
    height: int
    frame_idx: np.ndarray   # (N,) qayta ishlangan kadrlar raqami
    dets: np.ndarray        # (M, 8): [k, track_id, cls, conf, x1, y1, x2, y2]; k — frame_idx dagi indeks
    bg: np.ndarray | None = None   # videoning fon kadri (kulrang, align.REF_W) — sahnani moslash uchun

    @property
    def duration(self) -> float:
        return self.n_frames / self.fps if self.fps else 0.0

    @property
    def times(self) -> np.ndarray:
        return self.frame_idx / self.fps

    def save(self, path: Path) -> None:
        extra = {"bg": self.bg} if self.bg is not None else {}
        np.savez_compressed(path, fps=self.fps, n_frames=self.n_frames, width=self.width, height=self.height,
                            frame_idx=self.frame_idx, dets=self.dets, **extra)

    @classmethod
    def load(cls, path: Path) -> "Perception":
        z = np.load(path)
        return cls(float(z["fps"]), int(z["n_frames"]), int(z["width"]), int(z["height"]), z["frame_idx"], z["dets"],
                   z["bg"] if "bg" in z.files else None)


_model = None


_models: dict = {}


def load_detector(weights: Path | None = None):
    """Model bir marta yuklanadi (bir nechta video uchun qayta ishlatiladi)."""
    global _model
    path = Path(weights or config.WEIGHTS)
    if path not in _models:
        import torch
        from ultralytics import YOLO
        torch.manual_seed(config.SEED)
        _models[path] = YOLO(str(path))
    _model = _models[path]
    return _model


def class_map(weights: Path) -> dict | None:
    return config.GENERAL_MAP if Path(weights).name == config.GENERAL_WEIGHTS.name else None


def _road_users(model, frame: np.ndarray, cmap: dict | None) -> int:
    r = model.predict(frame, imgsz=config.IMGSZ, conf=0.25, device=_device(), verbose=False)[0]
    cls, conf = r.boxes.cls.cpu().numpy().astype(int), r.boxes.conf.cpu().numpy()
    users = [c for c in cls] if cmap is None else [cmap[c] for c in cls if c in cmap]
    keep = np.array([u in (config.PERSON, config.BICYCLE, *config.VEHICLES) for u in users], dtype=bool)
    conf = conf if cmap is None else conf[[c in cmap for c in cls]]
    return int((conf[keep] >= 0.5).sum()) if len(keep) else 0


def choose_weights(frames: list[np.ndarray]) -> tuple[Path, dict]:
    """Per-camera detector choice (built during the final): score a few frames with each candidate.

    The daylight model (the one the rules were tuned on) is kept unless another model finds clearly more
    confident road users: a cheap, label-free check that picks the model that actually sees this camera."""
    cands = [Path(config.WEIGHTS)] + [w for w in (config.LOWLIGHT_WEIGHTS, config.GENERAL_WEIGHTS) if w.exists()]
    scores = {w.name: sum(_road_users(load_detector(w), f, class_map(w)) for f in frames) for w in cands}
    best = Path(config.WEIGHTS)
    for w in cands[1:]:
        if scores[w.name] > config.SWITCH_RATIO * scores[best.name] + 2:
            best = w
    return best, scores


def sample_frames(video_path: str, max_sec: float | None, n: int = 6) -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or int(fps * 10)
    if max_sec:
        total = min(total, int(max_sec * fps))
    out = []
    for q in np.linspace(0.05, 0.95, n):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(total * q))
        ok, f = cap.read()
        if ok:
            if f.shape[1] > config.FRAME_W:
                f = cv2.resize(f, (config.FRAME_W, round(f.shape[0] * config.FRAME_W / f.shape[1])), interpolation=cv2.INTER_AREA)
            out.append(f)
    cap.release()
    return out


def detect_image(frame: np.ndarray, conf: float = 0.3, imgsz: int = config.IMGSZ):
    """One image: (boxes xyxy px, our class ids, conf, weights name), detector chosen on this frame."""
    f = frame if frame.shape[1] <= config.FRAME_W else cv2.resize(frame, (config.FRAME_W, round(frame.shape[0] * config.FRAME_W / frame.shape[1])))
    w, _ = choose_weights([f])
    cmap = class_map(w)
    r = load_detector(w).predict(frame, imgsz=imgsz, conf=conf, device=_device(), verbose=False)[0]
    b, c, s = r.boxes.xyxy.cpu().numpy(), r.boxes.cls.cpu().numpy().astype(int), r.boxes.conf.cpu().numpy()
    if cmap:
        keep = np.array([k in cmap for k in c], dtype=bool)
        b, s, c = b[keep], s[keep], np.array([cmap[k] for k in c[keep]], dtype=int)
    return b, c, s, w.name


def _device():
    import torch
    return 0 if torch.cuda.is_available() else "cpu"


def run(video_path: str, stride_sec: float = config.PART_A_STRIDE_SEC, progress=None,
        max_sec: float | None = None, imgsz: int = config.IMGSZ, budget_sec: float | None = None) -> Perception:
    """Videoni boshidan oxirigacha o'qiydi; har `stride_sec` da bir kadrni detektor+tracker'dan o'tkazadi.

    H.264 da kadrga sakrash (seek) qimmat va noaniq — shuning uchun ketma-ket o'qiymiz,
    keraksiz kadrlar faqat grab() qilinadi (rasmga aylantirilmaydi).
    `max_sec` — faqat boshidagi shuncha soniya (sayt demosi uchun); `imgsz` — detektor kirish o'lchami.
    `budget_sec` — shu vaqtga sig'ish kerak: kutilgan tugash vaqti oshib ketsa, qadam ikki barobar oshiriladi.
    """
    import time
    t_start = time.perf_counter()
    weights, scores = choose_weights(sample_frames(video_path, max_sec))
    model = load_detector(weights)
    cmap = class_map(weights)
    track_kw = {"classes": sorted(cmap)} if cmap else {}
    dev = _device()
    cv2.setNumThreads(os.cpu_count() or 1)   # ba'zi OpenCV build'larida standart — 1 oqim (resize sekin)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    limit = int(max_sec * fps) if max_sec is not None else None   # None — video oxirigacha
    if limit is not None and n_frames > 0:
        n_frames = min(n_frames, limit)
    stride = base_stride = max(1, round(stride_sec * fps))
    stride_changes: list[tuple[int, int]] = []
    last_check: tuple[float, int] | None = None
    half_kw = {"quantize": 16} if dev != "cpu" else {}   # GPU'da fp16 — ~2x tez

    # ByteTrack holati har video uchun yangidan boshlanadi
    if getattr(model, "predictor", None) is not None and hasattr(model.predictor, "trackers"):
        del model.predictor.trackers

    frame_ids, rows = [], []
    bg_frames, bg_every = [], max(1, n_frames // 25)     # ~25 ta kadr fon uchun
    idx = 0
    try:
        while limit is None or idx < limit:
            if idx % stride:
                if not cap.grab():
                    break
                idx += 1
                continue
            ok, frame = cap.read()
            if not ok:
                break
            h, w = frame.shape[:2]
            if w > config.FRAME_W:
                frame = cv2.resize(frame, (config.FRAME_W, round(h * config.FRAME_W / w)), interpolation=cv2.INTER_AREA)
            if (idx // stride) % max(1, bg_every // stride) == 0 and len(bg_frames) < 30:
                bg_frames.append(frame.copy())
            res = model.track(frame, persist=True, tracker=str(config.TRACKER_CFG), imgsz=imgsz,
                              conf=config.DET_CONF, device=dev, verbose=False, **half_kw, **track_kw)[0]
            k = len(frame_ids)
            frame_ids.append(idx)
            b = res.boxes
            if b is not None and len(b) and b.id is not None:
                xyxyn = b.xyxyn.cpu().numpy()
                ids = b.id.cpu().numpy()
                cls = b.cls.cpu().numpy()
                conf = b.conf.cpu().numpy()
                for i in range(len(ids)):
                    c = cls[i] if cmap is None else cmap.get(int(cls[i]))
                    if c is not None:
                        rows.append((k, ids[i], c, conf[i], *xyxyn[i]))
            if progress and k % 10 == 0:
                progress(idx, n_frames)
            if budget_sec and n_frames > 0 and k and k % 10 == 0:
                now = time.perf_counter()
                if last_check:
                    rate = (now - last_check[0]) / max(1, idx - last_check[1])   # s / video kadr (hozirgi qadamda)
                    projected = (now - t_start) + (n_frames - idx) * rate
                    if projected > budget_sec and stride < 8 * base_stride:
                        stride *= 2             # sekinlik: kadrlarni siyrakroq olamiz
                        stride_changes.append((idx, stride))
                last_check = (now, idx)
            idx += 1
    finally:
        cap.release()

    from .align import background
    dets = np.asarray(rows, dtype=np.float32).reshape(-1, 8)
    bg = background(bg_frames) if bg_frames else None
    p = Perception(float(fps), n_frames, width, height, np.asarray(frame_ids, dtype=np.int32), dets, bg)
    p.detector = weights.name
    p.detector_scores = scores
    return p

"""Perception + hodisalar + risk -> sayt uchun bitta JSON hujjat (namuna videolar va jonli demo uchun umumiy)."""
from __future__ import annotations

import numpy as np

from . import config
from .perception import CLS, CONF, K, TID, X1, X2, Y1, Y2, Perception
from .scene import H, W, Scene, inside

TRACK_FPS = 5
SHOW_CLASSES = [config.PERSON, *config.VEHICLES, config.BICYCLE]


def light_mask(p: Perception, scene: Scene) -> np.ndarray:
    """Sahnadagi svetofor hududidagi svetofor detektsiyalari (boshqalari ko'rsatilmaydi)."""
    d = p.dets
    is_light = np.isin(d[:, CLS], config.LIGHTS)
    ok = np.zeros(len(d), bool)
    if scene.lights and is_light.any():
        c = np.stack([(d[is_light, X1] + d[is_light, X2]) / 2 * W, (d[is_light, Y1] + d[is_light, Y2]) / 2 * H], 1)
        ok[np.where(is_light)[0]] = inside(scene.lights[0], c, margin=-25)
    return ok


def compact_tracks(p: Perception, extra: np.ndarray) -> list:
    """[[t, tid, cls, x1, y1, x2, y2, tid, ...], ...] ~TRACK_FPS da, koordinatalar 0..1000."""
    times = p.times
    if not len(times):
        return []
    dt = float(np.median(np.diff(times))) if len(times) > 1 else 0.1
    every = max(1, round(1 / TRACK_FPS / dt))
    d = p.dets
    d = d[(np.isin(d[:, CLS], SHOW_CLASSES) & (d[:, CONF] >= 0.3)) | extra]
    d = d[np.argsort(d[:, K], kind="stable")]
    ks = d[:, K].astype(int)
    frames = []
    for k in range(0, len(times), every):
        flat = [round(float(times[k]), 2)]
        for r in d[ks == k]:
            flat += [int(r[TID]), int(r[CLS]), *[int(round(v * 1000)) for v in r[[X1, Y1, X2, Y2]]]]
        frames.append(flat)
    return frames


def zones_json(scene: Scene) -> dict:
    n = lambda polys: [np.round(p / [W, H], 4).tolist() for p in polys]
    return {"carriageway": n(scene.carriageway), "crosswalks": n(scene.crosswalks), "stop_lines": n(scene.stop_lines),
            "lights": n(scene.lights), "islands": n(scene.islands)}


def phases(times: np.ndarray, state: np.ndarray) -> list:
    out, prev = [], None
    for t, s in zip(times, state):
        if s != prev:
            out.append([round(float(t), 2), int(s)])
            prev = s
    return out


def make_doc(p: Perception, scene: Scene, light: np.ndarray, events: list, risk_curve, **extra) -> dict:
    return {"duration": round(p.duration, 2), "fps": round(p.fps, 3), "width": p.width, "height": p.height,
            "n_frames": p.n_frames, "events": events,
            "risk": [[round(float(t), 2), round(float(s), 3)] for t, s in risk_curve],
            "light": phases(p.times, light), "zones": zones_json(scene),
            "tracks": compact_tracks(p, light_mask(p, scene)), "classes": config.CLASS_NAMES, **extra}

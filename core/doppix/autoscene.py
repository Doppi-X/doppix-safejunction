"""Zero-config scene learning (built during the final).

Any fixed traffic camera, no drawn zones: the scene is learned from the traffic itself.

* Drivable area: grid cells that moving vehicles actually pass through.
* Flow field: the dominant direction of motion per cell, plus how consistent it is
  (a one-way lane gives ~1, a turning area or a crossroads centre gives ~0).

All rules built on it are leave-one-out: a track's own samples are removed before
it is judged, so one wrong-way car cannot "teach" the field its own direction.
Coordinates are pixels of the frame scaled to FRAME_W wide, with the real aspect ratio.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import config
from .perception import CLS, CONF, K, TID, X1, X2, Y1, Y2, Perception

GRID_W = 32                      # cells across the frame (rows follow the aspect ratio)


@dataclass
class Track:
    tid: int
    cls: int
    t: np.ndarray                # (n,) s
    box: np.ndarray              # (n,4) px
    conf: np.ndarray

    @property
    def foot(self) -> np.ndarray:
        return np.stack([(self.box[:, 0] + self.box[:, 2]) / 2, self.box[:, 3]], 1)

    @property
    def size(self) -> np.ndarray:
        """Box diagonal (px): a scale for 'how far is far' at this depth."""
        return np.hypot(self.box[:, 2] - self.box[:, 0], self.box[:, 3] - self.box[:, 1])

    def velocity(self, window: float = 1.0) -> np.ndarray:
        """(n,2) px/s of the foot point over the last `window` seconds."""
        f, v, j = self.foot, np.zeros((len(self.t), 2)), 0
        for i in range(len(self.t)):
            while self.t[i] - self.t[j] > window:
                j += 1
            if self.t[i] > self.t[j]:
                v[i] = (f[i] - f[j]) / (self.t[i] - self.t[j])
        if len(v) > 1:
            v[0] = v[1]
        return v


def frame_size(p: Perception) -> tuple[float, float]:
    """Pixel frame used for all geometry: FRAME_W wide, real aspect ratio."""
    w = float(config.FRAME_W)
    return w, w * (p.height / p.width if p.width else 9 / 16)


def build_tracks(p: Perception, min_len: int = 5, min_conf: float = 0.3) -> list[Track]:
    W, H = frame_size(p)
    d = p.dets[p.dets[:, CONF] >= min_conf]
    out = []
    for tid in np.unique(d[:, TID]).astype(int):
        r = d[d[:, TID] == tid]
        r = r[np.argsort(r[:, K])]
        if len(r) < min_len:
            continue
        cls = int(np.argmax(np.bincount(r[:, CLS].astype(int), weights=r[:, CONF], minlength=len(config.CLASS_NAMES))))
        out.append(Track(tid, cls, p.times[r[:, K].astype(int)], r[:, [X1, Y1, X2, Y2]] * [W, H, W, H], r[:, CONF]))
    return out


@dataclass
class FlowField:
    gw: int
    gh: int
    cell: float
    vec: np.ndarray              # (gh, gw, 2) sum of unit velocity vectors
    count: np.ndarray            # (gh, gw) moving samples
    by_track: dict               # tid -> (cells (n,2), unit vectors (n,2)) for leave-one-out

    def cell_of(self, pts: np.ndarray) -> np.ndarray:
        c = np.floor(pts / self.cell).astype(int)
        c[:, 0] = np.clip(c[:, 0], 0, self.gw - 1)
        c[:, 1] = np.clip(c[:, 1], 0, self.gh - 1)
        return c

    def without(self, tid: int) -> tuple[np.ndarray, np.ndarray]:
        """Field with one track's own samples removed."""
        vec, cnt = self.vec.copy(), self.count.copy()
        if tid in self.by_track:
            cells, units = self.by_track[tid]
            np.subtract.at(vec, (cells[:, 1], cells[:, 0]), units)
            np.subtract.at(cnt, (cells[:, 1], cells[:, 0]), 1)
        return vec, cnt


MOVING_REL = 0.5                 # body/box sizes per second: below this the vehicle is not "moving"


def learn_flow(p: Perception, tracks: list[Track]) -> FlowField:
    W, H = frame_size(p)
    cell = W / GRID_W
    gw, gh = GRID_W, int(np.ceil(H / cell))
    vec, cnt, by_track = np.zeros((gh, gw, 2)), np.zeros((gh, gw)), {}
    ff = FlowField(gw, gh, cell, vec, cnt, by_track)
    for tr in tracks:
        if tr.cls not in config.VEHICLES:
            continue
        v = tr.velocity()
        sp = np.linalg.norm(v, axis=1)
        m = sp / np.maximum(tr.size, 1) > MOVING_REL
        if not m.any():
            continue
        cells = ff.cell_of(tr.foot[m])
        units = v[m] / sp[m, None]
        np.add.at(vec, (cells[:, 1], cells[:, 0]), units)
        np.add.at(cnt, (cells[:, 1], cells[:, 0]), 1)
        by_track[tr.tid] = (cells, units)
    return ff


def drivable_mask(ff: FlowField, min_count: int = 8) -> np.ndarray:
    """Cells that moving vehicles really use (the learned carriageway)."""
    return ff.count >= min_count

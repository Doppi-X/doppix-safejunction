"""Privacy by default (built during the final): every face and plate is blurred before
anything leaves the server.

* Plates: two-stage. Our detector finds vehicles; an open plate detector (YOLOv11,
  morsetechlab, AGPL-3.0) runs only inside each vehicle crop. Small plates at a distance
  are found far more reliably than on the full frame.
* Faces: the head region (top ~22 % of every person box) is blurred. At CCTV distances
  this needs no face detector and never misses a person the tracker sees.
* Second opinion (final): our detector is tuned to small, distant road users and can miss people
  close to a street-level camera. The general COCO model also runs on every blurred frame, and the
  union of both is blurred: for privacy, recall beats precision.
Boxes are expanded so the blur still covers the target between processed frames.
"""
from __future__ import annotations

import cv2
import numpy as np

from . import config

_plate_model = None


def plate_model():
    global _plate_model
    if _plate_model is None:
        from ultralytics import YOLO
        _plate_model = YOLO(str(config.PLATE_WEIGHTS))
    return _plate_model


def find_plates(frame: np.ndarray, vehicle_boxes: np.ndarray, min_w: int = 36, conf: float = 0.25) -> list[np.ndarray]:
    """vehicle_boxes: (n,4) px in `frame`. Returns plate boxes (px) in `frame`."""
    crops, origin = [], []
    h, w = frame.shape[:2]
    for x1, y1, x2, y2 in np.asarray(vehicle_boxes, dtype=int):
        x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)
        if x2 - x1 >= min_w and y2 - y1 >= min_w // 2:
            crops.append(frame[y1:y2, x1:x2])
            origin.append((x1, y1))
    if not crops:
        return []
    import torch
    dev = 0 if torch.cuda.is_available() else "cpu"
    out = []
    for (ox, oy), r in zip(origin, plate_model().predict(crops, imgsz=320, conf=conf, device=dev, verbose=False)):
        for b in r.boxes.xyxy.cpu().numpy():
            out.append(b + [ox, oy, ox, oy])
    return out


_general = None


def general_boxes(frame: np.ndarray, conf: float = 0.2) -> tuple[np.ndarray, np.ndarray]:
    """Persons and vehicles from the general COCO model (own instance, never used for tracking)."""
    global _general
    if not config.GENERAL_WEIGHTS.exists():
        return np.zeros((0, 4)), np.zeros((0, 4))
    if _general is None:
        from ultralytics import YOLO
        _general = YOLO(str(config.GENERAL_WEIGHTS))
    import torch
    r = _general.predict(frame, imgsz=960, conf=conf, classes=[0, 1, 2, 3, 5, 7],
                         device=0 if torch.cuda.is_available() else "cpu", verbose=False)[0]
    b, c = r.boxes.xyxy.cpu().numpy(), r.boxes.cls.cpu().numpy().astype(int)
    return b[c == 0], b[np.isin(c, [2, 3, 5, 7])]


def _iou(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if not len(a) or not len(b):
        return np.zeros((len(a), len(b)))
    x1 = np.maximum(a[:, None, 0], b[None, :, 0]); y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    x2 = np.minimum(a[:, None, 2], b[None, :, 2]); y2 = np.minimum(a[:, None, 3], b[None, :, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area = lambda z: (z[:, 2] - z[:, 0]) * (z[:, 3] - z[:, 1])
    return inter / (area(a)[:, None] + area(b)[None, :] - inter + 1e-9)


def private_regions(frame: np.ndarray, persons, vehicles) -> tuple[list, int, int]:
    """Head + plate boxes to blur: our detections united with the general model's. Returns (boxes, heads, plates)."""
    persons = np.asarray(persons, dtype=float).reshape(-1, 4)
    vehicles = np.asarray(vehicles, dtype=float).reshape(-1, 4)
    gp, gv = general_boxes(frame)
    if len(gp):
        persons = np.vstack([persons, gp[_iou(gp, persons).max(1, initial=0) < 0.5]])
    if len(gv):
        vehicles = np.vstack([vehicles, gv[_iou(gv, vehicles).max(1, initial=0) < 0.5]])
    heads, plates = head_boxes(persons), find_plates(frame, vehicles)
    return heads + plates, len(heads), len(plates)


def head_boxes(person_boxes: np.ndarray) -> list[np.ndarray]:
    out = []
    for x1, y1, x2, y2 in np.asarray(person_boxes, dtype=float):
        hgt = y2 - y1
        out.append(np.array([x1, y1, x2, y1 + 0.22 * hgt]))
    return out


def blur_regions(frame: np.ndarray, boxes, grow: float = 0.25, min_px: int = 4) -> np.ndarray:
    """Strong pixelate+blur of each box (expanded by `grow` of its size)."""
    h, w = frame.shape[:2]
    for b in boxes:
        x1, y1, x2, y2 = b
        gx, gy = (x2 - x1) * grow, (y2 - y1) * grow
        x1, y1 = int(max(0, x1 - gx)), int(max(0, y1 - gy))
        x2, y2 = int(min(w, x2 + gx)), int(min(h, y2 + gy))
        if x2 - x1 < min_px or y2 - y1 < min_px:
            continue
        roi = frame[y1:y2, x1:x2]
        small = cv2.resize(roi, (max(1, (x2 - x1) // 8), max(1, (y2 - y1) // 8)), interpolation=cv2.INTER_LINEAR)
        frame[y1:y2, x1:x2] = cv2.GaussianBlur(cv2.resize(small, (x2 - x1, y2 - y1), interpolation=cv2.INTER_NEAREST), (0, 0), 3)
    return frame

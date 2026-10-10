"""Low-light enhancement before detection — TRIED AND REJECTED (built during the final).

Result (eval/results/robustness.json): on synthetic night frames mAP50 fell from 0.390 to 0.266,
because lifting the dark frame also amplifies sensor noise. Not used in the product; kept as a
documented negative result.

If a frame is dark (mean luma below DARK), lift it with a gamma curve chosen so the mean
reaches TARGET, then equalise local contrast on the luma channel (CLAHE). Bright frames
pass through untouched, so daytime accuracy is unchanged.
"""
import cv2
import numpy as np

DARK = 75.0
TARGET = 115.0
_clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))


def is_dark(frame: np.ndarray) -> bool:
    small = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_AREA)
    return float(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).mean()) < DARK


def enhance(frame: np.ndarray) -> np.ndarray:
    small = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_AREA)
    mean = float(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).mean())
    if mean >= DARK:
        return frame
    gamma = np.log(TARGET / 255) / np.log(max(mean, 1) / 255)
    lut = np.clip(((np.arange(256) / 255) ** gamma) * 255, 0, 255).astype(np.uint8)
    lifted = cv2.LUT(frame, lut)
    lab = cv2.cvtColor(lifted, cv2.COLOR_BGR2LAB)
    lab[..., 0] = _clahe.apply(lab[..., 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

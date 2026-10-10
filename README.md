# Do'ppiX SafeJunction

**Turn any traffic camera into a road-safety auditor.** WIUT Hackathon 2026 Final · Computer Vision track · mode: **Startup**

SafeJunction watches the CCTV a city already has. It finds red-light running, drivers
not yielding to pedestrians, wrong-way driving, stopped vehicles, congestion and near
misses, and tells the traffic engineer what to change, before anyone is hurt. Faces
and number plates are blurred on the server before any video is shown.

* **Live app:** https://giyos1212-safejunction.static.hf.space (frontend: Hugging Face; API: our GPU server)
* **Deploys:** every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on our self-hosted GPU runner. The Actions tab is the deployment history.

```
video ─► YOLO26m (our fine-tune) + ByteTrack ─► tracks ─┬─► scene: drawn zones │ known camera │ learned from traffic
                                                        ├─► events: zone rules + zero-config rules
                                                        ├─► causal time-to-collision risk
                                                        ├─► privacy: plate detector inside vehicle boxes + head blur
                                                        └─► report: rates, hotspots, recommendations ─► web app
```

## What was built when

The final allows our own elimination-stage code if it is declared. The first commit
(`Import elimination-stage code`) brings it in unchanged. Everything after it was built
during the final, as the git history shows.

| Built **before** the final (elimination) | Built **during** the final |
|---|---|
| YOLO26m fine-tune on our 12,990 labeled boxes of a Tashkent intersection (`weights/detector.pt`) | Zero-config scene learning: drivable area and per-cell lane directions learned from traffic (`core/doppix/autoscene.py`) |
| ByteTrack tracking, camera-shift alignment | Scene-agnostic rules for any camera: wrong-way, stopped vehicle, congestion, near miss (`generic.py`) |
| Zone rules for one intersection: red light, stop line, jaywalking, failure to yield, stopped vehicle, congestion | Zones drawn in the browser for a new camera (`Scene.from_zones`, `ZoneEditor`) |
| Causal TTC accident risk | Privacy: two-stage plate blur + head blur (`privacy.py`) |
| Elimination website | End-to-end analysis API: video jobs, images, re-run rules with new zones (`analyze.py`, `backend/app.py`) |
| | City report with rule-based recommendations (`report.py`) |
| | City dashboard: every analysed camera ranked by a severity-weighted risk index, with hotspot maps and a before/after comparison (`/api/network`, `Network.jsx`) |
| | Hotspot map (where each event's road users stood) and a printable PDF report for the engineer (`report.hotspots`, `printReport.js`) |
| | Site sample clips and frames re-rendered with faces and plates blurred (`deploy/privacy_site_assets.py`) |
| | Post-encroachment-time (PET) conflicts with severity bins and exposure-normalised rates (`conflicts.py`) |
| | Empirical Bayes (Highway Safety Manual) ranking in the dashboard |
| | Low-light detector and day/night routing (`perception.weights_for`) |
| | Robustness test (night, rain, fog, blur, low bit-rate) and a robust fine-tune (`eval/`) |
| | Wrong-way injection test, unit economics, CI/CD to our GPU server |

## Run it

```bash
pip install -r requirements.txt            # Python 3.10+
# web API (GPU used automatically when available)
uvicorn app:app --host 0.0.0.0 --port 7870 --app-dir backend
# frontend
cd frontend && npm install && npm run dev  # or: npm run build -> dist/
# one video from the command line
cd core && python -m doppix.analyze path/to/video.mp4 --out ../_out
```

Weights are in the repo: `weights/detector.pt` (44 MB, ours) and `weights/plate.pt` (19 MB, see licences).
The frontend finds the API through `data/api.json`, which `deploy/serve.py` publishes when the GPU server starts.

## How it works

1. **Perception:** our YOLO26m fine-tune detects 6 road-user classes and the traffic-light state (`light_red` / `light_not_red`). The input is resized to 1920 px, the detector runs at imgsz 1280 on every 3rd frame (~10 fps), and ByteTrack tracks each object.
   **Detector choice per camera (final, `perception.choose_weights`):** there are three candidates:
   * our daylight fine-tune `detector.pt`;
   * our night/rain/blur fine-tune `detector_lowlight.pt`;
   * the general COCO-pretrained YOLO26m `general_coco.pt`.

   Each scores 6 frames spread over the clip, counting confident (≥ 0.5) road users. The daylight model, which the rules were tuned on, is kept unless another finds more than 1.25× + 2 as many.

   Why: on 7 open-licence clips from other cities (below), our fine-tune barely saw anything from a drone at night (3 confident road users in 4 frames, COCO 137). On our own junction it beats COCO (261 vs 172), and at the Shibuya crossing too (294 vs 72). A brightness threshold could not separate lit night streets from day (both had a mean HSV value of about 90), so we dropped it.

   With the COCO model there is no traffic-light state, so red-light rules need our model or a drawn light plus our light classifier.
2. **Scene:** there are three sources, in this order.
   * **Drawn zones:** the user outlines the road, crossings, stop line and traffic light on the first frame in the web app. This takes about 2 minutes.
   * **Known camera:** the video background is matched to our reference intersection (ORB + RANSAC). Its calibrated zones are then re-aligned to this video.
   * **Learned (zero-config):** a 32-column grid records where moving vehicles pass (the drivable area) and their dominant direction per cell, with a consistency score.
3. **Events:**
   * Zone rules (when a scene is known): red light, stop line, pedestrians on the roadway, failure to yield, stopped vehicle, congestion.
   * Zero-config rules (always): **wrong-way**, **near miss**, and stopped vehicle and congestion when there are no zones.
   * Wrong-way is judged leave-one-out: a car's own samples are removed from the flow field before it is checked against it.
4. **Risk:** pairwise time to closest approach between road users, calibrated so that normal traffic stays below 0.5.
5. **Conflicts, post-encroachment time (final, `conflicts.py`):** the surrogate safety measure that city video-safety studies use (e.g. Bellevue WA with Brisk Synergies / AMAG). PET is the time between one road user leaving a spot and another arriving there. Bins: < 1.5 s serious (driver reaction time), 1.5–3 s moderate, 3–5 s interaction (FHWA SSAM upper limit 5 s).
   * Image-plane version: a pedestrian occupies its foot cell, a vehicle the cells under the lower 15 % of its box.
   * Only learned-carriageway cells count. Both users must be moving.
   * Motorcycle/bicycle riders are not pedestrians, and vehicle–vehicle pairs need headings more than 30° apart, so car-following is excluded.
   * Exposure is the number of pedestrians and vehicles on the carriageway. Rates are given per 1,000 pedestrians.
6. **Privacy:** our detector finds vehicles, and an open plate detector runs only inside each vehicle crop. The top 22 % of every person box is blurred. Only the blurred video and event metadata leave the server.
7. **Report:** per-class counts and hourly rates (only for clips of 5 min or more), PET conflicts, a severity-weighted safety index, a hotspot map, recommendations (each names the number that triggered it), and a printable PDF.
8. **City dashboard (final):** every analysed camera, ranked by one of:
   * our risk index;
   * serious conflicts per 1,000 pedestrians;
   * the Highway Safety Manual **Empirical Bayes** "excess expected" conflicts: predicted = city rate × pedestrians, w = 1/(1 + k·predicted), expected = w·predicted + (1−w)·observed, with k = 0.5 as an **assumption** until a pilot gives enough cameras to estimate it. Short or quiet clips are then not ranked first by chance.

   The dashboard also has a before/after comparison.

## Quality, measured on test sets we built

| What | Test set | Result |
|---|---|---|
| Detector | 22 held-out frames, 1,386 boxes, our labels | mAP@50 **0.978**, mAP@50-95 **0.885** |
| Zone event rules | our labels of 4 sample videos (18 min) | Score A (macro F1 over tIoU 0.3/0.5/0.7) **0.83**. Optimistic: tuned on the same videos. |
| Wrong-way, zero-config | 18 min of real traffic (no wrong-way driving in it) | **0 false alarms / hour** |
| Wrong-way, zero-config | 60 real cars whose trajectories were played backwards (synthetic) | **93 %** caught (56/60) |
| Stopped vehicle / congestion, zero-config | our labels, 4 videos | F1 0.0–0.67: weak without zones, so drawing zones is recommended |
| Detector at night / rain / blur | the 22 frames with synthetic corruptions | see table below |
| Low-light model on daylight video | same 4 videos, same rules, fresh perception for both models | Score A **0.771** vs **0.828** for the daylight model (`eval/eval_events.py`, `eval/results/events_*.json`), hence day/night routing |
| PET conflicts | all 9 labeled failure-to-yield events in 4 videos | 7/9 have a pedestrian conflict with PET < 3 s within ±1 s. No PET ground truth exists. We reviewed the 12 first serious pedestrian conflicts of C3905 by eye: 11 real interactions (motorcycle through a crowded crossing, pedestrians stepping out right after a car), 1 artefact (pedestrian behind a car). |

Robustness (`eval/robustness.py`; synthetic corruptions, because all our footage is daytime), mAP@50:

| model | clean day | fog | 540p low bit-rate | rain | motion blur | night |
|---|---|---|---|---|---|---|
| daylight `detector.pt` | **0.975** | **0.971** | **0.881** | **0.793** | **0.712** | 0.390 |
| low-light `detector_lowlight.pt` (final) | 0.978 | 0.976 | 0.857 | 0.967 | 0.959 | **0.916** |

Bold = the better model in that condition. The app picks per camera from sample frames (see How it works), not from a condition label.

* **Tried and rejected:** brightening dark frames (gamma + CLAHE) made night detection worse, 0.390 → 0.266, because it amplifies noise (`eval/lowlight_enhance.py`).
* **Done in the final:** fine-tuning with synthetic night, rain and blur copies of the training frames (`eval/train_robust.py`, 12 epochs, RTX 3060). Night 0.39 → 0.92.
* **Caveat:** the low-light model is tested on the same kind of synthetic night it was trained on, so real night footage may score lower. Real night footage is the first thing a pilot collects.

### Seven cameras we had never seen (final)

These are open-licence clips from other cities (`eval/new_videos_sources.json`). Each was uploaded through the live API without drawing zones, exactly as a new user would (`eval/results/new_cameras.json`). There are no labels, so this table shows what the system did, not its accuracy.

| clip | condition | length | detector chosen | events (zero-config) | PET conflicts serious / moderate | pedestrians / vehicles on carriageway |
|---|---|---|---|---|---|---|
| day_intersection_trafficlight_nyc | day | 27 s | general_coco.pt | congestion | 0 / 0 | 0 / 15 |
| day_crossing_tokyo_shibuya | day | 20 s | detector.pt | none | 9 / 10 | 44 / 16 |
| day_intersection_topdown_drone | day | 36 s | detector.pt | none | 0 / 0 | 0 / 38 |
| night_intersection_topdown_drone | night | 82 s | general_coco.pt | congestion | 1 / 5 | 0 / 226 |
| night_crosswalk_trafficlight_street | night | 17 s | detector.pt | none | 0 / 0 | 2 / 2 |
| rain_night_crossing_nyc_timessquare | rain | 20 s | general_coco.pt | none | 19 / 15 | 43 / 35 |
| snow_intersection_ottawa | snow | 17 s | general_coco.pt | none | 0 / 0 | 0 / 3 |

What this shows:
* **Detector choice matters.** The general COCO model was picked for the night drone view, Times Square in rain, Ottawa in snow and New York. Our own model was kept for Shibuya and the day drone view.
* **Short zero-config clips find few events.** Lane directions need traffic over time; drawing zones (about 2 minutes) or a longer clip is the fix.
* **PET finds conflicts where crowds meet cars** (Shibuya, Times Square) even without zones.
* **Weak spots:**
  * In the day drone view (straight down), both detectors are weak, which rules out top-down drone footage today.
  * In the night street-level clip, few road users were detected.

### Known failure cases

* Real night and rain footage is untested by labels (see above); rain is routed to the daylight model because brightness does not reveal it.
* PET is computed in the image plane: a pedestrian partly hidden behind a vehicle can create a false conflict. A 4-point ground homography is the next step.
* At a signalised junction, zero-config congestion also fires on the normal queue at red. Drawing a stop line fixes this.
* Light-state classes were trained on one intersection's lights. On a new camera the light box must be drawn, and the colour reading is unverified there.
* Plates far away or at a steep angle can be missed by the plate detector. Heads are always blurred by the tracker, not by a face detector.
* Tracker ID switches in dense crowds split a person into several tracks, so "pedestrian tracks" over-count people.

## Speed and cost

Measured on our server (RTX 3060 12 GB, i9-12900F):

| Stage | Time |
|---|---|
| Detection + tracking at 10 fps, 1080p | **~2× faster than real time** (15 s clip: 7.6 s) |
| Privacy render (plate detector + blur + H.264) | ~1× real time. Only needed for the clips a user views. |
| Photo | 0.5–0.7 s |

Our ablation shows 5 fps loses no event accuracy (Score A 0.828 → 0.827), so one RTX 3060
serves about 4 cameras continuously. Cost per camera and payback, with every assumption
editable, are on the website's **Business** section.

## Data and licences

| Data / model | Use | Licence |
|---|---|---|
| Our own annotations: 214 frames, 12,990 boxes, and event labels of 4 videos (made in our labeling tool) | detector training, rule tuning, evaluation | ours |
| Organizer sample videos of one Tashkent intersection (elimination round) | source of the frames above | provided for the hackathon |
| YOLO26m COCO-pretrained (Ultralytics) | detector initialisation | AGPL-3.0 |
| `morsetechlab/yolov11-license-plate-detection` (v1s) | plate detector for blurring | AGPL-3.0; trained on Roboflow "License Plate Recognition" (CC BY 4.0) |
| Synthetic night, rain, blur and fog copies | robustness test and fine-tune | generated by `eval/robustness.py` |
| YOLO26m COCO-pretrained, unchanged (`weights/general_coco.pt`) | detector for unfamiliar viewpoints | AGPL-3.0 (Ultralytics) |
| 7 test clips from other cities: New York, Tokyo, Ottawa, two drone views, night and rain (`eval/new_videos_sources.json` lists page, author and licence; videos not stored in the repo) | unseen-camera test, city dashboard | Pexels licence / Mixkit Free licence (commercial use allowed, no attribution required; credited anyway) |

No personal data is stored or published. Faces and plates are blurred before any frame
leaves the server, and uploaded videos are deleted after 6 hours.

## Determinism

`SEED = 42` everywhere. Inference uses no randomness. Training uses `seed=42, deterministic=True`.

## Repository layout

```
core/doppix/      perception, autoscene, generic + zone rules, risk, privacy, analyze, report
core/configs/     tracker config, reference-intersection scene
backend/app.py    FastAPI: jobs, zones, images
frontend/         React + Vite web app
deploy/           serve.py (GPU service: backend + tunnel), restart.ps1, push_site.py
eval/             eval_generic.py, robustness.py, train_robust.py, results/
weights/          detector.pt (ours), plate.pt
```

## Team Do'ppiX

| Member | Role |
|---|---|
| Eldor Musayev | Team captain · ML Engineer |
| Shohruh Gulmirodov | Web Developer |
| Ibodulla Obidjonov | Cybersecurity Engineer · Cyber University |

Built with help from an AI coding assistant (Claude). Open-source libraries: Ultralytics, PyTorch, OpenCV, FastAPI, React, Vite, Tailwind.

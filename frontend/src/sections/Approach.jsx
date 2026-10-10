import { ArrowDown, ArrowRight, Check, X } from "lucide-react";
import Section from "./Section.jsx";
import { eventColor } from "../lib/data.js";
import Ablation from "../components/Ablation.jsx";

const PIPE = [
  { t: "Any camera", d: "Video or photo from existing CCTV. Uploaded over HTTPS to our GPU server; deleted after 6 h." },
  { t: "YOLO26m + ByteTrack", d: "Our fine-tune on 12,990 Tashkent boxes: 6 road-user classes + traffic-light state. ~10 fps, 2× real time on an RTX 3060." },
  { t: "Scene", d: "Zones drawn in the browser, or our known camera re-aligned (ORB+RANSAC), or learned from traffic: drivable area + lane directions." },
  { t: "Events", d: "Zone rules (red light, stop line, pedestrians, yielding) + zero-config rules (wrong-way, stopped, congestion, near miss)." },
  { t: "Privacy", d: "Plate detector inside each vehicle box + head blur, before any frame leaves the server." },
  { t: "Report", d: "Rates per hour, safety index and recommendations that name the number behind them." },
];

const RULES = [
  ["red_light", "A vehicle's foot point crosses the stop line while the governing light is red (the first 1 s after a phase change is ignored)."],
  ["stop_line", "A vehicle stands on or over the stop line for ≥ 3 s."],
  ["jaywalking", "A moving pedestrian on the carriageway for ≥ 1 s, more than 60 px from a crosswalk and not on an island. Riders and tiny far-away people are excluded."],
  ["failure_to_yield", "A moving vehicle inside a crosswalk while a pedestrian on it is in the vehicle's path (ahead, within its width)."],
  ["stopped_vehicle", "A single vehicle stationary ≥ 10 s inside the intersection, outside a queue."],
  ["congestion", "≥ 3 stationary vehicles in the intersection approach at once for ≥ 8 s."],
];

const DEV = [["red_light", 1.0], ["stop_line", 0.92], ["congestion", 0.9], ["stopped_vehicle", 0.81], ["jaywalking", 0.7], ["failure_to_yield", 0.64]];

const FAILURES = [
  ["failure_to_yield vs. giving way", "On the lower crosswalk, turning cars and pedestrians get green together. A car creeping between pedestrians looks almost the same as one that forces them to stop. We now require the car to move at ≥ 0.3 car lengths/s and the pedestrian to be walking, but this is still our weakest class (F1 0.64)."],
  ["Walking alongside the zebra", "People often walk on the asphalt just off the painted edge. A fixed margin could not separate them from real diagonal jaywalkers, so we measure how much of the walk runs parallel to the crosswalk axis (> 70 % means they are using the crossing)."],
  ["Scooter riders", "E-scooters are not a detector class, so a rider looks like a fast pedestrian. Speed normalised by body height separates them: pedestrians move 0.3–1 heights/s, riders 2.5+."],
  ["Cut-off people", "At the bottom frame edge the box bottom is the frame edge, not the feet. We ignore these people for jaywalking."],
  ["A missed stopped vehicle", "C3905 81–108 s: a car stopped partly inside the queue area is not reported. Stops mixed with congestion are hard to tell apart with our rules."],
  ["Crash-risk score is unvalidated on real crashes", "The samples contain no accidents. The risk model gives 0 false alarms on 18 min of normal traffic, but its recall on real collisions is unknown."],
];

const NEXT = [
  "Label public accident data (DoTA, CCD) in this camera's geometry and train a small classifier on track features for accident and near_miss.",
  "Add wrong_way and illegal_u_turn: lane directions are already visible in our trajectory maps (EDA), so they need lane polygons and a heading rule.",
  "Read the pedestrian signal (light B) as well, instead of inferring it from the vehicle light with a 2 s offset.",
  "Replace pixel thresholds with a ground-plane homography, so speeds and distances are in metres.",
  "Run on NVDEC or a lower-resolution stream in production: CPU decoding of the 4K footage is most of our runtime.",
];

const WORKED = [
  "Training the traffic-light state as two detector classes. Colour thresholds failed in daylight glare.",
  "Checking which light governs which approach from the data: 97–98 % of stop-line crossings happen on not-red.",
  "Automatic camera-shift correction. Without it, one video had 0 % light readings because the camera had moved ~70 px.",
  "Building our own labeling tool with pipeline suggestions. We reviewed events in minutes instead of hours.",
  "Calibrating the risk score on normal traffic: 0 false alarms, and the score stays continuous for AP.",
];
const FAILED = [
  "Sweeping full boxes for collision risk flagged every tight queue (75 % of frames non-zero). We went back to centre-based TTC.",
  "A plain \"vehicle in crosswalk while a pedestrian is on it\" rule gave many false failure_to_yield events. The pedestrian must be in the vehicle's path.",
  "\"Pedestrian slightly off the zebra\" is not jaywalking. We needed a 60 px grace band and an island mask.",
];

export default function Approach() {
  return (
    <Section id="approach" kicker="Approach & technical report" title="How it works"
      intro="Learned where there is data (our 12,990 labeled boxes), rules where there is not: every event can be checked against the video, and every number on this site is measured on data we labeled.">
      {/* pipeline */}
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
        {PIPE.map((s, i) => (
          <div key={s.t} className="contents">
            <div className="card flex-1 p-3">
              <div className="text-xs font-semibold text-amber-400">{i + 1}</div>
              <div className="font-semibold text-white">{s.t}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.d}</p>
            </div>
            {i < PIPE.length - 1 && (
              <div className="flex justify-center text-slate-600">
                <ArrowDown className="lg:hidden" size={18} /><ArrowRight className="hidden lg:block" size={18} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-semibold text-white">Learned vs. rule-based</h3>
          <table className="mt-3 w-full text-sm">
            <tbody className="[&_td]:py-1.5 [&_tr]:border-b [&_tr]:border-slate-800">
              <tr><td className="pr-3 text-slate-300">Road-user detector</td><td><span className="chip border-sky-600 text-sky-300">learned</span></td></tr>
              <tr><td className="pr-3 text-slate-300">Traffic-light state</td><td><span className="chip border-sky-600 text-sky-300">learned</span></td></tr>
              <tr><td className="pr-3 text-slate-300">Tracking</td><td><span className="chip">algorithmic (ByteTrack)</span></td></tr>
              <tr><td className="pr-3 text-slate-300">Scene layout</td><td><span className="chip">drawn once + auto-aligned</span></td></tr>
              <tr><td className="pr-3 text-slate-300">Event segments</td><td><span className="chip border-amber-600 text-amber-300">rules</span></td></tr>
              <tr><td className="pr-3 text-slate-300">Accident risk</td><td><span className="chip border-amber-600 text-amber-300">rules + calibration</span></td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            Detector: YOLO26m (COCO-pretrained), fine-tuned at imgsz 1280 on frames from the sample videos that we labeled in our own tool, with model pre-labels and human review.
          </p>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-white">Accident anticipation (time-to-collision)</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            <li>The detector and tracker run causally on every 6th frame. Only past frames are ever used.</li>
            <li>For each pair of road users, a linear extrapolation of the last 1 s gives the time to closest approach <i>t*</i> and the miss distance <i>d*</i>.</li>
            <li>The pair is risky if they close at ≥ 150 px/s, <i>t*</i> ≤ 3 s and <i>d*</i> &lt; 60 % of their combined size. The score is (1 − t*/3)(1 − d*/reach).</li>
            <li><b>Calibration:</b> the 99.9th percentile on normal traffic maps to 0.45, so ordinary near-passes stay under θ = 0.5 and only unusual approaches exceed it.</li>
            <li>The pair must stay risky for 3 consecutive steps, and the output is EMA-smoothed.</li>
          </ol>
        </div>
      </div>

      <h3 className="mt-10 text-lg font-semibold text-white">Event rules</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RULES.map(([c, d]) => (
          <div key={c} className="card p-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: eventColor(c) }} />
              <code className="text-sm text-white">{c}</code>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Classes that never occur in the samples (accident, near_miss, wrong_way, U-turns, obstacles, fire…) are not emitted as segments. Under macro-F1, a false positive on an absent class costs a whole class. Accidents are handled by the crash-risk score.
      </p>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-semibold text-white">What worked</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {WORKED.map((w) => <li key={w} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />{w}</li>)}
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-white">What did not</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {FAILED.map((w) => <li key={w} className="flex gap-2"><X size={16} className="mt-0.5 shrink-0 text-red-400" />{w}</li>)}
          </ul>
        </div>
      </div>

      <Ablation />

      <h3 className="mt-10 text-lg font-semibold text-white">Honest failure cases</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FAILURES.map(([t, d]) => (
          <div key={t} className="card border-red-900/60 p-3">
            <div className="text-sm font-semibold text-red-300">{t}</div>
            <p className="mt-1 text-sm text-slate-400">{d}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-4">
        <h3 className="font-semibold text-white">What we would do next</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          {NEXT.map((n) => <li key={n}>{n}</li>)}
        </ol>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h3 className="font-semibold text-white">Detector (validation)</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-slate-800/60 p-3"><div className="text-2xl font-bold text-white">0.978</div><div className="text-xs text-slate-400">mAP@50</div></div>
            <div className="rounded-lg bg-slate-800/60 p-3"><div className="text-2xl font-bold text-white">0.885</div><div className="text-xs text-slate-400">mAP@50-95</div></div>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-white">Events on our labels</h3>
          <table className="mt-2 w-full text-sm">
            <tbody className="[&_td]:py-0.5">
              {DEV.map(([c, f1]) => (
                <tr key={c}><td className="pr-2"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: eventColor(c) }} />{c}</td>
                  <td className="w-24"><div className="h-1.5 rounded bg-slate-800"><div className="h-1.5 rounded bg-amber-400" style={{ width: `${f1 * 100}%` }} /></div></td>
                  <td className="pl-2 text-right font-mono text-slate-300">{f1.toFixed(2)}</td></tr>
              ))}
              <tr className="border-t border-slate-700"><td className="pt-1 font-semibold text-white">Score A</td><td /><td className="pt-1 text-right font-mono font-semibold text-white">0.83</td></tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            Official metric (mean F1 over tIoU 0.3/0.5/0.7) on our own labels of all four sample videos. This is optimistic: the labels started from the pipeline's suggestions and the thresholds were tuned on the same videos.
          </p>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-white">Engineering</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            <li>• Sequential decode, grab() for skipped frames</li>
            <li>• fp16 on GPU; weights loaded once for all videos</li>
            <li>• Fixed seed (42), no test-time randomness</li>
            <li>• Self-timing guard: sparser sampling if the 3× budget is at risk</li>
            <li>• RTX 3060: 1.81–1.92× video duration for events + crash risk (full 4K clips)</li>
            <li>• Every threshold in one place (<code>config.py</code>, <code>rules.P</code>)</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}

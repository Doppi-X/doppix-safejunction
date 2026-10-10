import { useState } from "react";
import { Cpu } from "lucide-react";
import Section from "./Section.jsx";
import { fetchJSON } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";

const KIND = {
  measured: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  synthetic: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  assumption: "bg-white/5 text-slate-300 border-white/10",
  weak: "bg-red-500/15 text-red-300 border-red-500/30",
};

// The task's engineering constraint, answered row by row. Every value says how we know it.
const ROWS = [
  ["Where inference runs", "On a GPU server next to the city's video archive (on-premise). Ours is one RTX 3060 12 GB. The browser only uploads and views; no cloud AI API is called.", "measured"],
  ["Speed", "Detection + tracking at 10 fps runs 2× faster than real time. A photo takes 0.5–0.7 s. Privacy render of a viewed clip is about 1× real time. A 40 s clip goes from upload to report in about 50–60 s.", "measured"],
  ["Capacity", "5 fps loses no accuracy (score 0.828 → 0.827), so one GPU serves about 4 live cameras.", "measured"],
  ["Cost per camera", "About $13 a month for infrastructure: a $1,200 server over 36 months plus 0.3 kW at $0.08/kWh, shared by 4 cameras. The price to the city is $40 a month. Change any of these in the calculator under Business.", "assumption"],
  ["Night", "Detector mAP50 on our held-out frames darkened synthetically: 0.39 with the daylight model, 0.92 with our low-light fine-tune. On a real night drone clip our model found 7 confident road users in 6 sample frames and the general COCO model 211, so each camera now picks its detector.", "synthetic"],
  ["Rain, fog, blur, low bit-rate", "mAP50: rain 0.79 → 0.97 and motion blur 0.71 → 0.96 with the low-light fine-tune; fog 0.97; 540p low bit-rate 0.88. Tested on real rain (Times Square) and snow (Ottawa) clips without labels.", "synthetic"],
  ["Local vehicles", "Trained on 12,990 boxes we labeled at a Tashkent junction: Cobalts, Damas, articulated buses, local traffic lights. On our own junction our model beats the general one (261 vs 172 confident detections in 4 sample frames).", "measured"],
  ["Number plates", "We never read plates. We blur them: an open plate detector runs inside every vehicle box, from both our detector and the general one. Close-up street views are covered by the second detector.", "measured"],
  ["Known weak spots", "Top-down drone views by day (both detectors weak). Short zero-config clips find few events: draw zones or use longer video. PET works in the image plane, so a pedestrian hidden behind a car can create a false conflict.", "weak"],
];

const NAMES = {
  day_intersection_trafficlight_nyc: "New York · day",
  day_crossing_tokyo_shibuya: "Shibuya, Tokyo · day",
  day_intersection_topdown_drone: "Drone view · day",
  night_intersection_topdown_drone: "Drone view · night",
  night_crosswalk_trafficlight_street: "Street crossing · night",
  rain_night_crossing_nyc_timessquare: "Times Square · rain, night",
  snow_intersection_ottawa: "Ottawa · snow",
};
const DET = { "detector.pt": "our model", "detector_lowlight.pt": "our low-light", "general_coco.pt": "general COCO" };

function Unseen() {
  const { data } = useJSON("./data/unseen.json", fetchJSON);
  const [open, setOpen] = useState(null);
  if (!data) return null;
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white">Seven cameras we had never seen</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        Open-licence clips from other cities (Pexels and Mixkit free licences), uploaded through the live API with no zones drawn, exactly as a new user would.
        There are no labels for them, so this shows what the system did, not its accuracy. Faces and plates are blurred.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.map((r) => {
          const c = r.conflicts?.counts || {};
          return (
            <button key={r.file} onClick={() => setOpen(open === r.file ? null : r.file)} className="card overflow-hidden text-left">
              <img src={`./data/unseen/${r.file}.jpg`} alt={NAMES[r.file]} className="aspect-video w-full object-cover" loading="lazy" />
              <div className="p-2.5">
                <div className="text-sm font-medium text-white">{NAMES[r.file] || r.file}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{Math.round(r.duration_s)} s · detector: {DET[r.detector] || r.detector}</div>
                <div className="mt-1 text-[11px] text-slate-300">
                  {c.serious ?? 0} serious / {c.moderate ?? 0} moderate conflicts · {r.events.length} events
                </div>
                {open === r.file && (
                  <div className="mt-1.5 text-[11px] text-slate-500">
                    Exposure: {r.conflicts?.exposure_pedestrians ?? 0} pedestrians, {r.conflicts?.exposure_vehicles ?? 0} vehicles on the carriageway.
                    Detector scores (confident road users in 6 frames): {Object.entries(r.detector_scores || {}).map(([k, v]) => `${DET[k] || k} ${v}`).join(", ")}.
                    Source: {r.licence}, {r.author}.
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Engineering() {
  return (
    <Section id="engineering" kicker="Engineering constraint" title="Where it runs, how fast, what it costs, and how it copes"
      intro="The task asks where inference runs, the speed on our own hardware, the cost per camera, and quality at night, in rain and on local vehicles and plates. Here is each answer, with how we know it.">
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {ROWS.map(([k, v, kind]) => (
              <tr key={k} className="border-t border-white/5 first:border-0 align-top">
                <td className="w-40 px-4 py-3 font-semibold text-white sm:w-56"><span className="flex items-center gap-1.5">{k === "Where inference runs" && <Cpu size={15} className="text-amber-300" />}{k}</span></td>
                <td className="py-3 pr-4 text-slate-300">
                  {v}
                  <span className={`ml-2 inline-block rounded border px-1.5 text-[10px] ${KIND[kind]}`}>{kind === "weak" ? "known failure" : kind}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Unseen />
    </Section>
  );
}

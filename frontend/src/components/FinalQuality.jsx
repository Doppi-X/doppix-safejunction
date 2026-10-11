import { useState } from "react";
import { fetchJSON } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";

const COND_IMG = {
  "clean (day)": "clean_day", night: "night", rain: "rain", fog: "fog",
  "motion blur": "motion_blur", "low bit-rate 540p": "low_bit-rate_540p",
};

/** Quality numbers added in the final: zero-config wrong-way test and robustness to weather/light. */
export default function FinalQuality() {
  const { data: gen } = useJSON("./data/generic.json", fetchJSON);
  const { data: rob } = useJSON("./data/robustness.json", fetchJSON);
  const { data: rn } = useJSON("./data/real_night.json", fetchJSON);
  const [cond, setCond] = useState("night");
  if (!gen || !rob) return null;
  const rows = Object.entries(rob.results);
  const inj = Object.values(gen.injection).reduce((a, v) => [a[0] + v.caught, a[1] + v.injected], [0, 0]);
  const hours = Object.values(gen.videos).reduce((s, v) => s + v.duration, 0) / 60;
  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="card p-4">
        <h3 className="font-semibold text-white">Zero-config wrong-way detection</h3>
        <p className="mt-1 text-xs text-slate-400">No zones: lane directions are learned from the traffic, and each car is judged against the field without its own samples.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 p-3"><div className="font-display text-2xl font-bold text-white">{gen.wrong_way_false_alarms_per_hour}/h</div>
            <div className="text-[11px] text-slate-400">false alarms on {hours.toFixed(0)} min of real traffic</div></div>
          <div className="rounded-lg bg-white/5 p-3"><div className="font-display text-2xl font-bold text-white">{Math.round(100 * gen.injection_recall)}%</div>
            <div className="text-[11px] text-slate-400">caught: {inj[0]}/{inj[1]} real cars played backwards (synthetic)</div></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Zero-config stopped-vehicle and congestion are weak (F1 0.0–0.67 on our labels): a red-light queue looks like congestion. Drawing a stop line switches to the zone rules (F1 0.81–0.90).
        </p>
      </div>
      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-white">Night, rain, fog, blur</h3>
          <span className="text-[11px] text-slate-500">1,386 boxes, synthetic corruptions, mAP50</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Condition</th><th>Daylight model</th><th>Low-light model</th></tr></thead>
            <tbody>
              {rows.map(([k, v]) => {
                const l = rob.lowlight?.[k];
                const routed = k === "night" ? "low" : "day";
                const cell = (m, on) => m == null ? <td className="font-mono text-slate-600">–</td> : (
                  <td className={`font-mono ${m < 0.6 ? "text-red-300" : m < 0.85 ? "text-amber-300" : "text-emerald-300"} ${on ? "font-bold underline decoration-dotted" : "opacity-70"}`}>{m.toFixed(2)}</td>);
                return (
                  <tr key={k} onClick={() => COND_IMG[k] && setCond(k)}
                    className={`border-t border-white/5 ${COND_IMG[k] ? "cursor-pointer hover:bg-white/5" : "text-slate-500"} ${cond === k ? "bg-white/10" : ""}`}>
                    <td className="py-1.5 pr-2">{k}</td>
                    {cell(v.mAP50, COND_IMG[k] && routed === "day")}
                    {cell(l?.mAP50, COND_IMG[k] && routed === "low")}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <figure>
            <img src={`./data/robustness/${COND_IMG[cond] || "night"}.jpg`} alt={cond} className="w-full rounded-lg" />
            <figcaption className="mt-1 text-[11px] text-slate-500">{cond}: what the detector sees (click a row)</figcaption>
          </figure>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Synthetic corruptions of our 22 held-out frames. Our low-light fine-tune looked great here (night 0.39 → 0.92),
          but on REAL night it collapsed (0.06, table below): synthetic darkening does not teach real night. Brightening frames was also rejected.
        </p>
      </div>
      {rn && (
        <div className="card p-4 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-white">Real night, labeled: 3 cameras never trained on</h3>
            <span className="text-[11px] text-slate-500">{rn.results["general COCO"].real_night_unseen.frames} frames · {Object.values(rn.results["general COCO"].real_night_unseen.gt_boxes).reduce((a, b) => a + b, 0)} boxes · AP50, one evaluator for all models</span>
          </div>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Detector</th><th>Real night: road users</th><th>person</th><th>car</th><th>Day (our junction): road users</th></tr></thead>
            <tbody>
              {Object.entries(rn.results).map(([k, v]) => (
                <tr key={k} className="border-t border-white/5">
                  <td className="py-1.5 pr-2 text-slate-200">{k}</td>
                  <td className={`font-mono ${v.real_night_unseen.road_users_mAP50 >= 0.5 ? "text-emerald-300" : v.real_night_unseen.road_users_mAP50 >= 0.3 ? "text-amber-300" : "text-red-300"}`}>{v.real_night_unseen.road_users_mAP50}</td>
                  <td className="font-mono text-slate-400">{v.real_night_unseen.per_class_AP50.person}</td>
                  <td className="font-mono text-slate-400">{v.real_night_unseen.per_class_AP50.car}</td>
                  <td className="font-mono text-slate-300">{v.day_old_junction.road_users_mAP50}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            Test cameras: a night street crossing, a raised Philadelphia junction at night and foggy night Moscow (open-licence clips), labeled by our team and an AI annotator correcting YOLO drafts.
            None of these cameras was used to build or tune any detector.
            Decision: at night the app picks the general model by its own per-camera check.
          </p>
        </div>
      )}
    </div>
  );
}

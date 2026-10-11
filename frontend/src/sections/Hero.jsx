import { useEffect, useState } from "react";
import { ArrowRight, Github, MapPin, PlayCircle, ShieldCheck, TrafficCone, Upload } from "lucide-react";
import { eventColor, fetchJSON, getApiBase } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";
import { REPO_URL } from "../team.js";

const STATS = [
  ["2× real time", "on one RTX 3060 next to the video archive; about $13 per camera per month for infrastructure"],
  ["0.83", "event score (macro F1, 6 classes) on our own labels of a Tashkent junction"],
  ["9", "cameras it had never seen, run live: New York, Tokyo, Tehran, Korea, Ottawa; night, rain, snow, dusk, drone views"],
  ["0.19 → 0.58", "detector mAP50 on 35 REAL night frames from 3 cameras never trained on (our labels): each camera auto-picks the detector that sees it"],
];

const FEATURES = [
  [TrafficCone, "Violations + PET conflicts"],
  [MapPin, "Hotspot map + PDF report"],
  [ArrowRight, "City-wide risk ranking"],
  [ShieldCheck, "Faces and plates blurred"],
];

function useLive() {
  const [h, setH] = useState(null);
  useEffect(() => {
    let alive = true;
    getApiBase().then((api) => fetch(`${api}/api/health`).then((r) => r.json()).then((d) => alive && setH(d)).catch(() => alive && setH(false)));
    return () => { alive = false; };
  }, []);
  return h;
}

/** Four very different cameras, each with the system's own output: hotspots of events and serious conflicts. */
function HeroCameras() {
  const { data: cams } = useJSON("./data/hero/cameras.json", fetchJSON);
  if (!cams) return <div className="aspect-video animate-pulse rounded-2xl bg-slate-800/60" />;
  return (
    <div className="relative">
      <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-transparent to-red-500/20 blur-2xl" />
      <div className="relative grid grid-cols-2 gap-2">
        {cams.map((c) => (
          <div key={c.label} className="relative overflow-hidden rounded-xl border border-slate-700 shadow-xl shadow-black/50" style={{ aspectRatio: c.aspect }}>
            <img src={c.frame} alt={c.label} className="absolute inset-0 h-full w-full object-cover" />
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              {c.hotspots.map(([x, y, l], i) => (
                <ellipse key={i} cx={x * 1000} cy={y * 1000} rx="9" ry={9 * c.aspect} fill={eventColor(l)} stroke="#0f172a" strokeWidth="2" />
              ))}
            </svg>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 to-transparent p-2 pt-6">
              <div className="text-xs font-semibold text-white">{c.label}</div>
              <div className="text-[10px] text-slate-300">{c.serious} serious conflicts · {c.events} events · {c.minutes} min</div>
            </div>
          </div>
        ))}
      </div>
      <p className="relative mt-2 text-center text-[11px] text-slate-400">Real output on four cameras: dots = where events and serious conflicts happened. Faces and plates blurred.</p>
    </div>
  );
}

export default function Hero() {
  const live = useLive();
  const runSample = () => {
    document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("sj:sample", { detail: "korea" }));
  };
  return (
    <section className="relative overflow-hidden border-b border-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(239,68,68,0.08),transparent_50%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-10 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <p className="chip border-amber-500/40 text-amber-300">Startup · WIUT Hackathon 2026 Final · Computer Vision</p>
            <span className={`chip ${live ? "border-emerald-500/40 text-emerald-300" : "border-white/10 text-slate-400"}`}>
              <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-400" : live === false ? "bg-slate-500" : "animate-pulse bg-amber-400"}`} />
              {live ? `Live · ${live.device} online` : live === false ? "GPU server offline · recorded results below" : "Connecting to the GPU server…"}
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Turn any traffic camera into a{" "}
            <span className="bg-gradient-to-r from-amber-300 to-red-400 bg-clip-text text-transparent">road-safety auditor</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
            SafeJunction watches the CCTV a city already has, finds red-light running, drivers not yielding to
            pedestrians, wrong-way driving and near misses, and tells the traffic engineer what to change, before
            the crash, with faces and plates blurred.
          </p>
          <ul className="mt-5 grid max-w-xl grid-cols-2 gap-2 text-sm text-slate-200">
            {FEATURES.map(([I, t]) => <li key={t} className="flex items-center gap-2"><I size={16} className="shrink-0 text-amber-300" />{t}</li>)}
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={runSample} disabled={!live} className="btn bg-amber-500 px-4 py-2.5 text-slate-950 hover:bg-amber-400 disabled:opacity-50">
              <PlayCircle size={18} /> Live demo: a camera in Korea
            </button>
            <a href="#analyze" className="btn border border-amber-500/50 px-4 py-2.5 text-amber-200 hover:bg-amber-500/10">
              <Upload size={16} /> Upload your video
            </a>
            <a href="#network" className="btn border border-slate-600 px-4 py-2.5 text-slate-200 hover:bg-slate-800">
              City dashboard <ArrowRight size={16} />
            </a>
            {REPO_URL && (
              <a href={REPO_URL} target="_blank" rel="noreferrer" title="Code on GitHub" className="btn border border-slate-600 px-3 py-2.5 text-slate-200 hover:bg-slate-800">
                <Github size={18} />
              </a>
            )}
          </div>
        </div>
        <HeroCameras />
      </div>
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 pb-14 sm:grid-cols-4">
        {STATS.map(([v, l]) => (
          <div key={l} className="card p-4">
            <div className="font-display text-2xl font-bold text-white sm:text-3xl">{v}</div>
            <div className="mt-1 text-sm text-slate-400">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

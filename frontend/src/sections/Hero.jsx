import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Github, MapPin, PlayCircle, ShieldCheck, TrafficCone, Upload } from "lucide-react";
import VideoOverlay, { parseTracks } from "../components/VideoOverlay.jsx";
import { fetchJSON, getApiBase } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";
import { REPO_URL } from "../team.js";

const STATS = [
  ["2× real time", "on one RTX 3060 next to the video archive; about $13 per camera per month for infrastructure"],
  ["0.83", "event score (macro F1, 6 classes) on our own labels of a Tashkent junction"],
  ["7", "cameras it had never seen, tested: New York, Tokyo, Ottawa, night, rain, snow, drone views"],
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

const CLIP_START = 74;   // hero.mp4 = C3896 dan 74–92 s kesma (~0.8 MB): qizilda o'tish, stop-chiziq, tirbandlik

function HeroPlayer() {
  const { data: doc } = useJSON("./data/C3896.json", fetchJSON);
  const frames = useMemo(() => (doc ? parseTracks(doc) : []), [doc]);
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current?.video;
    if (!v) return;
    const start = () => { v.currentTime = 0; v.play().catch(() => {}); };
    v.addEventListener("loadedmetadata", start, { once: true });
    v.addEventListener("ended", start);
    if (v.readyState >= 1) start();
    return () => v.removeEventListener("ended", start);
  }, [doc]);
  if (!doc) return <div className="aspect-video animate-pulse rounded-2xl bg-slate-800/60" />;
  return (
    <div className="relative">
      <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-transparent to-red-500/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-700 shadow-2xl shadow-black/60">
        <VideoOverlay ref={ref} src="./data/video/hero.mp4" offset={CLIP_START} doc={doc} frames={frames} controls={false}
          layers={{ highlight: true, boxes: true, ids: false, trails: true, zones: false }} />
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs text-slate-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Reference intersection · faces and plates blurred
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const live = useLive();
  const runSample = () => {
    document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("sj:sample"));
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
              <PlayCircle size={18} /> Live demo: 40 s sample
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
        <HeroPlayer />
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

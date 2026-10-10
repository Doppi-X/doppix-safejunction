import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, Github, PlayCircle } from "lucide-react";
import VideoOverlay, { parseTracks } from "../components/VideoOverlay.jsx";
import { fetchJSON } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";
import { REPO_URL } from "../team.js";

const STATS = [
  ["0 / h", "wrong-way false alarms on 18 min of real traffic; 93 % of injected wrong-way cars caught"],
  ["0.83", "Score A (macro F1 over 6 event classes) on our own labels of a Tashkent intersection"],
  ["0.39 → 0.92", "detector mAP50 at night after our low-light fine-tune (synthetic test); each camera auto-picks the detector that sees it best"],
  ["2×", "faster than real time on one RTX 3060 (detection + tracking at 10 fps)"],
];

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
  return (
    <section className="relative overflow-hidden border-b border-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(239,68,68,0.08),transparent_50%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-10 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="chip mb-5 border-amber-500/40 text-amber-300">Startup · WIUT Hackathon 2026 Final · Computer Vision</p>
          <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Turn any traffic camera into a{" "}
            <span className="bg-gradient-to-r from-amber-300 to-red-400 bg-clip-text text-transparent">road-safety auditor</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
            SafeJunction watches the CCTV a city already has, finds red-light running, drivers not yielding to
            pedestrians, wrong-way driving and near misses, and tells the traffic engineer what to change, before
            the crash, with faces and plates blurred.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#analyze" className="btn bg-amber-500 px-4 py-2.5 text-slate-950 hover:bg-amber-400">
              <PlayCircle size={18} /> Analyse your video
            </a>
            <a href="#network" className="btn border border-slate-600 px-4 py-2.5 text-slate-200 hover:bg-slate-800">
              City dashboard <ArrowRight size={16} />
            </a>
            {REPO_URL && (
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn border border-slate-600 px-4 py-2.5 text-slate-200 hover:bg-slate-800">
                <Github size={18} /> Code
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

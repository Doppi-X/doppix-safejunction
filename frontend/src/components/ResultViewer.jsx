import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownWideNarrow, Clock, Eye, EyeOff, Star } from "lucide-react";
import VideoOverlay, { parseTracks } from "./VideoOverlay.jsx";
import Timeline from "./Timeline.jsx";
import RiskChart from "./RiskChart.jsx";
import { eventColor, eventName, fmtTime } from "../lib/data.js";

const LAYERS = [
  ["highlight", "Highlight event objects"],
  ["boxes", "All boxes"],
  ["ids", "Track IDs"],
  ["trails", "Trails"],
  ["zones", "Scene zones"],
  ["flow", "Learned lane directions"],
];

/** Bitta video natijasi: annotatsiyali video + timeline + risk + hodisalar ro'yxati.
 *  Namuna videolar va jonli demo bir xil formatdagi `doc` bilan ishlaydi. */
export default function ResultViewer({ doc, videoUrl, jump }) {
  const player = useRef(null);
  const [time, setTime] = useState(0);
  const [layers, setLayers] = useState({ highlight: true, boxes: true, ids: false, trails: true, zones: false, flow: false });
  const frames = useMemo(() => parseTracks(doc), [doc]);
  const seek = (t) => { player.current?.seek(t); setTime(t); };
  const events = doc.events || [];
  const [order, setOrder] = useState("best");
  const q = doc.quality || [];
  // "best": ⭐ tanlanganlar, keyin labelimizga eng aniq mos kelganlar; "time": xronologik
  const listed = useMemo(() => {
    const idx = events.map((_, k) => k);
    return order === "best" ? idx.sort((a, b) => (q[b] ?? 0) - (q[a] ?? 0) || events[a][0] - events[b][0]) : idx;
  }, [doc, order]);
  useEffect(() => {                    // tashqi "misolga o'tish" (masalan klass tugmasidan)
    if (!jump) return;
    const v = player.current?.video;
    const go = () => { seek(Math.max(0, jump.t - 1)); player.current?.play(); };
    if (v && v.readyState >= 1) go(); else v?.addEventListener("loadedmetadata", go, { once: true });
  }, [jump]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <VideoOverlay ref={player} src={videoUrl} doc={doc} frames={frames} layers={layers} onTime={setTime} />
        </div>
        {/* ro'yxat balandligi = video balandligi (lg), sig'maganlari ichida scroll */}
        <aside className="card relative flex max-h-80 flex-col lg:max-h-none">
          <div className="flex min-h-0 flex-1 flex-col p-3 lg:absolute lg:inset-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-200">
                Events <span className="font-normal text-slate-500">{events.length}</span>
              </h4>
              {q.length > 0 && (
                <div className="flex rounded-lg bg-white/5 p-0.5 text-[11px]">
                  {[["best", ArrowDownWideNarrow, "Best"], ["time", Clock, "Time"]].map(([k, Icon, n]) => (
                    <button key={k} onClick={() => setOrder(k)} title={k === "best" ? "Best examples first" : "Chronological"}
                      className={`flex items-center gap-1 rounded-md px-2 py-0.5 ${order === k ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
                      <Icon size={11} />{n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ul className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1 [scrollbar-width:thin]">
              {listed.map((i) => {
                const e = events[i];
                const active = time >= e[0] && time <= e[1];
                return (
                  <li key={i}>
                    <button onClick={() => seek(Math.max(0, e[0] - 1))}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-white/5 ${active ? "bg-white/10 ring-1 ring-amber-400/50" : ""}`}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: eventColor(e[2]) }} />
                      <span className="flex-1 truncate">{eventName(e[2])}</span>
                      {q[i] >= 2 && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />}
                      {q[i] > 0 && q[i] < 2 && <span className="shrink-0 text-[10px] text-emerald-400">✓{Math.round(q[i] * 100)}%</span>}
                      <span className="font-mono text-[11px] text-slate-400">{fmtTime(e[0]).replace(/\.\d$/, "")}</span>
                    </button>
                  </li>
                );
              })}
              {!events.length && <li className="px-2 text-sm text-slate-500">No events.</li>}
            </ul>
            {q.length > 0 && (
              <p className="mt-2 border-t border-white/5 pt-2 text-[11px] text-slate-500">⭐ best example · ✓ overlap with our label</p>
            )}
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LAYERS.map(([k, name]) => (
          <button key={k} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
            className={`btn px-2.5 py-1 text-xs ${layers[k] ? "bg-white/10 text-white" : "border border-white/10 text-slate-400"}`}>
            {layers[k] ? <Eye size={13} /> : <EyeOff size={13} />} {name}
          </button>
        ))}
      </div>

      <div className="card p-3">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-200">Event timeline</h4>
          {doc.labels && <span className="text-[11px] text-slate-500">white line = our manual label</span>}
        </div>
        <Timeline doc={doc} time={time} onSeek={seek} />
      </div>
      <div className="card p-3">
        <h4 className="mb-1 text-sm font-semibold text-slate-200">Accident risk, next 5 s</h4>
        <RiskChart risk={doc.risk} duration={doc.duration} time={time} onSeek={seek} height={110} />
      </div>
    </div>
  );
}

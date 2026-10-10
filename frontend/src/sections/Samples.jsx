import { useEffect, useState } from "react";
import Section from "./Section.jsx";
import ResultViewer from "../components/ResultViewer.jsx";
import { eventColor, eventName, fetchJSON, fmtTime } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";

export default function Samples() {
  const { data: list } = useJSON("./data/samples.json", fetchJSON);
  const [sel, setSel] = useState(null);
  const [jump, setJump] = useState(null);
  useEffect(() => {                       // boshqa bo'limlardan (xatolar tahlili) "shu hodisani ko'rsat"
    const h = (e) => {
      setSel(e.detail.video); setJump({ t: e.detail.t, k: Date.now() });
      document.getElementById("samples")?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("doppix-jump", h);
    return () => window.removeEventListener("doppix-jump", h);
  }, []);
  const id = sel || list?.[0]?.id;
  const { data: doc, error } = useJSON(id ? `./data/${id}.json` : null, fetchJSON);
  const meta = list?.find((s) => s.id === id);

  const examples = list ? [...new Set(list.flatMap((x) => Object.keys(x.best_event || {})))].map((c) => {
    const v = list.filter((x) => x.best_event?.[c]).sort((a, b) => b.best_event[c][0] - a.best_event[c][0])[0];
    return { c, v: v.id, t: v.best_event[c][2] };
  }) : [];

  return (
    <Section id="samples" alt kicker="Validation · reference intersection" title="Where the rules were measured"
      intro="Four clips of one Tashkent junction from the elimination round (built before the final), labeled by us event by event. This is the test set behind our quality numbers; the clips are re-rendered with faces and plates blurred.">
      <div className="card mb-4 space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap rounded-xl bg-white/5 p-1">
            {(list || []).map((x) => (
              <button key={x.id} onClick={() => { setSel(x.id); setJump(null); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${x.id === id ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-white"}`}>
                {x.id} <span className="opacity-60">{fmtTime(x.duration).replace(/\.\d$/, "")}</span>
              </button>
            ))}
          </div>
          {meta && (
            <div className="text-xs text-slate-400">
              {meta.width}×{meta.height} · {meta.fps} fps · {meta.n_events} events
              {meta.labeled && <span className="ml-2 text-emerald-400">✓ manually reviewed</span>}
            </div>
          )}
        </div>
        {examples.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-0.5 text-xs [scrollbar-width:thin]">
            <span className="shrink-0 text-slate-500">Best example of:</span>
            {examples.map(({ c, v, t }) => (
              <button key={c} onClick={() => { setSel(v); setJump({ t, k: Date.now() }); }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200 hover:bg-white/10">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: eventColor(c) }} />{eventName(c)}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-red-400">Could not load data: {String(error)}</p>}
      {doc && <ResultViewer key={id} doc={doc} videoUrl={`./data/video/${id}.mp4`} jump={jump} />}
      {!doc && !error && <div className="card aspect-video animate-pulse" />}
    </Section>
  );
}

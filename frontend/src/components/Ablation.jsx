import { fetchJSON } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";

/** Ablation: har bir qism Score A ga qancha qo'shadi (keshlangan perception ustida, o'z labellarimiz bilan). */
export default function Ablation() {
  const { data } = useJSON("./data/ablation.json", fetchJSON);
  if (!data?.length) return null;
  const base = data[0].score_a;
  const max = Math.max(...data.map((r) => r.score_a), 0.01);
  return (
    <div className="card mt-6 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-white">Ablations: what each piece is worth</h3>
        <span className="text-xs text-slate-500">Score A on our labels of the 4 sample videos · same cached detections</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {data.map((r, i) => {
          const d = r.score_a - base;
          return (
            <div key={r.variant} className="grid grid-cols-[minmax(0,1fr)_8rem_4.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_14rem_5rem]">
              <span className={i === 0 ? "font-semibold text-white" : "text-slate-300"}>{r.variant}</span>
              <div className="h-2 rounded-full bg-white/5">
                <div className={`h-2 rounded-full ${i === 0 ? "bg-amber-400" : d < -0.005 ? "bg-red-400/80" : "bg-emerald-400/80"}`}
                  style={{ width: `${(r.score_a / max) * 100}%` }} />
              </div>
              <span className="text-right font-mono text-xs">
                <span className="text-white">{r.score_a.toFixed(3)}</span>
                {i > 0 && <span className={`ml-1 ${d < -0.005 ? "text-red-300" : "text-emerald-300"}`}>{d >= 0 ? "+" : ""}{d.toFixed(2)}</span>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Lower frame rates are simulated by thinning the cached ~10 fps tracks. Every other row removes one rule or filter from the full pipeline.
        The thresholds were tuned on these same videos, so the gaps are optimistic.
      </p>
    </div>
  );
}

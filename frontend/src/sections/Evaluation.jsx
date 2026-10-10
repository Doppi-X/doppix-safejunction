import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import Section from "./Section.jsx";
import { eventColor, eventName, fetchJSON, fmtTime } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";

const KIND = {
  TP: ["bg-emerald-500/20 text-emerald-300", "correct"],
  FP: ["bg-red-500/20 text-red-300", "false alarm"],
  FN: ["bg-amber-500/20 text-amber-300", "missed"],
};

// Sample videos bo'limidagi pleyerni shu hodisaga o'tkazish
const watch = (it) => window.dispatchEvent(new CustomEvent("doppix-jump", { detail: { video: it.video.split(".")[0], t: it.start } }));

export default function Evaluation() {
  const { data } = useJSON("./data/eval.json", fetchJSON);
  const [kind, setKind] = useState("FP");
  const [cls, setCls] = useState("all");
  const items = useMemo(() => (data?.items || []).filter((i) => (kind === "all" || i.kind === kind) && (cls === "all" || i.label === cls)), [data, kind, cls]);
  if (!data) return null;
  const classes = Object.keys(data.per_class);
  const count = (k) => data.items.filter((i) => i.kind === k).length;

  return (
    <Section id="evaluation" kicker="Error analysis" title="How good is it — on our own labels"
      intro="The official evaluate.py on our own labels of the four sample videos, and every hit, false alarm and miss. Click one to watch it.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Score A", data.score_a.toFixed(2), "text-white"], ["correct", count("TP"), "text-emerald-300"],
          ["false alarms", count("FP"), "text-red-300"], ["missed", count("FN"), "text-amber-300"]].map(([l, v, c]) => (
          <div key={l} className="card p-4"><div className={`text-3xl font-bold ${c}`}>{v}</div><div className="text-sm text-slate-400">{l}</div></div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card overflow-x-auto p-4">
          <h3 className="mb-2 font-semibold text-white">Per class (F1 at temporal IoU)</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400"><tr><th className="py-1">Class</th><th>0.3</th><th>0.5</th><th>0.7</th><th>mean</th></tr></thead>
            <tbody>
              {classes.map((c) => {
                const r = data.per_class[c];
                return (
                  <tr key={c} className="border-t border-slate-800">
                    <td className="py-1.5 pr-2"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: eventColor(c) }} />{eventName(c)}</td>
                    {["0.3", "0.5", "0.7"].map((t) => <td key={t} className="font-mono text-slate-300">{r[t].f1.toFixed(2)}</td>)}
                    <td className="font-mono font-semibold text-white">{r.f1_mean.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card overflow-x-auto p-4">
          <h3 className="mb-2 font-semibold text-white">Per video (correct / false alarm / missed at IoU 0.5)</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400"><tr><th className="py-1">Class</th>{data.videos.map((v) => <th key={v.video}>{v.video.split(".")[0]}</th>)}</tr></thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c} className="border-t border-slate-800">
                  <td className="py-1.5 pr-2">{eventName(c)}</td>
                  {data.videos.map((v) => {
                    const [tp, fp, fn] = (v[c] || "0/0/0").split("/");
                    return <td key={v.video} className="font-mono text-xs"><span className="text-emerald-300">{tp}</span>/<span className="text-red-300">{fp}</span>/<span className="text-amber-300">{fn}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-4 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {["FP", "FN", "TP", "all"].map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`btn px-2.5 py-1 text-xs ${kind === k ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
              {k === "all" ? "all" : KIND[k][1]} {k !== "all" && <span className="opacity-60">({count(k)})</span>}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-700" />
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200">
            <option value="all">all classes</option>
            {classes.map((c) => <option key={c} value={c}>{eventName(c)}</option>)}
          </select>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, k) => (
            <li key={k}>
              <button onClick={() => watch(it)} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 px-2 py-1.5 text-left text-sm hover:bg-slate-800">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${KIND[it.kind][0]}`}>{KIND[it.kind][1]}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: eventColor(it.label) }} />
                <span className="flex-1 truncate">{eventName(it.label)}</span>
                <span className="font-mono text-xs text-slate-400">{it.video.split(".")[0]} {fmtTime(it.start)}</span>
                <Play size={13} className="text-slate-500" />
              </button>
            </li>
          ))}
          {!items.length && <li className="text-sm text-slate-500">Nothing here.</li>}
        </ul>
        <p className="mt-3 text-xs text-slate-500">"Missed" rows jump to where our label starts; the pipeline has no event there.</p>
      </div>
    </Section>
  );
}

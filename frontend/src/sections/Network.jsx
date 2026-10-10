import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Building2, RefreshCw } from "lucide-react";
import Section from "./Section.jsx";
import HotspotMap from "../components/HotspotMap.jsx";
import { eventColor, eventName, getApiBase } from "../lib/data.js";

const MODE = { drawn: "zones drawn", reference: "known camera", learned: "zero-config" };

// Empirical Bayes over-dispersion (Highway Safety Manual network screening). ASSUMPTION until a pilot
// gives enough cameras to estimate it by method of moments.
const EB_K = 0.5;

const METRICS = {
  risk: { name: "Risk index", unit: "", tip: "Severity-weighted events per 10 minutes: red light, wrong way, not yielding, near miss ×3; jaywalking ×2; others ×1" },
  per1000: { name: "Serious conflicts / 1,000 pedestrians", unit: "", tip: "Pedestrian/cyclist conflicts with PET < 1.5 s per 1,000 pedestrians on the carriageway (exposure-normalised, as in Bellevue WA)" },
  eb: { name: "Excess expected conflicts (EB)", unit: "", tip: `Highway Safety Manual Empirical Bayes: expected = w·predicted + (1−w)·observed, w = 1/(1 + k·predicted), predicted = city-wide rate × this camera's pedestrians, k = ${EB_K} (assumption). Ranks by expected − predicted, which corrects for short or quiet clips.` },
};

function withMetrics(rows) {
  const ok = rows.filter((r) => r.conflicts?.exposure_pedestrians);
  const rate = ok.reduce((s, r) => s + r.conflicts.vru_serious, 0) / Math.max(1, ok.reduce((s, r) => s + r.conflicts.exposure_pedestrians, 0));
  return rows.map((r) => {
    const c = r.conflicts;
    if (!c?.exposure_pedestrians) return { ...r, m: { risk: r.risk_index, per1000: null, eb: null } };
    const pred = rate * c.exposure_pedestrians, w = 1 / (1 + EB_K * pred);
    const exp = w * pred + (1 - w) * c.vru_serious;
    return { ...r, m: { risk: r.risk_index, per1000: c.serious_per_1000_pedestrians, eb: Math.round((exp - pred) * 10) / 10 } };
  });
}

const ago = (t) => {
  const m = Math.round((Date.now() / 1000 - t) / 60);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

function useNetwork() {
  const [rows, setRows] = useState([]);
  const [api, setApi] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { getApiBase().then(setApi); }, []);
  useEffect(() => {
    if (api === null) return;
    const seed = fetch("./data/network_seed.json").then((r) => (r.ok ? r.json() : [])).catch(() => []);
    const live = fetch(`${api}/api/network`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    Promise.all([seed, live]).then(([s, l]) => setRows([
      ...l.map((r) => ({ ...r, frame: `${api}/api/network/${r.id}.jpg` })),
      ...s,
    ]));
  }, [api, tick]);
  return [rows, () => setTick((t) => t + 1)];
}

function Compare({ rows }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const A = rows.find((r) => r.id === a), B = rows.find((r) => r.id === b);
  const classes = [...new Set([...Object.keys(A?.per_10min || {}), ...Object.keys(B?.per_10min || {})])];
  const pick = (v, set, label) => (
    <label className="flex-1 text-sm">
      <span className="text-xs text-slate-400">{label}</span>
      <select value={v} onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1.5 text-white">
        <option value="">Choose a camera / period…</option>
        {rows.map((r) => <option key={r.id} value={r.id}>{r.name} · {(r.duration_s / 60).toFixed(1)} min</option>)}
      </select>
    </label>
  );
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-white">Before / after a change</h3>
      <p className="mt-1 text-xs text-slate-400">
        Analyse the same camera before and after a fix (new signal timing, a moved stop line, a raised crossing) and compare the rates.
        This is how a pilot proves its effect. Rates from clips under 5 minutes are indicative.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">{pick(a, setA, "Before")}{pick(b, setB, "After")}</div>
      {A && B && (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Events per 10 min</th><th>Before</th><th>After</th><th>Change</th></tr></thead>
          <tbody>
            {[...classes, "__risk", "__pet"].map((c) => {
              const val = (R) => (c === "__risk" ? R.risk_index : c === "__pet" ? R.conflicts?.serious_per_1000_pedestrians ?? 0 : R.per_10min[c] || 0);
              const x = val(A), y = val(B);
              const d = x ? (y - x) / x : y ? 1 : 0;
              return (
                <tr key={c} className={`border-t border-white/5 ${c.startsWith("__") ? "font-semibold text-white" : ""}`}>
                  <td className="py-1.5">{c === "__risk" ? "Risk index" : c === "__pet" ? "Serious conflicts / 1,000 pedestrians" : <><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: eventColor(c) }} />{eventName(c)}</>}</td>
                  <td className="font-mono">{x}</td><td className="font-mono">{y}</td>
                  <td className={`font-mono ${d < 0 ? "text-emerald-400" : d > 0 ? "text-red-400" : "text-slate-400"}`}>
                    {d < 0 ? <ArrowDownRight size={13} className="inline" /> : d > 0 ? <ArrowUpRight size={13} className="inline" /> : null}
                    {x || y ? ` ${Math.round(d * 100)}%` : " –"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Network() {
  const [rows, refresh] = useNetwork();
  const [metric, setMetric] = useState("risk");
  const ranked = useMemo(() => withMetrics(rows).sort((a, b) => (b.m[metric] ?? -1e9) - (a.m[metric] ?? -1e9)), [rows, metric]);
  const [sel, setSel] = useState(null);
  const cur = ranked.find((r) => r.id === sel) || ranked[0];
  const minutes = rows.reduce((s, r) => s + r.duration_s / 60, 0);
  const events = rows.reduce((s, r) => s + Object.values(r.counts || {}).reduce((x, y) => x + y, 0), 0);

  return (
    <Section id="network" kicker="For the city" title="Every camera in one dashboard, ranked by risk" alt
      intro="Each video analysed on this site lands here (event counts, hotspots and a blurred thumbnail only; videos are deleted after 6 hours). The engineer sees which junction to fix first, where on it, and whether a fix worked.">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Cameras analysed", rows.length], ["Minutes of video", minutes.toFixed(0)], ["Events found", events],
          ["Highest risk", ranked[0]?.name || "–"]].map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="truncate font-display text-xl font-bold text-white">{v}</div>
            <div className="text-xs text-slate-400">{k}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-2.5">
            <h3 className="flex items-center gap-1.5 font-semibold text-white"><Building2 size={16} className="text-amber-300" /> Risk ranking</h3>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <select value={metric} onChange={(e) => setMetric(e.target.value)} title={METRICS[metric].tip} style={{ maxWidth: "15rem" }}
                className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white">
                {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>Rank by: {v.name}</option>)}
              </select>
              <button onClick={refresh} className="btn border border-white/10 py-1 text-xs text-slate-300"><RefreshCw size={12} /> Refresh</button>
            </div>
          </div>
          <p className="border-b border-white/5 px-4 py-2 text-[11px] text-slate-500">{METRICS[metric].tip}</p>
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-950/95 text-left text-xs text-slate-500">
                <tr><th className="px-4 py-2">#</th><th>Camera</th><th title={METRICS[metric].tip} className="max-w-[9rem]">{METRICS[metric].name}</th><th>Top issue</th></tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => {
                  const top = Object.entries(r.counts || {}).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <tr key={r.id} onClick={() => setSel(r.id)}
                      className={`cursor-pointer border-t border-white/5 hover:bg-white/5 ${cur?.id === r.id ? "bg-amber-500/10" : ""}`}>
                      <td className="px-4 py-2 font-mono text-slate-500">{i + 1}</td>
                      <td className="py-2">
                        <div className="font-medium text-white">{r.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {(r.duration_s / 60).toFixed(1)} min · {MODE[r.mode] || r.mode} · {r.source === "reference" ? "our reference data" : ago(r.created)}
                        </div>
                      </td>
                      <td className="font-mono text-white">{r.m[metric] ?? "–"}</td>
                      <td className="pr-3 text-xs">{top ? <><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: eventColor(top[0]) }} />{eventName(top[0])} ×{top[1]}</> : <span className="text-slate-500">none</span>}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Loading cameras…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {cur && (
          <div className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-white">{cur.name}</h3>
              <span className="text-xs text-slate-400">{cur.vehicles ?? "–"} vehicle · {cur.pedestrians ?? "–"} pedestrian tracks</span>
            </div>
            <HotspotMap key={cur.id} className="mt-3" frameUrl={cur.frame} points={cur.hotspots || []} aspect={cur.aspect || 16 / 9} />
            <div className="mt-3 space-y-1.5">
              {Object.entries(cur.per_10min || {}).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
                const max = Math.max(...Object.values(cur.per_10min));
                return (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-slate-300">{eventName(c)}</span>
                    <div className="h-2 flex-1 rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${(100 * v) / max}%`, background: eventColor(c) }} /></div>
                    <span className="w-20 whitespace-nowrap text-right font-mono text-slate-300">{v} / 10 min</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4"><Compare rows={rows} /></div>
    </Section>
  );
}

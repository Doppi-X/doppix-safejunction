import { Download, Lightbulb } from "lucide-react";
import { eventColor, eventName } from "../lib/data.js";

const MODE = {
  drawn: ["Zones drawn by you", "All rules: red light, stop line, pedestrians, plus the zero-config rules."],
  reference: ["Known camera recognised", "Matched to our reference intersection; its calibrated zones are used."],
  learned: ["Zero-config", "No zones: the road and lane directions were learned from the traffic itself. Draw zones to enable red-light and pedestrian rules."],
};

function csv(doc) {
  const rows = [["start_s", "end_s", "event", "track_ids"], ...doc.events.map((e, i) => [e[0], e[1], e[2], (doc.involved?.[i] || []).join(" ")])];
  return rows.map((r) => r.join(",")).join("\n");
}

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}

/** City-facing summary of one analysed video. */
export default function ReportPanel({ doc }) {
  const r = doc.report || {};
  const [mode, modeNote] = MODE[doc.scene_mode] || MODE.learned;
  const classes = Object.entries(r.per_class || {}).sort((a, b) => b[1].count - a[1].count);
  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-white">Safety report</h3>
          <span className="chip border-amber-500/40 text-amber-300" title={modeNote}>{mode}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">{modeNote}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Video", `${(doc.duration || 0).toFixed(0)} s`], ["Events", doc.events.length],
            ["Vehicle tracks", r.vehicles_seen ?? "–"], ["Pedestrian tracks", r.pedestrians_seen ?? "–"]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/5 p-2">
              <div className="font-display text-xl font-bold text-white">{v}</div>
              <div className="text-[11px] text-slate-400">{k}</div>
            </div>
          ))}
        </div>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Event</th><th>Count</th><th>Per hour</th><th>Total time</th></tr></thead>
          <tbody>
            {classes.map(([c, v]) => (
              <tr key={c} className="border-t border-white/5">
                <td className="py-1.5"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: eventColor(c) }} />{eventName(c)}</td>
                <td className="font-mono">{v.count}</td>
                <td className="font-mono text-slate-400">{v.per_hour ?? "–"}</td>
                <td className="font-mono text-slate-400">{v.seconds} s</td>
              </tr>
            ))}
            {!classes.length && <tr><td className="py-2 text-slate-500" colSpan={4}>No events in this video.</td></tr>}
          </tbody>
        </table>
        {doc.privacy && (
          <p className="mt-3 text-xs text-slate-500">
            Privacy: heads and number plates blurred on every frame before the video left the server.
          </p>
        )}
      </div>
      <div className="card flex flex-col p-4">
        <h3 className="flex items-center gap-1.5 font-semibold text-white"><Lightbulb size={16} className="text-amber-300" /> What to change</h3>
        <ul className="mt-2 flex-1 space-y-2 text-sm text-slate-300">
          {(r.recommendations || []).map((t) => <li key={t} className="rounded-lg bg-white/5 p-2.5">{t}</li>)}
        </ul>
        {doc.timing && (
          <p className="mt-3 text-xs text-slate-500">
            Processed {doc.timing.video_s} s of video in {doc.timing.total_s} s on {doc.device || "our GPU server"}
            {" "}(detection + tracking {doc.timing.perception_s} s, privacy render {doc.timing.privacy_render_s} s).
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => download("safejunction_events.csv", csv(doc), "text/csv")} className="btn border border-white/10 text-slate-200 hover:bg-white/5">
            <Download size={14} /> Events CSV</button>
          <button onClick={() => download("safejunction_report.json", JSON.stringify({ events: doc.events, involved: doc.involved, report: doc.report, risk: doc.risk }, null, 1), "application/json")}
            className="btn border border-white/10 text-slate-200 hover:bg-white/5"><Download size={14} /> Full JSON</button>
        </div>
      </div>
    </div>
  );
}

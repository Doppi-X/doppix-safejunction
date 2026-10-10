import { useEffect, useRef, useState } from "react";
import { Check, Eraser, Undo2 } from "lucide-react";

// Zones the rules understand. Points are normalised 0..1 on the frame.
export const ZONE_TYPES = [
  { id: "carriageway", name: "Road", color: "#94a3b8", min: 3, hint: "outline the drivable road" },
  { id: "crosswalk", name: "Crosswalk", color: "#f8fafc", min: 3, hint: "outline a zebra crossing" },
  { id: "stop_line", name: "Stop line", color: "#f97316", min: 2, max: 2, hint: "2 clicks: the line cars stop at" },
  { id: "traffic_light", name: "Traffic light", color: "#22c55e", min: 2, max: 2, rect: true, hint: "2 clicks: box around the light that governs the stop line" },
  { id: "calibration", name: "Speed calibration", color: "#22d3ee", min: 4, max: 4, single: true,
    hint: "4 clicks around a road rectangle you know the size of (e.g. a zebra crossing), then type its sides in metres" },
];

/** Draw zones on the first frame. Click to add points; "Finish" closes the shape. Works with touch. */
export default function ZoneEditor({ frameUrl, value, onChange, disabled }) {
  const wrap = useRef(null);
  const [type, setType] = useState("carriageway");
  const [draft, setDraft] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const zones = value || {};
  const T = ZONE_TYPES.find((z) => z.id === type);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const commit = (pts) => {
    const shape = T.rect ? [[pts[0][0], pts[0][1]], [pts[1][0], pts[0][1]], [pts[1][0], pts[1][1]], [pts[0][0], pts[1][1]]] : pts;
    const extra = type === "calibration" && !zones.calibration_dims ? { calibration_dims: { width_m: 3.5, length_m: 4, limit_kmh: 60 } } : {};
    onChange({ ...zones, ...extra, [type]: T.single ? [shape] : [...(zones[type] || []), shape] });
    setDraft([]);
  };

  const click = (e) => {
    if (disabled) return;
    const r = wrap.current.getBoundingClientRect();
    const pt = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    const next = [...draft, pt];
    if (T.max && next.length >= T.max) commit(next); else setDraft(next);
  };

  const P = (pts) => pts.map(([x, y]) => `${x * size.w},${y * size.h}`).join(" ");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ZONE_TYPES.map((z) => (
          <button key={z.id} onClick={() => { setType(z.id); setDraft([]); }} disabled={disabled}
            className={`btn px-2.5 py-1 text-xs ${type === z.id ? "bg-white/15 text-white ring-1 ring-white/30" : "border border-white/10 text-slate-300"}`}>
            <span className="h-2 w-2 rounded-sm" style={{ background: z.color }} />{z.name}
            {(zones[z.id] || []).length > 0 && <span className="text-emerald-300">✓{zones[z.id].length}</span>}
          </button>
        ))}
      </div>
      <div ref={wrap} onClick={click} className={`relative select-none overflow-hidden rounded-lg ${disabled ? "" : "cursor-crosshair"}`}>
        <img src={frameUrl} alt="first frame" className="block w-full" draggable={false} />
        <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h}>
          {ZONE_TYPES.map((z) => (zones[z.id] || []).map((pts, i) => (
            z.id === "stop_line"
              ? <polyline key={z.id + i} points={P(pts)} stroke={z.color} strokeWidth={4} fill="none" />
              : <polygon key={z.id + i} points={P(pts)} stroke={z.color} strokeWidth={2} fill={z.color + "30"} />
          )))}
          {(zones.calibration || []).map((pts, i) => pts.map(([x, y], k) => (
            <text key={"c" + i + k} x={x * size.w + 6} y={y * size.h - 6} fill="#22d3ee" fontSize="13" fontWeight="700">{k + 1}</text>
          )))}
          {draft.length > 0 && <polyline points={P(draft)} stroke={T.color} strokeWidth={2} strokeDasharray="5 4" fill="none" />}
          {draft.map(([x, y], i) => <circle key={i} cx={x * size.w} cy={y * size.h} r={4} fill={T.color} />)}
        </svg>
      </div>
      {type === "calibration" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-2 text-xs text-slate-300">
          {[["width_m", "Side 1→2 (m)", 3.5], ["length_m", "Side 2→3 (m)", 4], ["limit_kmh", "Speed limit (km/h)", 60]].map(([k, label, def]) => (
            <label key={k} className="flex items-center gap-1">{label}
              <input type="number" min="0" step="0.5" disabled={disabled}
                value={(zones.calibration_dims || {})[k] ?? def}
                onChange={(e) => onChange({ ...zones, calibration_dims: { width_m: 3.5, length_m: 4, limit_kmh: 60, ...(zones.calibration_dims || {}), [k]: Number(e.target.value) } })}
                className="w-16 rounded border border-white/10 bg-slate-900 px-1.5 py-0.5 text-right text-white" />
            </label>
          ))}
          <span className="text-slate-500">A zebra stripe is usually 0.5 m; a lane about 3.5 m. Points are numbered on the frame.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400">{T.name}: {T.hint}.</span>
        <div className="flex-1" />
        {!T.max && (
          <button onClick={() => draft.length >= T.min && commit(draft)} disabled={disabled || draft.length < T.min}
            className="btn bg-white/10 px-2 py-1 text-white disabled:opacity-40"><Check size={13} /> Finish shape</button>
        )}
        <button onClick={() => setDraft(draft.slice(0, -1))} disabled={!draft.length} className="btn border border-white/10 px-2 py-1 text-slate-300 disabled:opacity-40">
          <Undo2 size={13} /> Undo point</button>
        <button onClick={() => { onChange({ ...zones, [type]: [] }); setDraft([]); }} disabled={disabled}
          className="btn border border-white/10 px-2 py-1 text-slate-300"><Eraser size={13} /> Clear {T.name.toLowerCase()}</button>
      </div>
    </div>
  );
}

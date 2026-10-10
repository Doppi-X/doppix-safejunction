import { useState } from "react";
import { useWidth } from "../lib/hooks.js";

export const SERIES_COLORS = ["#f59e0b", "#38bdf8", "#4ade80", "#f472b6", "#a78bfa", "#2dd4bf"];

function Legend({ items }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
      {items.map(([name, color]) => (
        <span key={name} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ background: color }} />{name}
        </span>
      ))}
    </div>
  );
}

/** Ko'p qatorli chiziqli grafik. series: [{name, color, points: [[x, y]]}] */
export function LineChart({ series, height = 180, xLabel = "", yLabel = "", xFmt = (v) => v, yMax }) {
  const [ref, W] = useWidth();
  const [hx, setHx] = useState(null);
  const pad = { l: 38, r: 10, t: 10, b: 24 };
  const xs = series.flatMap((s) => s.points.map((p) => p[0]));
  const ys = series.flatMap((s) => s.points.map((p) => p[1]));
  const x0 = Math.min(...xs, 0), x1 = Math.max(...xs, 1);
  const y1 = yMax ?? Math.max(...ys, 1) * 1.08;
  const pw = Math.max(10, W - pad.l - pad.r), ph = height - pad.t - pad.b;
  const x = (v) => pad.l + ((v - x0) / (x1 - x0 || 1)) * pw;
  const y = (v) => pad.t + (1 - v / y1) * ph;
  const yt = [0, 0.25, 0.5, 0.75, 1].map((k) => k * y1);
  const hv = hx == null ? null : x0 + ((hx - pad.l) / pw) * (x1 - x0);
  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg width={W} height={height} onMouseMove={(e) => setHx(e.clientX - e.currentTarget.getBoundingClientRect().left)}
          onMouseLeave={() => setHx(null)}>
          {yt.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#1e293b" />
              <text x={pad.l - 5} y={y(v)} fontSize={10} fill="#64748b" textAnchor="end" dominantBaseline="middle">
                {v >= 10 ? Math.round(v) : v.toFixed(1)}
              </text>
            </g>
          ))}
          {series.map((s) => (
            <path key={s.name} fill="none" stroke={s.color} strokeWidth={1.6}
              d={s.points.map(([a, b], i) => `${i ? "L" : "M"}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join("")} />
          ))}
          <text x={pad.l} y={height - 5} fontSize={10} fill="#64748b">{xFmt(x0)}</text>
          <text x={W - pad.r} y={height - 5} fontSize={10} fill="#64748b" textAnchor="end">{xFmt(x1)}</text>
          <text x={(W + pad.l) / 2} y={height - 5} fontSize={10} fill="#64748b" textAnchor="middle">{xLabel}</text>
          {yLabel && <text x={4} y={pad.t} fontSize={10} fill="#64748b" dominantBaseline="hanging">{yLabel}</text>}
          {hv != null && hv >= x0 && hv <= x1 && (
            <g>
              <line x1={hx} x2={hx} y1={pad.t} y2={height - pad.b} stroke="#94a3b8" strokeDasharray="2 3" />
              {series.map((s, i) => {
                const p = s.points.reduce((best, q) => (Math.abs(q[0] - hv) < Math.abs(best[0] - hv) ? q : best), s.points[0]);
                return p && (
                  <text key={s.name} x={Math.min(hx + 6, W - 110)} y={pad.t + 12 + i * 13} fontSize={11} fill={s.color}>
                    {s.name}: {typeof p[1] === "number" ? p[1].toFixed(1) : p[1]}
                  </text>
                );
              })}
            </g>
          )}
        </svg>
      )}
      <Legend items={series.map((s) => [s.name, s.color])} />
    </div>
  );
}

/** Guruhlangan ustunli grafik. groups: nomlar, series: [{name, color, values: []}] */
export function BarChart({ groups, series, height = 200, fmt = (v) => v }) {
  const [ref, W] = useWidth();
  const pad = { l: 36, r: 8, t: 14, b: 34 };
  const max = Math.max(...series.flatMap((s) => s.values), 1) * 1.1;
  const pw = Math.max(10, W - pad.l - pad.r), ph = height - pad.t - pad.b;
  const gw = pw / groups.length;
  const bw = Math.min(28, (gw * 0.8) / series.length);
  const y = (v) => pad.t + (1 - v / max) * ph;
  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg width={W} height={height}>
          {[0, 0.5, 1].map((k) => (
            <g key={k}>
              <line x1={pad.l} x2={W - pad.r} y1={y(k * max)} y2={y(k * max)} stroke="#1e293b" />
              <text x={pad.l - 5} y={y(k * max)} fontSize={10} fill="#64748b" textAnchor="end" dominantBaseline="middle">
                {fmt(+(k * max).toFixed(1))}
              </text>
            </g>
          ))}
          {groups.map((g, gi) => {
            const cx = pad.l + gw * gi + gw / 2;
            const x0 = cx - (bw * series.length) / 2;
            return (
              <g key={g}>
                {series.map((s, si) => (
                  <g key={s.name}>
                    <rect x={x0 + si * bw + 1} y={y(s.values[gi])} width={bw - 2} height={Math.max(0, y(0) - y(s.values[gi]))}
                      rx={2} fill={s.color}>
                      <title>{`${s.name} · ${g}: ${fmt(s.values[gi])}`}</title>
                    </rect>
                  </g>
                ))}
                <text x={cx} y={height - pad.b + 14} fontSize={10.5} fill="#94a3b8" textAnchor="middle">{g}</text>
              </g>
            );
          })}
        </svg>
      )}
      {series.length > 1 && <Legend items={series.map((s) => [s.name, s.color])} />}
    </div>
  );
}

/** Gistogramma: bins [min, max, n], counts */
export function Histogram({ bins, counts, color = "#38bdf8", height = 150, xLabel = "" }) {
  const [ref, W] = useWidth();
  const pad = { l: 36, r: 8, t: 8, b: 24 };
  const [lo, hi, n] = bins;
  const max = Math.max(...counts, 1);
  const pw = Math.max(10, W - pad.l - pad.r), ph = height - pad.t - pad.b;
  const bw = pw / n;
  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg width={W} height={height}>
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + ph} y2={pad.t + ph} stroke="#334155" />
          {counts.map((c, i) => (
            <rect key={i} x={pad.l + i * bw + 0.5} y={pad.t + ph - (c / max) * ph} width={Math.max(1, bw - 1)}
              height={(c / max) * ph} fill={color} opacity={0.85}>
              <title>{`${(lo + ((hi - lo) * i) / n).toFixed(0)}–${(lo + ((hi - lo) * (i + 1)) / n).toFixed(0)}: ${c}`}</title>
            </rect>
          ))}
          <text x={pad.l} y={height - 6} fontSize={10} fill="#64748b">{lo}</text>
          <text x={W - pad.r} y={height - 6} fontSize={10} fill="#64748b" textAnchor="end">{hi}+</text>
          <text x={(W + pad.l) / 2} y={height - 6} fontSize={10} fill="#64748b" textAnchor="middle">{xLabel}</text>
        </svg>
      )}
    </div>
  );
}

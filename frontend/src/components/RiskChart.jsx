import { useState } from "react";
import { fmtTime } from "../lib/data.js";
import { useWidth } from "../lib/hooks.js";

/** Part B xavf egri chizig'i: P(5 s ichida avariya), θ = 0.5 chizig'i, pleyhed. */
export default function RiskChart({ risk, duration, time, onSeek, height = 120, theta = 0.5 }) {
  const [ref, width] = useWidth();
  const [hx, setHx] = useState(null);
  const pad = { l: 34, r: 8, t: 8, b: 20 };
  const W = width, H = height;
  const pw = Math.max(10, W - pad.l - pad.r), ph = H - pad.t - pad.b;
  const dur = duration || (risk?.length ? risk[risk.length - 1][0] : 1);
  const x = (t) => pad.l + (t / dur) * pw;
  const y = (v) => pad.t + (1 - v) * ph;

  let path = "", area = "";
  if (risk?.length) {
    path = risk.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");
    area = `${path}L${x(risk[risk.length - 1][0]).toFixed(1)},${y(0)}L${x(risk[0][0]).toFixed(1)},${y(0)}Z`;
  }
  const tAt = (e) => ((e.clientX - e.currentTarget.getBoundingClientRect().left - pad.l) / pw) * dur;
  const valAt = (t) => {
    if (!risk?.length) return 0;
    let lo = 0, hi = risk.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (risk[m][0] <= t) lo = m; else hi = m - 1; }
    return risk[lo][1];
  };

  return (
    <div ref={ref} className="relative w-full">
      {W > 0 && (
        <svg width={W} height={H} className="cursor-pointer"
          onClick={(e) => { const t = tAt(e); if (t >= 0 && t <= dur) onSeek?.(t); }}
          onMouseMove={(e) => setHx(tAt(e))} onMouseLeave={() => setHx(null)}>
          <defs>
            <linearGradient id="riskfill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#1e293b" />
              <text x={pad.l - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#64748b">{v}</text>
            </g>
          ))}
          <path d={area} fill="url(#riskfill)" />
          <path d={path} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
          <line x1={pad.l} x2={W - pad.r} y1={y(theta)} y2={y(theta)} stroke="#ef4444" strokeDasharray="5 4" />
          <text x={W - pad.r - 4} y={y(theta) - 5} textAnchor="end" fontSize={10} fill="#f87171">alarm θ = {theta}</text>
          {time != null && <line x1={x(time)} x2={x(time)} y1={pad.t} y2={H - pad.b} stroke="#fbbf24" strokeWidth={2} />}
          {hx != null && hx >= 0 && hx <= dur && (
            <g>
              <line x1={x(hx)} x2={x(hx)} y1={pad.t} y2={H - pad.b} stroke="#94a3b8" strokeDasharray="2 3" />
              <text x={Math.min(x(hx) + 6, W - 90)} y={pad.t + 10} fontSize={11} fill="#e2e8f0">
                {fmtTime(hx)} · {valAt(hx).toFixed(2)}
              </text>
            </g>
          )}
          <text x={pad.l} y={H - 4} fontSize={10} fill="#64748b">0:00</text>
          <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize={10} fill="#64748b">{fmtTime(dur)}</text>
        </svg>
      )}
    </div>
  );
}

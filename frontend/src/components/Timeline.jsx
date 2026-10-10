import { useState } from "react";
import { eventClasses, eventColor, eventName, fmtTime } from "../lib/data.js";
import { useWidth } from "../lib/hooks.js";

const ROW = 26, LABEL_W = 132, AXIS = 20;

/** Hodisalar timeline'i: har klass — bitta qator; bizning belgilarimiz (bo'lsa) — yupqa chiziq ostida. */
export default function Timeline({ doc, time, onSeek }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const classes = eventClasses(doc);
  const dur = doc.duration || 1;
  const narrow = width < 520;
  const lw = narrow ? 92 : LABEL_W;
  const plotW = Math.max(10, width - lw - 8);
  const x = (t) => lw + (t / dur) * plotW;
  const H = Math.max(1, classes.length) * ROW + AXIS;

  const ticks = [];
  const step = dur > 240 ? 60 : dur > 90 ? 30 : 10;
  for (let t = 0; t <= dur; t += step) ticks.push(t);

  const click = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - r.left - lw) / plotW) * dur;
    if (t >= 0 && t <= dur) onSeek?.(t);
  };

  return (
    <div ref={ref} className="relative w-full select-none">
      {width > 0 && (
        <svg width={width} height={H} onClick={click} className="cursor-pointer">
          {classes.map((c, i) => (
            <g key={c} transform={`translate(0 ${i * ROW})`}>
              <rect x={lw} y={3} width={plotW} height={ROW - 6} rx={4} fill="#0f172a" />
              <text x={lw - 8} y={ROW / 2} textAnchor="end" dominantBaseline="middle" fontSize={narrow ? 10 : 12} fill="#cbd5e1">
                {eventName(c)}
              </text>
              {(doc.labels || []).filter((e) => e[2] === c).map((e, k) => (
                <rect key={`l${k}`} x={x(e[0])} y={ROW - 7} width={Math.max(2, x(e[1]) - x(e[0]))} height={3} fill="#e2e8f0" opacity={0.7} />
              ))}
              {(doc.events || []).filter((e) => e[2] === c).map((e, k) => (
                <rect key={k} x={x(e[0])} y={5} width={Math.max(3, x(e[1]) - x(e[0]))} height={ROW - 14} rx={2}
                  fill={eventColor(c)} opacity={time >= e[0] && time <= e[1] ? 1 : 0.75}
                  onMouseEnter={() => setHover({ e, i })} onMouseLeave={() => setHover(null)} />
              ))}
            </g>
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={H - AXIS + 4} stroke="#1e293b" />
              <text x={x(t)} y={H - 6} textAnchor="middle" fontSize={10} fill="#64748b">{fmtTime(t).replace(/\.\d$/, "")}</text>
            </g>
          ))}
          <line x1={x(time)} x2={x(time)} y1={0} y2={H - AXIS + 4} stroke="#fbbf24" strokeWidth={2} />
        </svg>
      )}
      {!classes.length && <p className="py-3 text-sm text-slate-400">No events detected.</p>}
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-md bg-slate-800 px-2 py-1 text-xs shadow"
          style={{ left: Math.min(x(hover.e[0]), width - 180), top: hover.i * ROW - 26 }}>
          {eventName(hover.e[2])}: {fmtTime(hover.e[0])} – {fmtTime(hover.e[1])}
        </div>
      )}
    </div>
  );
}

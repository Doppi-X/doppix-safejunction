import { useState } from "react";
import { eventColor, eventName } from "../lib/data.js";

/** Where events happen: one dot per road user involved, on the camera's (blurred) first frame. */
export default function HotspotMap({ frameUrl, points = [], aspect = 16 / 9, className = "" }) {
  const labels = [...new Set(points.map((p) => p[2]))];
  const [only, setOnly] = useState(null);
  const shown = only ? points.filter((p) => p[2] === only) : points;
  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg bg-slate-900" style={{ aspectRatio: aspect }}>
        {frameUrl && <img src={frameUrl} alt="camera view" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <filter id="hs-blur"><feGaussianBlur stdDeviation="14" /></filter>
          </defs>
          <g filter="url(#hs-blur)">
            {shown.map(([x, y, l], i) => <ellipse key={`h${i}`} cx={x * 1000} cy={y * 1000} rx="38" ry="60" fill={eventColor(l)} opacity="0.35" />)}
          </g>
          {shown.map(([x, y, l], i) => (
            <ellipse key={i} cx={x * 1000} cy={y * 1000} rx="6" ry="9" fill={eventColor(l)} stroke="#0f172a" strokeWidth="2" />
          ))}
        </svg>
        {!points.length && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">No events to place on the map.</div>}
      </div>
      {labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <button onClick={() => setOnly(null)} className={`chip ${!only ? "border-amber-400 text-amber-300" : "text-slate-400"}`}>All ({points.length})</button>
          {labels.map((l) => (
            <button key={l} onClick={() => setOnly(only === l ? null : l)}
              className={`chip ${only === l ? "border-amber-400 text-amber-300" : "text-slate-300"}`}>
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: eventColor(l) }} />
              {eventName(l)} ({points.filter((p) => p[2] === l).length})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

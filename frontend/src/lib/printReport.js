// Printable one-page report for the traffic engineer: the browser's "Save as PDF" makes the PDF.
import { eventColor, eventName } from "./data.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const MODE = { drawn: "Zones drawn by the engineer", reference: "Known camera (calibrated zones)", learned: "Zero-config (road learned from traffic)" };

export function printReport({ doc, name, frameUrl }) {
  const r = doc.report || {};
  const rows = Object.entries(r.per_class || {}).sort((a, b) => b[1].count - a[1].count);
  const minutes = Math.max(doc.duration / 60, 1e-6);
  const aspect = doc.width / doc.height;
  const dots = (r.hotspots || []).map(([x, y, l]) =>
    `<circle cx="${x * 1000}" cy="${y * 1000 / aspect}" r="9" fill="${eventColor(l)}" stroke="#000" stroke-width="2"/>`).join("");
  const legend = [...new Set((r.hotspots || []).map((h) => h[2]))]
    .map((l) => `<span><i style="background:${eventColor(l)}"></i>${esc(eventName(l))}</span>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>SafeJunction report – ${esc(name)}</title>
<style>
body{font:13px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:28px;max-width:900px}
h1{font-size:22px;margin:0}h2{font-size:15px;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
.sub{color:#555}.kpis{display:flex;gap:10px;margin-top:12px}.kpis div{border:1px solid #ddd;border-radius:6px;padding:6px 10px;flex:1}
.kpis b{display:block;font-size:18px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #eee;padding:4px 6px;text-align:left}
.map{position:relative}.map img,.map svg{width:100%;display:block}.map svg{position:absolute;inset:0;height:100%}
.legend span{margin-right:12px}.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
li{margin-bottom:4px}.foot{margin-top:18px;color:#666;font-size:11px}@media print{body{margin:12mm}}
</style></head><body>
<h1>Road-safety report · ${esc(name)}</h1>
<div class="sub">Do'ppiX SafeJunction · ${new Date().toLocaleString()} · ${esc(MODE[doc.scene_mode] || doc.scene_mode)}</div>
<div class="kpis"><div><b>${doc.duration.toFixed(0)} s</b>video analysed</div><div><b>${doc.events.length}</b>events</div>
<div><b>${r.vehicles_seen ?? "–"}</b>vehicle tracks</div><div><b>${r.pedestrians_seen ?? "–"}</b>pedestrian tracks</div></div>
<h2>Events</h2>
<table><tr><th>Event</th><th>Count</th><th>Per 10 min (this clip)</th><th>Per hour</th><th>Total time</th></tr>
${rows.map(([c, v]) => `<tr><td>${esc(eventName(c))}</td><td>${v.count}</td><td>${(v.count / minutes * 10).toFixed(1)}</td><td>${v.per_hour ?? "needs ≥ 5 min"}</td><td>${v.seconds} s</td></tr>`).join("")
  || `<tr><td colspan="5">No events in this clip.</td></tr>`}</table>
${r.conflicts ? `<h2>Conflicts (post-encroachment time)</h2>
<table><tr><th>Serious &lt; 1.5 s</th><th>Moderate 1.5–3 s</th><th>Interaction 3–5 s</th><th>Serious pedestrian conflicts per 1,000 pedestrians</th><th>Exposure (pedestrians / vehicles)</th></tr>
<tr><td>${r.conflicts.counts.serious}</td><td>${r.conflicts.counts.moderate}</td><td>${r.conflicts.counts.interaction}</td><td>${r.conflicts.serious_per_1000_pedestrians ?? "–"}</td><td>${r.conflicts.exposure_pedestrians} / ${r.conflicts.exposure_vehicles}</td></tr></table>` : ""}
${r.speed && r.speed.vehicles ? `<h2>Speeds (4-point calibration)</h2>
<table><tr><th>Vehicles</th><th>Median</th><th>85th percentile</th><th>Max</th><th>Over limit (${r.speed.limit_kmh} km/h)</th><th>Over limit + 10</th></tr>
<tr><td>${r.speed.vehicles}</td><td>${r.speed.median_kmh} km/h</td><td>${r.speed.p85_kmh} km/h</td><td>${r.speed.max_kmh} km/h</td><td>${Math.round(100 * r.speed.share_over_limit)} %</td><td>${Math.round(100 * r.speed.share_over_limit_10)} %</td></tr></table>` : ""}
<h2>Where it happens</h2>
<div class="map">${frameUrl ? `<img src="${esc(frameUrl)}" crossorigin="anonymous">` : ""}<svg viewBox="0 0 1000 ${1000 / aspect}" preserveAspectRatio="none">${dots}</svg></div>
<div class="legend">${legend}</div>
<h2>What to change</h2><ul>${(r.recommendations || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
<h2>Event list</h2>
<table><tr><th>#</th><th>Start</th><th>End</th><th>Event</th></tr>
${doc.events.map((e, i) => `<tr><td>${i + 1}</td><td>${e[0].toFixed(1)} s</td><td>${e[1].toFixed(1)} s</td><td>${esc(eventName(e[2]))}</td></tr>`).join("")}</table>
<div class="foot">Faces and number plates were blurred on the server before any frame was shown. Rates from clips shorter than 5 minutes are indicative only.
Events come from fixed, inspectable rules over our own detector and tracker; check each against the video before acting.</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

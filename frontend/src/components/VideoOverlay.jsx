import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { OBJ_COLORS, eventColor, eventName } from "../lib/data.js";

// Treklarni bir marta tuzilmaga aylantirish: [{t, objs: Map(id -> {c, b:[x1,y1,x2,y2]})}]
export function parseTracks(doc) {
  const names = doc.classes;
  return (doc.tracks || []).map((row) => {
    const objs = new Map();
    for (let i = 1; i + 5 < row.length + 1; i += 6) {
      objs.set(row[i], { c: names[row[i + 1]], b: [row[i + 2], row[i + 3], row[i + 4], row[i + 5]].map((v) => v / 1000) });
    }
    return { t: row[0], objs };
  });
}

function frameIndex(frames, t) {
  let lo = 0, hi = frames.length - 1;
  if (hi < 0 || t < frames[0].t) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

function lightAt(phases, t) {
  let s = -1;
  for (const [pt, ps] of phases || []) { if (pt <= t) s = ps; else break; }
  return s;
}

function riskAt(risk, t) {
  let lo = 0, hi = (risk?.length || 0) - 1;
  if (hi < 0 || t < risk[0][0]) return 0;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (risk[m][0] <= t) lo = m; else hi = m - 1; }
  return risk[lo][1];
}

// bir obyekt bir nechta hodisada bo'lsa — qaysi biri ko'rsatiladi (muhimrog'i birinchi)
const PRIORITY = ["accident", "near_miss", "red_light", "wrong_way", "failure_to_yield", "jaywalking", "illegal_u_turn",
  "illegal_turn", "solid_line_crossing", "stop_line", "stopped_vehicle", "road_obstacle", "fire_smoke", "congestion"];

const ZONE_STYLE = {
  carriageway: { stroke: "rgba(148,163,184,.55)", fill: "rgba(148,163,184,.06)" },
  islands: { stroke: "rgba(251,191,36,.6)", fill: "rgba(251,191,36,.12)" },
  crosswalks: { stroke: "rgba(255,255,255,.85)", fill: "rgba(255,255,255,.18)" },
  lights: { stroke: "rgba(34,197,94,.9)", fill: "rgba(34,197,94,.1)" },
};

/** Video + kanvas ustida: boxlar, izlar, sahna zonalari, faol hodisalar, svetofor va xavf. */
const VideoOverlay = forwardRef(function VideoOverlay({ src, doc, frames, layers, onTime, controls = true, offset = 0 }, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const raf = useRef(0);

  useImperativeHandle(ref, () => ({
    seek(t) { const v = videoRef.current; if (v) { v.currentTime = Math.max(0, t); } },
    play() { videoRef.current?.play(); },
    get video() { return videoRef.current; },
  }));

  const events = useMemo(() => doc.events || [], [doc]);
  const lastT = useRef(-1);

  const draw = () => {
    const v = videoRef.current, cv = canvasRef.current;
    if (!v || !cv) return;
    const rect = v.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const CW = Math.round(rect.width * dpr), CH = Math.round(rect.height * dpr);
    if (cv.width !== CW || cv.height !== CH) {
      cv.width = CW; cv.height = CH;
      cv.style.width = `${rect.width}px`; cv.style.height = `${rect.height}px`;
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    // video kadri element ichida "contain" bo'lib turadi — rasm maydonini topamiz
    const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
    const k = Math.min(CW / vw, CH / vh);
    const W = vw * k, H = vh * k;
    ctx.translate((CW - W) / 2, (CH - H) / 2);
    const t = v.currentTime + offset;   // offset: qisqa klip asl videoning qaysi soniyasidan boshlangani
    if (Math.abs(t - lastT.current) > 0.08) { lastT.current = t; onTime?.(t); }
    const s = dpr * Math.max(0.7, W / dpr / 900);   // chiziq/shrift masshtabi

    // zonalar
    if (layers.zones && doc.zones) {
      ctx.lineWidth = 1.5 * s;
      for (const [k, st] of Object.entries(ZONE_STYLE)) {
        for (const poly of doc.zones[k] || []) {
          ctx.beginPath();
          poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
          ctx.closePath();
          ctx.fillStyle = st.fill; ctx.fill();
          ctx.strokeStyle = st.stroke; ctx.stroke();
        }
      }
      ctx.strokeStyle = "#f97316"; ctx.lineWidth = 3 * s;
      for (const line of doc.zones.stop_lines || []) {
        ctx.beginPath();
        line.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
        ctx.stroke();
      }
    }

    // learned flow field (zero-config scene): arrows where traffic has one clear direction
    if (layers.flow && doc.flow) {
      const { gw, gh, cell_w, cell_h, count, dir } = doc.flow;
      ctx.lineWidth = 1.6 * s;
      for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) {
        const n = count[r][c], [dx, dy] = dir[r][c], m = Math.hypot(dx, dy);
        if (n < 8 || m < 0.6) continue;
        const cx = (c + 0.5) * cell_w * W, cy = (r + 0.5) * cell_h * H, L = 0.42 * cell_w * W;
        const ux = dx / m, uy = dy / m, x2 = cx + ux * L, y2 = cy + uy * L;
        ctx.strokeStyle = `rgba(56,189,248,${0.35 + 0.6 * m})`;
        ctx.beginPath(); ctx.moveTo(cx - ux * L, cy - uy * L); ctx.lineTo(x2, y2);
        ctx.lineTo(x2 - ux * 6 * s - uy * 4 * s, y2 - uy * 6 * s + ux * 4 * s);
        ctx.moveTo(x2, y2); ctx.lineTo(x2 - ux * 6 * s + uy * 4 * s, y2 - uy * 6 * s - ux * 4 * s);
        ctx.stroke();
      }
    }

    // faol hodisalarning ishtirokchilari: trek id -> hodisa (rang, nom)
    const focus = new Map();
    if (layers.highlight && doc.involved) {
      const rank = (l) => { const i = PRIORITY.indexOf(l); return i < 0 ? 99 : i; };
      (doc.events || []).forEach(([a, b, label], k) => {
        if (t < a || t > b) return;
        for (const id of doc.involved[k] || []) {
          if (!focus.has(id) || rank(label) < rank(focus.get(id))) focus.set(id, label);   // muhimrog'i ustun
        }
      });
    }

    const i = frameIndex(frames, t);
    if (i >= 0) {
      const f0 = frames[i], f1 = frames[i + 1];
      const a = f1 && f1.t > f0.t ? Math.min(1, (t - f0.t) / (f1.t - f0.t)) : 0;

      // izlar (so'nggi ~3 s, oyoq nuqtasi)
      if (layers.trails) {
        const trails = new Map();
        for (let j = Math.max(0, i - 15); j <= i; j++) {
          for (const [id, o] of frames[j].objs) {
            if (o.c.startsWith("light")) continue;
            if (!trails.has(id)) trails.set(id, { c: o.c, pts: [] });
            trails.get(id).pts.push([(o.b[0] + o.b[2]) / 2 * W, o.b[3] * H]);
          }
        }
        ctx.lineWidth = 2 * s;
        for (const { c, pts } of trails.values()) {
          if (pts.length < 2) continue;
          ctx.strokeStyle = OBJ_COLORS[c] + "99";
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      }

      const hot = [];
      if (layers.boxes || focus.size) {
        ctx.font = `${Math.round(11 * s)}px ui-sans-serif, system-ui`;
        ctx.textBaseline = "bottom";
        for (const [id, o] of f0.objs) {
          let b = o.b;
          const n = f1?.objs.get(id);
          if (n && a > 0) b = b.map((v, k) => v + (n.b[k] - v) * a);
          const col = OBJ_COLORS[o.c] || "#fff";
          const x = b[0] * W, y = b[1] * H, w = (b[2] - b[0]) * W, h = (b[3] - b[1]) * H;
          const ev = focus.get(id);
          if (ev) {                          // hodisa ishtirokchisi: qalin, hodisa rangida, nomi bilan
            hot.push({ x, y, w, h, label: ev });
            continue;
          }
          if (!layers.boxes) continue;
          ctx.globalAlpha = focus.size ? 0.35 : 1;
          ctx.strokeStyle = col; ctx.lineWidth = 1.6 * s;
          ctx.strokeRect(x, y, w, h);
          ctx.globalAlpha = 1;
          if (layers.ids && !o.c.startsWith("light")) {
            const label = `${o.c === "person" ? "ped" : o.c} ${id}`;
            const tw = ctx.measureText(label).width + 6 * s;
            ctx.fillStyle = col; ctx.fillRect(x, y - 13 * s, tw, 13 * s);
            ctx.fillStyle = "#0f172a"; ctx.fillText(label, x + 3 * s, y - 1.5 * s);
          }
        }
        // hodisa ishtirokchilari — hammasidan ustida: yorqin ramka, yarim shaffof fon, hodisa nomi
        ctx.font = `600 ${Math.round(12 * s)}px ui-sans-serif, system-ui`;
        for (const { x, y, w, h, label } of hot) {
          const col = eventColor(label);
          ctx.fillStyle = col + "33"; ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = col; ctx.lineWidth = 3.5 * s;
          ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
          const txt = eventName(label);
          const tw = ctx.measureText(txt).width + 10 * s;
          const ty = Math.max(0, y - 20 * s);
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x - 2 * s, ty, tw, 17 * s, 4 * s); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.fillText(txt, x + 3 * s, ty + 15 * s);
        }
      }
    }

    // faol hodisalar
    const active = events.filter(([a, b]) => t >= a && t <= b);
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(13 * s)}px ui-sans-serif, system-ui`;
    let yy = 10 * s;
    for (const [, , label] of active) {
      const txt = eventName(label);
      const tw = ctx.measureText(txt).width + 20 * s;
      ctx.fillStyle = eventColor(label); ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.roundRect(10 * s, yy, tw, 22 * s, 6 * s); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = "#fff";
      ctx.fillText(txt, 20 * s, yy + 11 * s);
      yy += 27 * s;
    }

    // svetofor + xavf (o'ng yuqori)
    const ls = lightAt(doc.light, t);
    const r = riskAt(doc.risk, t);
    const bx = W - 150 * s, by = 10 * s;
    ctx.fillStyle = "rgba(15,23,42,.8)";
    ctx.beginPath(); ctx.roundRect(bx, by, 140 * s, 52 * s, 8 * s); ctx.fill();
    ctx.fillStyle = ls === 1 ? "#ef4444" : ls === 0 ? "#22c55e" : "#64748b";
    ctx.beginPath(); ctx.arc(bx + 16 * s, by + 16 * s, 7 * s, 0, 7); ctx.fill();
    ctx.fillStyle = "#e2e8f0"; ctx.font = `${Math.round(11 * s)}px ui-sans-serif, system-ui`;
    ctx.fillText(ls === 1 ? "light: RED" : ls === 0 ? "light: not red" : "light: unknown", bx + 30 * s, by + 16 * s);
    ctx.fillText(`risk ${r.toFixed(2)}`, bx + 10 * s, by + 38 * s);
    ctx.fillStyle = "#334155"; ctx.fillRect(bx + 68 * s, by + 34 * s, 62 * s, 8 * s);
    ctx.fillStyle = r >= 0.5 ? "#ef4444" : r >= 0.3 ? "#f59e0b" : "#22c55e";
    ctx.fillRect(bx + 68 * s, by + 34 * s, 62 * s * Math.min(1, r), 8 * s);
  };

  // eng so'nggi draw (props o'zgarsa ham) — tinglovchilar bir marta ulanadi
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => { requestAnimationFrame(() => drawRef.current()); });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const loop = () => { drawRef.current(); if (!v.paused && !v.ended) raf.current = requestAnimationFrame(loop); };
    const start = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(loop); };
    const once = () => requestAnimationFrame(() => drawRef.current());
    const onUpdate = () => v.paused && once();
    v.addEventListener("play", start);
    v.addEventListener("seeked", once);
    v.addEventListener("loadeddata", once);
    v.addEventListener("timeupdate", onUpdate);
    const ro = new ResizeObserver(once);
    ro.observe(v);
    return () => {
      cancelAnimationFrame(raf.current);
      v.removeEventListener("play", start);
      v.removeEventListener("seeked", once);
      v.removeEventListener("loadeddata", once);
      v.removeEventListener("timeupdate", onUpdate);
      ro.disconnect();
    };
  }, [src]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} src={src} controls={controls} playsInline muted preload="metadata" className="block w-full" />
      <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0" />
    </div>
  );
});

export default VideoOverlay;

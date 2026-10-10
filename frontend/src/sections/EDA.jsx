import { useState } from "react";
import Section from "./Section.jsx";
import { BarChart, Histogram, LineChart, SERIES_COLORS } from "../components/charts.jsx";
import { OBJ_COLORS, eventColor, eventName, fetchJSON, fmtTime } from "../lib/data.js";
import { useJSON } from "../lib/hooks.js";

const OBJ = ["car", "person", "bus", "truck", "motorcycle", "bicycle"];

// EDA topilmasi -> yechimdagi qaror
const FINDINGS = [
  ["The camera moves between videos", "Up to ~70 px shift and ~1° rotation", "Scene layout is re-aligned per video (ORB + RANSAC)"],
  ["One light governs the stop line", "97–98 % of stop-line crossings happen when light C is not red", "red_light and stop_line read light C only"],
  ["Hard sun, dark lamps", "Brightness is flat and high; the lamp colour is washed out", "Light state trained as 2 detector classes"],
  ["Walkers vs. riders", "Pedestrians move 0.3–1 body heights/s; scooters 2.5+", "Faster than 2 heights/s is not a pedestrian"],
  ["Two signals, 2 s apart", "Pedestrian and vehicle lights switch about 2 s apart", "failure_to_yield on the signalised crossing only 2 s into red"],
];

function Card({ title, note, children, className = "" }) {
  return (
    <div className={`card p-4 ${className}`}>
      <h3 className="font-semibold text-white">{title}</h3>
      {note && <p className="mt-1 text-sm text-slate-400">{note}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Pills({ items, value, onChange }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {items.map(([k, n]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`btn px-2 py-0.5 text-xs ${k === value ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>{n}</button>
      ))}
    </div>
  );
}

const sumHist = (vids, key, n) => vids.reduce((a, v) => a.map((x, i) => x + v.speed_hist[key][i]), Array(n).fill(0));

export default function EDA() {
  const { data: eda } = useJSON("./data/eda.json", fetchJSON);
  const { data: samples } = useJSON("./data/samples.json", fetchJSON);
  const [heat, setHeat] = useState("veh");
  const [traj, setTraj] = useState(null);
  const [objVid, setObjVid] = useState(null);
  const head = { id: "eda", kicker: "Exploratory data analysis", title: "What the camera sees", alt: true };
  if (!eda || !samples) return <Section {...head}><div className="card h-64 animate-pulse" /></Section>;

  const vids = eda.videos;
  const vidPills = vids.map((v) => [v.id, v.id]);
  const trajId = traj || vids[0].id;
  const ov = vids.find((v) => v.id === objVid) || vids[0];
  const totalMin = vids.reduce((a, v) => a + v.duration, 0) / 60;
  const avg = (v, c) => { const a = v.per_sec[c] || []; return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; };
  const objCls = OBJ.filter((c) => vids.some((v) => avg(v, c) > 0.05));
  const evClasses = [...new Set(samples.flatMap((s) => Object.keys(s.event_counts)))];

  return (
    <Section {...head}
      intro={`${vids.length} videos, ${totalMin.toFixed(1)} min, one fixed camera. Every number below comes from our detector and tracker; the top row lists what changed our solution.`}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FINDINGS.map(([t, f, d]) => (
          <div key={t} className="card p-3">
            <div className="text-sm font-semibold text-white">{t}</div>
            <div className="mt-1 text-xs text-slate-400">{f}</div>
            <div className="mt-2 border-t border-white/5 pt-2 text-xs text-amber-300">→ {d}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Footage" note="4K 10-bit 4:2:2 H.264 at ~30 fps, ~147 Mb/s. Browsers cannot play this format, so the site shows H.264 copies. The pipeline reads the originals.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr><th className="py-1 pr-3">Video</th><th className="pr-3">Length</th><th className="pr-3">Resolution</th><th className="pr-3">FPS</th><th className="pr-3">Codec</th><th>Bitrate</th></tr>
              </thead>
              <tbody className="text-slate-200">
                {vids.map((v) => (
                  <tr key={v.id} className="border-t border-slate-800">
                    <td className="py-1.5 pr-3 font-mono">{v.id}</td>
                    <td className="pr-3">{fmtTime(v.duration).replace(/\.\d$/, "")}</td>
                    <td className="pr-3">{v.width}×{v.height}</td>
                    <td className="pr-3">{v.fps}</td>
                    <td className="whitespace-nowrap pr-3">{v.codec} <span className="text-slate-500">{v.pix_fmt}</span></td>
                    <td className="whitespace-nowrap">{v.bitrate_kbps ? `${(v.bitrate_kbps / 1000).toFixed(0)} Mb/s` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Lighting over time" note="Mean frame brightness (HSV value, 0–255). All footage is daytime with hard sun and moving shadows, which is why the lamp colour is hard to read. We trained the traffic-light state as a detector class instead of thresholding colours.">
          <LineChart yMax={255} xLabel="time, s" xFmt={(v) => `${Math.round(v)}s`}
            series={vids.map((v, i) => ({ name: v.id, color: SERIES_COLORS[i], points: v.brightness }))} />
        </Card>

        <Card title="Road users in frame" note="Average number of objects of each class visible at any moment.">
          <BarChart groups={objCls}
            series={vids.map((v, i) => ({ name: v.id, color: SERIES_COLORS[i], values: objCls.map((c) => +avg(v, c).toFixed(2)) }))} />
        </Card>

        <Card title="Density over time" note="Cars and pedestrians visible each second. The waves follow the traffic-light cycle.">
          <Pills items={vidPills} value={ov.id} onChange={setObjVid} />
          <LineChart xLabel="time, s" xFmt={(v) => `${Math.round(v)}s`}
            series={["car", "person"].map((c) => ({ name: c, color: OBJ_COLORS[c], points: (ov.per_sec[c] || []).map((y, x) => [x, y]) }))} />
        </Card>

        <Card title="Motion heatmap" note="Where road users actually are: foot points of all tracks from all videos.">
          <Pills items={[["veh", "Vehicles"], ["ped", "Pedestrians"]]} value={heat} onChange={setHeat} />
          <img src={`./data/img/heat_${heat}.jpg`} alt="motion heatmap" className="w-full rounded-lg" loading="lazy" />
        </Card>

        <Card title="Trajectories" note="Every track in one video. Green = vehicles, yellow = pedestrians. Pedestrians use the crosswalks but also cut across the right side of the intersection.">
          <Pills items={vidPills} value={trajId} onChange={setTraj} />
          <img src={`./data/img/${trajId}_traj.jpg`} alt="trajectories" className="w-full rounded-lg" loading="lazy" />
        </Card>

        <Card title="Speeds" note="Image-plane speed of the foot point (px/s in the 1920-px frame). Most vehicle speeds are near zero because of queues at the red light.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">Vehicles</p>
              <Histogram bins={eda.speed_bins.veh} counts={sumHist(vids, "veh", eda.speed_bins.veh[2])} color={OBJ_COLORS.car} xLabel="px/s" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Pedestrians</p>
              <Histogram bins={eda.speed_bins.ped} counts={sumHist(vids, "ped", eda.speed_bins.ped[2])} color={OBJ_COLORS.person} xLabel="px/s" />
            </div>
          </div>
        </Card>

        <Card title="Signal & events" note="Share of time the governing traffic light is red, and the events our pipeline found in each video.">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {vids.map((v) => (
              <div key={v.id} className="rounded-lg bg-slate-800/60 p-2 text-center">
                <div className="font-mono text-xs text-slate-400">{v.id}</div>
                <div className="text-lg font-semibold text-red-400">{v.light_red_share != null ? `${Math.round(v.light_red_share * 100)}%` : "–"}</div>
                <div className="text-xs text-slate-500">red</div>
              </div>
            ))}
          </div>
          <BarChart groups={samples.map((s) => s.id)}
            series={evClasses.map((c) => ({ name: eventName(c), color: eventColor(c), values: samples.map((s) => s.event_counts[c] || 0) }))} />
        </Card>
      </div>
    </Section>
  );
}

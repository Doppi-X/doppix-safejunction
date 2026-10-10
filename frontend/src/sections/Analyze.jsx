import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, MapPin, RotateCcw, Upload } from "lucide-react";
import Section from "./Section.jsx";
import ResultViewer from "../components/ResultViewer.jsx";
import ReportPanel from "../components/ReportPanel.jsx";
import ZoneEditor from "../components/ZoneEditor.jsx";
import { getApiBase } from "../lib/data.js";

const STAGES = {
  upload: "Uploading", queued: "Waiting in queue", perception: "Detecting and tracking road users",
  events: "Learning the scene and finding events", privacy: "Blurring faces and plates", done: "Done",
};

function useServer() {
  const [api, setApi] = useState(null);
  const [server, setServer] = useState(null);           // null checking, false waking, "offline", {...}
  useEffect(() => { getApiBase().then(setApi); }, []);
  useEffect(() => {
    if (api === null) return;
    let alive = true, tries = 0, t;
    const ping = () => fetch(`${api}/api/health`).then((r) => r.json()).then((d) => alive && setServer(d))
      .catch(() => { if (!alive) return; setServer(++tries < 4 ? false : "offline"); t = setTimeout(ping, 5000); });
    ping();
    return () => { alive = false; clearTimeout(t); };
  }, [api]);
  return [api, server];
}

function post(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    const x = new XMLHttpRequest();
    x.open("POST", url);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => {
      let d = {};
      try { d = JSON.parse(x.responseText); } catch { /* not json */ }
      x.status < 400 ? resolve(d) : reject(new Error(d.detail || `Server error ${x.status}`));
    };
    x.onerror = () => reject(new Error("Upload failed. Is the server online?"));
    x.send(fd);
  });
}

export default function Analyze() {
  const [api, server] = useServer();
  const [job, setJob] = useState(null);
  const [doc, setDoc] = useState(null);
  const [img, setImg] = useState(null);
  const [zones, setZones] = useState({});
  const [zoneState, setZoneState] = useState("");       // "", "saving", "saved"
  const [upload, setUpload] = useState(0);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const online = server && server !== "offline";

  // poll the job; load the result when done
  useEffect(() => {
    if (!job?.id || job.status === "error") { if (job?.status === "error") setError(job.message || "Processing failed"); return; }
    if (job.status === "done") {
      fetch(`${api}/api/jobs/${job.id}/result?t=${Date.now()}`).then((r) => r.json()).then(setDoc).catch(() => setError("Could not load the result."));
      return;
    }
    const t = setTimeout(() => fetch(`${api}/api/jobs/${job.id}`).then((r) => r.json()).then(setJob).catch(() => setJob({ ...job })), 1500);
    return () => clearTimeout(t);
  }, [job]);

  const start = async (file) => {
    if (!file) return;
    setError(""); setDoc(null); setImg(null); setJob(null); setZones({}); setZoneState(""); setUpload(0);
    const isImage = file.type.startsWith("image/");
    try {
      if (isImage) {
        setJob({ status: "upload", stage: "upload" });
        const r = await post(`${api}/api/image`, file, setUpload);
        setImg({ ...r, url: `${api}${r.image_url}` });
        setJob(null);
      } else {
        if (server?.max_mb && file.size > server.max_mb * 2 ** 20) throw new Error(`File is larger than ${server.max_mb} MB.`);
        setJob({ status: "upload", stage: "upload" });
        setJob(await post(`${api}/api/jobs`, file, setUpload));
      }
    } catch (e) { setError(e.message); setJob(null); }
  };

  const saveZones = async () => {
    setZoneState("saving");
    try {
      const r = await fetch(`${api}/api/jobs/${job.id}/zones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(zones) });
      const s = await r.json();
      setJob(s);
      if (s.status === "done") setDoc(null);          // re-fetch with the new zones
      setZoneState("saved");
    } catch { setZoneState(""); setError("Could not save zones."); }
  };

  const reset = () => { setJob(null); setDoc(null); setImg(null); setError(""); setZones({}); setZoneState(""); };
  const busy = job && !["done", "error"].includes(job.status);
  const pct = job?.stage === "upload" ? upload : job?.progress || 0;

  return (
    <Section id="analyze" kicker="Try it" title="Analyse your own traffic video"
      intro="Any fixed traffic camera. Upload a video (first 2 min are processed) or a photo. Optionally draw the road, crossings and stop line while it runs.">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-400" : server === null || server === false ? "animate-pulse bg-amber-400" : "bg-slate-500"}`} />
        {online ? <span className="text-slate-400">Server online · {server.device} · up to {server.max_sec} s, {server.max_mb} MB</span>
          : server === "offline" ? <span className="text-slate-400">Server offline. The sample results below still work.</span>
            : <span className="text-slate-400">Connecting to the server…</span>}
      </div>

      {!job && !doc && !img && (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); start(e.dataTransfer.files?.[0]); }}
          className={`card flex flex-col items-center justify-center gap-4 border-dashed p-10 text-center ${drag ? "ring-2 ring-amber-400" : ""}`}>
          <Upload className="text-amber-400" size={36} />
          <div>
            <p className="font-semibold text-white">Drop a traffic video or photo here</p>
            <p className="mt-1 text-sm text-slate-400">MP4/MOV/AVI/MKV or JPG/PNG. Faces and plates are blurred before anything is shown.</p>
          </div>
          <button disabled={!online} onClick={() => input.current?.click()}
            className="btn bg-amber-500 px-4 py-2 text-slate-950 hover:bg-amber-400 disabled:opacity-40"><Upload size={16} /> Choose file</button>
          <input ref={input} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => start(e.target.files?.[0])} />
        </div>
      )}

      {busy && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-amber-400" />
              <div className="flex-1">
                <div className="font-medium text-white">{STAGES[job.stage] || job.stage}</div>
                <div className="text-sm text-slate-400">{job.queue_pos ? `${job.queue_pos} job(s) ahead · ` : ""}{job.processed_sec ? `${Math.round(job.processed_sec)} s of video` : ""}</div>
              </div>
              <div className="font-mono text-sm text-slate-300">{Math.round(pct * 100)}%</div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.max(2, pct * 100)}%` }} />
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Without zones the system learns the road and lane directions from the traffic (wrong-way, stopped vehicles, congestion, near misses).
              Drawing a crossing, stop line and traffic light adds red-light, stop-line and pedestrian rules.
            </p>
          </div>
          {job.id && (
            <div className="card p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white"><MapPin size={15} className="text-amber-300" /> Optional: draw zones while it runs</h4>
              <ZoneEditor frameUrl={`${api}/api/jobs/${job.id}/frame`} value={zones} onChange={(z) => { setZones(z); setZoneState(""); }} />
              <button onClick={saveZones} className="btn mt-2 bg-white/10 text-white hover:bg-white/15">{zoneState === "saved" ? "Zones saved ✓" : zoneState === "saving" ? "Saving…" : "Use these zones"}</button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="card mt-4 flex items-center justify-between border-red-800 p-4 text-red-300">
          <span>{error}</span>
          <button className="btn border border-white/10 text-slate-200" onClick={reset}><RotateCcw size={14} /> Try again</button>
        </div>
      )}

      {img && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <img src={img.url} alt="analysed" className="w-full rounded-xl" />
          <div className="card p-4">
            <h3 className="flex items-center gap-1.5 font-semibold text-white"><ImageIcon size={16} /> Photo analysis</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(img.counts).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-slate-300">{k}</span><span className="font-mono">{v}</span></li>)}
            </ul>
            <p className="mt-3 text-sm text-slate-400">Traffic light: <b className="text-white">{img.traffic_light || "not seen"}</b></p>
            <p className="mt-1 text-xs text-slate-500">{img.plates_blurred} plates and {img.heads_blurred} heads blurred · {img.elapsed_s} s. Events need a video.</p>
            <button className="btn mt-3 border border-white/10 text-slate-200" onClick={reset}><RotateCcw size={14} /> Another file</button>
          </div>
        </div>
      )}

      {doc && job?.id && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-slate-400">{doc.width}×{doc.height} · {doc.fps} fps</span>
            <button className="btn border border-white/10 text-slate-200 hover:bg-white/5" onClick={reset}><RotateCcw size={14} /> New video</button>
          </div>
          <ReportPanel doc={doc} />
          <ResultViewer doc={doc} videoUrl={`${api}/api/jobs/${job.id}/video.mp4`} />
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white">Edit zones and re-run the rules (takes seconds)</summary>
            <div className="mt-3">
              <ZoneEditor frameUrl={`${api}/api/jobs/${job.id}/frame`} value={Object.keys(zones).length ? zones : doc.zones_in} onChange={(z) => { setZones(z); setZoneState(""); }} />
              <button onClick={saveZones} className="btn mt-2 bg-amber-500 text-slate-950">{zoneState === "saving" ? "Re-running…" : "Re-run with these zones"}</button>
            </div>
          </details>
        </div>
      )}
    </Section>
  );
}

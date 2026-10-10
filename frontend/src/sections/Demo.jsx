import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2, RotateCcw, Upload } from "lucide-react";
import Section from "./Section.jsx";
import ResultViewer from "../components/ResultViewer.jsx";
import { getApiBase } from "../lib/data.js";

const STAGES = {
  queued: "Waiting in queue",
  upload: "Uploading",
  prepare: "Reading video",
  perception: "Detecting & tracking road users",
  rules: "Finding events",
  risk: "Computing accident risk",
  encode: "Preparing the video for your browser",
  done: "Done",
};

export default function Demo() {
  const [server, setServer] = useState(null);      // null — tekshirilmoqda, false — yo'q, {..} — bor
  const [job, setJob] = useState(null);            // {id, status, stage, progress, message}
  const [upload, setUpload] = useState(0);
  const [doc, setDoc] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const timer = useRef(0);
  const [API_BASE, setApi] = useState(null);
  useEffect(() => { getApiBase().then(setApi); }, []);

  // server holati (HF Space uxlab qolgan bo'lsa — uyg'onishini kutamiz)
  useEffect(() => {
    if (API_BASE === null) return;
    if (API_BASE === "-") { setServer("offline"); return; }   // api.json: server o'chirilgan
    let alive = true, tries = 0;
    const ping = () => fetch(`${API_BASE}/api/health`).then((r) => r.json())
      .then((d) => alive && setServer(d))
      .catch(() => { if (!alive) return; setServer(++tries < 4 ? false : "offline"); if (tries < 40) timer.current = setTimeout(ping, 5000); });
    ping();
    return () => { alive = false; clearTimeout(timer.current); };
  }, [API_BASE]);

  // ish holatini so'rab turish; tayyor bo'lsa natijani yuklash (keshlangan namuna darhol "done" keladi)
  useEffect(() => {
    if (!job?.id) return;
    if (job.status === "error") { setError(job.message || "Processing failed"); return; }
    if (job.status === "done") {
      if (!doc) {
        setVideoUrl(`${API_BASE}/api/demo/${job.id}/video.mp4`);
        fetch(`${API_BASE}/api/demo/${job.id}/result`).then((r) => r.json()).then(setDoc)
          .catch(() => setError("Could not load the result"));
      }
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/demo/${job.id}`);
        setJob(await r.json());
      } catch { /* keyingi urinish */ setJob({ ...job }); }
    }, 1200);
    return () => clearTimeout(t);
  }, [job]);

  const start = (file) => {
    setError(""); setDoc(null); setUpload(0);
    if (!file) return;
    if (server?.max_mb && file.size > server.max_mb * 2 ** 20) { setError(`File is larger than ${server.max_mb} MB`); return; }
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/demo`);
    xhr.upload.onprogress = (e) => e.lengthComputable && setUpload(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) throw new Error(d.detail || xhr.statusText);
        setJob(d);
      } catch (e) { setError(String(e.message || e)); setJob(null); }
    };
    xhr.onerror = () => { setError("Upload failed — is the demo server online?"); setJob(null); };
    setJob({ id: null, status: "upload", stage: "upload", progress: 0 });
    xhr.send(fd);
  };

  const sample = async () => {
    setError(""); setDoc(null);
    if (!server?.has_sample) {   // server yo'q — oldindan hisoblangan natija (xuddi shu pipeline, 40 s klip)
      setJob({ id: "static", status: "static" });
      setVideoUrl("./data/demo_sample/video.mp4");
      fetch("./data/demo_sample/result.json").then((r) => r.json()).then(setDoc).catch(() => setError("Could not load the sample"));
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/api/demo/sample`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || r.statusText);
      setJob(d);
    } catch (e) { setError(String(e.message || e)); }
  };

  const reset = () => { setJob(null); setDoc(null); setError(""); setUpload(0); setVideoUrl(""); };
  const busy = job && !["done", "error", "static"].includes(job.status);
  const pct = job?.stage === "upload" ? upload : job?.progress || 0;

  const download = () => {
    const blob = new Blob([JSON.stringify({ events: doc.events, risk: doc.risk }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "doppix_result.json"; a.click();
  };

  return (
    <Section id="demo" kicker="Live demo" title="Run the pipeline on your own video"
      intro="Upload an MP4 (up to 2 min is processed). The same code as our submission runs on our GPU and returns the annotated video, timeline and risk curve.">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${server === "offline" ? "bg-slate-500" : server ? "bg-emerald-400" : server === false ? "bg-amber-400 animate-pulse" : "bg-slate-500"}`} />
        {server && server !== "offline" ? (
          <span className="text-slate-400">
            Demo server online · {server.device === "cpu" ? "CPU" : "GPU"} · up to {server.max_sec} s of video processed
            {server.device === "cpu" && " (the demo samples ~5 fps on CPU, so it is lighter than the submission)"}
          </span>
        ) : server === "offline" ? (
          <span className="text-slate-400">The upload server is offline right now. You can still open the pre-computed sample clip below.</span>
        ) : server === false ? (
          <span className="text-slate-400">Connecting to the demo server…</span>
        ) : <span className="text-slate-500">Checking demo server…</span>}
      </div>

      {!job && !doc && (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); start(e.dataTransfer.files?.[0]); }}
          className={`card flex flex-col items-center justify-center gap-4 border-dashed p-10 text-center ${drag ? "border-amber-400 bg-amber-500/5" : ""}`}>
          <Upload className="text-amber-400" size={36} />
          <div>
            <p className="font-semibold text-white">Drop an MP4 here</p>
            <p className="mt-1 text-sm text-slate-400">or choose a file. Any resolution; long videos are cut to the first {server?.max_sec || 60} s.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40" disabled={!server || server === "offline"}
              onClick={() => input.current?.click()}>
              <Upload size={16} /> Choose video
            </button>
            <button className="btn border border-slate-600 text-slate-200 hover:bg-slate-800" onClick={sample}>
              <Film size={16} /> Use a sample clip
            </button>
          </div>
          <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => start(e.target.files?.[0])} />
        </div>
      )}

      {busy && (
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-amber-400" />
            <div className="flex-1">
              <div className="font-medium text-white">{STAGES[job.stage] || job.stage}</div>
              <div className="text-sm text-slate-400">
                {job.status === "queued" && job.queue_pos ? `${job.queue_pos} job(s) ahead of you · ` : ""}
                {job.message || ""}
              </div>
            </div>
            <div className="font-mono text-sm text-slate-300">{Math.round(pct * 100)}%</div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.max(2, pct * 100)}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {["perception", "rules", "risk", "encode"].map((s) => (
              <span key={s} className={`chip ${job.stage === s ? "border-amber-400 text-amber-300" : "text-slate-500"}`}>{STAGES[s]}</span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="card mt-4 flex items-center justify-between border-red-800 p-4 text-red-300">
          <span>{error}</span>
          <button className="btn border border-slate-700 text-slate-200" onClick={reset}><RotateCcw size={14} /> Try again</button>
        </div>
      )}

      {doc && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{doc.width}×{doc.height}</span>
            <span className="chip">{doc.fps} fps</span>
            <span className="chip">{doc.duration.toFixed(1)} s processed</span>
            {doc.elapsed && <span className="chip">{doc.elapsed.toFixed(0)} s compute</span>}
            <div className="flex-1" />
            <button className="btn border border-slate-700 text-slate-200 hover:bg-slate-800" onClick={download}><Download size={14} /> JSON</button>
            <button className="btn border border-slate-700 text-slate-200 hover:bg-slate-800" onClick={reset}><RotateCcw size={14} /> New video</button>
          </div>
          {doc.note && <p className="rounded-lg border border-amber-700/60 bg-amber-500/10 p-3 text-sm text-amber-200">{doc.note}</p>}
          <ResultViewer doc={doc} videoUrl={videoUrl} />
        </div>
      )}
    </Section>
  );
}

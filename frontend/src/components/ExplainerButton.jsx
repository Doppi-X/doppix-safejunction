import { useEffect, useState } from "react";
import { Film, X } from "lucide-react";

/** Small "watch the explainer" button; the video opens large in an overlay only when asked for. */
export default function ExplainerButton({ className = "" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)} className={`group flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 text-left hover:bg-white/10 ${className}`}>
        <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md">
          <img src="./data/video/explainer.jpg" alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white group-hover:bg-black/20">▶</span>
        </span>
        <span>
          <span className="flex items-center gap-1 text-sm font-semibold text-white"><Film size={14} className="text-amber-300" /> Watch the 3-min explainer</span>
          <span className="block text-[11px] text-slate-400">The problem, the scheme, the live system, the numbers</span>
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute -top-10 right-0 flex items-center gap-1 text-sm text-slate-200 hover:text-white">
              <X size={18} /> Close
            </button>
            <video src="./data/video/explainer.mp4" poster="./data/video/explainer.jpg" controls autoPlay playsInline className="w-full rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </>
  );
}

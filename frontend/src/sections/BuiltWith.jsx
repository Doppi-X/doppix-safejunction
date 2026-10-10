import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// "Qanday qurdik": o'z-o'zidan suriladigan ixcham lenta; bosilsa — kattalashadi
const ITEMS = [
  ["labeler_events", "Event labeling tool", "Our own app: per-class timeline, 30-second review chunks, pipeline suggestions to accept or reject."],
  ["labeler_scene", "Scene editor", "Carriageway, crosswalks, stop line, traffic light and islands, drawn once and auto-aligned per video."],
  ["labeler_bbox", "Box labeling with YOLO pre-labels", "12,990 boxes on 214 frames; the model pre-labels, a person fixes and confirms."],
  ["labeler_summary", "Progress and export", "Label coverage per video and YOLO/COCO export of confirmed frames only."],
  ["review_sheet", "Reviewing every detection", "tools/review_events.py renders each jaywalking hit with the person, their path and the zones."],
  ["alignment", "Camera-shift alignment", "A shifted video with the scene layout re-aligned by ORB + RANSAC (1–2.5 px error)."],
  ["training_curves", "Detector training", "100 epochs of YOLO26m on our labels; best epoch 89, mAP@50-95 0.885."],
  ["confusion", "Confusion matrix", "Detector validation: the traffic-light classes reach 100 % recall."],
];

export default function BuiltWith() {
  const [open, setOpen] = useState(null);
  const track = useRef(null);
  const hold = useRef(0);          // shu vaqtgacha avto-surish to'xtab turadi (foydalanuvchi o'zi surayotgan bo'lsa)

  // avto-surish: sekin chapga; qo'lda surilsa yoki kursor ustida bo'lsa — to'xtaydi; oxirida boshiga sakraydi (ro'yxat 2 marta)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // pozitsiya kasr sonda alohida saqlanadi: brauzer scrollLeft ni butun pikselga yaxlitlaydi,
    // har kadrdagi ~0.6 px qo'shilish esa yo'qolib ketardi (ayniqsa 125–150 % masshtabli ekranlarda)
    let raf, last = performance.now(), pos = el.scrollLeft;
    const tick = (now) => {
      const dt = Math.min(now - last, 100); last = now;
      if (now > hold.current && open == null) {
        pos += dt * 0.045;
        const half = el.scrollWidth / 2;
        if (half > 0 && pos >= half) pos -= half;
        el.scrollLeft = pos;
      } else {
        pos = el.scrollLeft;                 // qo'lda surilgan joydan davom etadi
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);
  const pause = (ms = 4000) => { hold.current = performance.now() + ms; };
  const step = (dir) => {
    const el = track.current;
    pause(6000);
    el?.scrollBy({ left: dir * 304, behavior: "smooth" });
  };
  useEffect(() => {
    const k = (e) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const card = ([id, t, d], key) => (
    <button key={key} onClick={() => setOpen(ITEMS.findIndex((x) => x[0] === id))}
      className="card group/c w-72 shrink-0 overflow-hidden text-left transition-transform hover:-translate-y-1">
      <img src={`./data/gallery/${id}.jpg`} alt={t} loading="lazy" className="h-40 w-full object-cover object-top" />
      <div className="p-3">
        <div className="text-sm font-semibold text-white">{t}</div>
        <div className="mt-1 line-clamp-2 text-xs text-slate-400">{d}</div>
      </div>
    </button>
  );
  return (
    <section id="built" className="border-y border-white/5 bg-white/[0.015] py-10">
      <div className="mx-auto mb-4 flex max-w-7xl items-baseline justify-between gap-3 px-4">
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-amber-400">Behind the scenes</p>
          <h2 className="font-display text-xl font-bold text-white sm:text-2xl">How we built it</h2>
        </div>
        <span className="hidden text-xs text-slate-500 sm:block">scroll or use the arrows · click to enlarge</span>
      </div>
      <div className="relative">
        <div ref={track}
          onMouseEnter={() => pause(1e12)} onMouseLeave={() => pause(1500)}
          onWheel={() => pause()} onPointerDown={() => pause(1e12)} onPointerUp={() => pause(4000)}
          onTouchStart={() => pause(1e12)} onTouchEnd={() => pause(4000)}
          className="flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,black_5%,black_95%,transparent)] [&::-webkit-scrollbar]:hidden">
          {[...ITEMS, ...ITEMS].map((it, i) => card(it, i))}
        </div>
        {[[-1, ChevronLeft, "left-2"], [1, ChevronRight, "right-2"]].map(([d, Icon, pos]) => (
          <button key={d} onClick={() => step(d)} aria-label={d < 0 ? "Previous" : "Next"}
            className={`absolute top-1/2 ${pos} z-10 -translate-y-1/2 rounded-full border border-white/15 bg-slate-950/80 p-2 text-slate-200 backdrop-blur hover:bg-slate-800`}>
            <Icon size={18} />
          </button>
        ))}
      </div>
      {open != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <figure className="card max-h-full max-w-6xl overflow-auto p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <figcaption>
                <div className="font-semibold text-white">{ITEMS[open][1]}</div>
                <div className="text-sm text-slate-400">{ITEMS[open][2]}</div>
              </figcaption>
              <button onClick={() => setOpen(null)} className="btn border border-white/10 px-2 py-1 text-slate-300"><X size={16} /></button>
            </div>
            <img src={`./data/gallery/${ITEMS[open][0]}.jpg`} alt={ITEMS[open][1]} className="w-full rounded-lg" />
          </figure>
        </div>
      )}
    </section>
  );
}

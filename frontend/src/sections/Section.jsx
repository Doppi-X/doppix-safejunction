export default function Section({ id, title, kicker, children, intro, alt = false }) {
  return (
    <section id={id} className={alt ? "border-y border-white/5 bg-white/[0.015]" : ""}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
        {kicker && <p className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.18em] text-amber-400">{kicker}</p>}
        <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
        {intro && <p className="mt-3 max-w-3xl leading-relaxed text-slate-400">{intro}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

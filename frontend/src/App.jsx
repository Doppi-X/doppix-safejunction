import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Hero from "./sections/Hero.jsx";
import Analyze from "./sections/Analyze.jsx";
import Business from "./sections/Business.jsx";
import Network from "./sections/Network.jsx";
import Jury from "./sections/Jury.jsx";
import Engineering from "./sections/Engineering.jsx";
import Transparency from "./sections/Transparency.jsx";
import Samples from "./sections/Samples.jsx";
import Evaluation from "./sections/Evaluation.jsx";
import EDA from "./sections/EDA.jsx";
import Approach from "./sections/Approach.jsx";
import Team from "./sections/Team.jsx";
import Links from "./sections/Links.jsx";
import BuiltWith from "./sections/BuiltWith.jsx";
import { REPO_URL, TEAM_NAME } from "./team.js";

const NAV = [
  ["jury", "Overview"],
  ["analyze", "Try it"],
  ["network", "City dashboard"],
  ["engineering", "Engineering"],
  ["approach", "How it works"],
  ["evaluation", "Quality"],
  ["business", "Business"],
  ["transparency", "Data & declaration"],
  ["team", "Team"],
];

export default function App() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  useEffect(() => {
    // bo'limlar ma'lumot yuklangach paydo bo'ladi, shuning uchun observer emas — scroll bo'yicha hisoblaymiz
    const onScroll = () => {
      let cur = "";
      for (const [id] of NAV) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.35) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <a href="#top" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex flex-col gap-0.5 rounded-md bg-slate-800 p-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
            {TEAM_NAME}
          </a>
          <nav className="hidden gap-0.5 xl:flex">
            {NAV.map(([id, name]) => (
              <a key={id} href={`#${id}`}
                className={`rounded-md px-2.5 py-1.5 text-sm ${active === id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>
                {name}
              </a>
            ))}
          </nav>
          <button className="xl:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <nav className="border-t border-slate-800 px-4 py-2 xl:hidden">
            {NAV.map(([id, name]) => (
              <a key={id} href={`#${id}`} onClick={() => setOpen(false)} className="block py-2 text-slate-300">{name}</a>
            ))}
          </nav>
        )}
      </header>
      <main id="top">
        <Hero />
        <Jury />
        <Analyze />
        <Network />
        <Engineering />
        <Approach />
        <Evaluation />
        <Business />
        <Samples />
        <EDA />
        <Transparency />
        <BuiltWith />
        <Team />
        <Links />
      </main>
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display font-semibold text-white">{TEAM_NAME}</div>
            <div>WIUT Hackathon 2026 Final · Computer vision for road safety · Startup mode</div>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            {NAV.map(([id, name]) => <a key={id} href={`#${id}`} className="hover:text-white">{name}</a>)}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

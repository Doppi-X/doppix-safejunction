import { Github, Globe, Linkedin } from "lucide-react";
import Section from "./Section.jsx";
import { MEMBERS, REPO_URL, TEAM_NAME } from "../team.js";

export default function Team() {
  return (
    <Section id="team" alt kicker="Team" title={TEAM_NAME}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MEMBERS.map((m) => (
          <div key={m.name} className="card p-5">
            <div className="flex items-center gap-4">
              {m.photo
                ? <img src={m.photo} alt={m.name} className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-2 ring-amber-400/40" />
                : <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl font-bold text-amber-300">
                    {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>}
              <div>
                <div className="font-semibold text-white">{m.name}</div>
                <div className="text-sm text-amber-300">{m.role}</div>
              </div>
            </div>
            {m.about && <p className="mt-3 text-sm text-slate-400">{m.about}</p>}
            <div className="mt-4 flex gap-3 text-slate-400">
              {m.github && <a href={m.github} target="_blank" rel="noreferrer" aria-label="GitHub" className="hover:text-white"><Github size={18} /></a>}
              {m.linkedin && <a href={m.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="hover:text-white"><Linkedin size={18} /></a>}
              {m.portfolio && <a href={m.portfolio} target="_blank" rel="noreferrer" aria-label="Portfolio" className="hover:text-white"><Globe size={18} /></a>}
            </div>
          </div>
        ))}
      </div>
      <div className="card mt-4 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {[["4 / 4", "sample videos labeled by hand, chunk by chunk, following the task's start/end rules"],
          ["12,990", "boxes on 214 frames for the detector, with model pre-labels and human review"],
          ["1 tool", "our own labeling app: event timeline, scene editor, box labeler, export, shared by the team"],
          ["100 epochs", "detector fine-tune on our GPU, then the pipeline checked with the official harness"]].map(([v, t]) => (
          <div key={v}>
            <div className="font-display text-2xl font-bold text-white">{v}</div>
            <div className="mt-1 text-sm text-slate-400">{t}</div>
          </div>
        ))}
      </div>
      {REPO_URL && (
        <p className="mt-6 text-sm text-slate-400">
          Source code: <a href={REPO_URL} className="text-amber-300 hover:underline" target="_blank" rel="noreferrer">{REPO_URL}</a>
        </p>
      )}
    </Section>
  );
}

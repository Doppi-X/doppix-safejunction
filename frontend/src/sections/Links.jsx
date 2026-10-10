import { BookOpen, Box, FileJson, Github, GraduationCap, Tag } from "lucide-react";
import Section from "./Section.jsx";
import { REPO_URL } from "../team.js";

const L = [
  [Github, "Repository", "Source code, README, one-command entry point", REPO_URL],
  [Tag, "Submission tag", "The exact commit that is evaluated", `${REPO_URL}/tree/submission`],
  [Box, "Weights", "weights/detector.pt: YOLO26m fine-tune, 44 MB", `${REPO_URL}/blob/main/weights/detector.pt`],
  [FileJson, "predictions_samples.json", "Our output on the four sample videos (official harness)", `${REPO_URL}/blob/main/predictions_samples.json`],
  [GraduationCap, "Training", "Training script, frame extraction, our labels", `${REPO_URL}/tree/main/training`],
  [BookOpen, "README", "Install, run, approach, datasets, seeds, runtime", `${REPO_URL}#readme`],
];

export default function Links() {
  return (
    <Section id="links" kicker="Links" title="Code, weights and outputs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {L.map(([Icon, t, d, href]) => (
          <a key={t} href={href} target="_blank" rel="noreferrer" className="card flex gap-3 p-4 hover:border-amber-500/60">
            <Icon className="mt-0.5 shrink-0 text-amber-400" size={20} />
            <div><div className="font-semibold text-white">{t}</div><div className="text-sm text-slate-400">{d}</div></div>
          </a>
        ))}
      </div>
    </Section>
  );
}

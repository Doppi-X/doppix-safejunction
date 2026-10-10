import { AlertTriangle, Building2, Camera, CheckCircle2, PlayCircle, Smartphone } from "lucide-react";
import Section from "./Section.jsx";

const CARDS = [
  {
    icon: AlertTriangle, title: "The problem",
    body: "Cities learn which junction is dangerous from crash reports, after someone is hurt. On 18 minutes of one Tashkent junction that we labeled ourselves: 52 pedestrians/h on the roadway outside the zebra, 29/h drivers not yielding, 7/h red-light runs. None of them is in any statistic.",
  },
  {
    icon: Building2, title: "User and payer",
    body: "User: the district traffic engineer who decides where to change signals, markings and crossings. Payer: the city road-safety budget, as a subscription per existing camera ($40/month, an assumption). Second payer: insurers, who already co-fund such studies abroad.",
  },
  {
    icon: Camera, title: "What SafeJunction does",
    body: "Turns the CCTV a city already has into a safety auditor. It finds violations and near misses (post-encroachment time, the measure city safety studies use) and maps where they happen. It ranks every camera and says what to change. Faces and plates are blurred on the server.",
  },
  {
    icon: CheckCircle2, title: "Evidence",
    body: "Our detector reaches mAP50 0.978 on held-out frames. Event rules score 0.83 on our labels. Wrong-way detection: 0 false alarms per hour and 93 % caught. PET finds 7 of 9 labeled failures to yield. Tested on 7 clips from other cities. Every number below is measured, and the weak spots are listed.",
  },
];

export default function Jury() {
  return (
    <Section id="jury" kicker="For the jury · 60 seconds" title="Startup: a road-safety auditor for existing city cameras"
      intro="Mode: Startup (our own customers and revenue). Track: Computer Vision for road safety, a continuation of the elimination traffic-event task.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map(({ icon: I, title, body }) => (
          <div key={title} className="card p-4">
            <I size={20} className="text-amber-300" />
            <h3 className="mt-2 font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{body}</p>
          </div>
        ))}
      </div>
      <div className="card mt-4 grid items-center gap-4 p-4 sm:grid-cols-[auto_1fr]">
        <img src="./data/img/qr.png" alt="QR code to this site" className="mx-auto h-36 w-36 rounded-lg bg-white p-1.5" />
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold text-white"><Smartphone size={17} className="text-amber-300" /> Test it on your phone in 30 seconds</h3>
          <ol className="mt-2 space-y-1.5 text-sm text-slate-300">
            <li><b className="text-white">1.</b> Open <span className="font-mono text-amber-200">giyos1212-safejunction.static.hf.space</span> (the QR code), then <a href="#analyze" className="text-amber-300 underline">Try it</a>.</li>
            <li><b className="text-white">2.</b> Upload any traffic video or photo, or tap <i>Run our 40 s sample clip</i>. Drawing a crossing and stop line while it runs is optional.</li>
            <li><b className="text-white">3.</b> Read the safety report, hotspot map and PDF, then see your camera appear in the <a href="#network" className="text-amber-300 underline">City dashboard</a>.</li>
          </ol>
          <a href="#analyze" className="btn mt-3 bg-amber-500 px-4 py-2 text-slate-950 hover:bg-amber-400"><PlayCircle size={16} /> Start</a>
        </div>
      </div>
    </Section>
  );
}

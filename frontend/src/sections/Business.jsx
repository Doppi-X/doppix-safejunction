import { useState } from "react";
import Section from "./Section.jsx";

// Every number is either MEASURED (our benchmark) or an ASSUMPTION the viewer can change.
const DEFAULTS = {
  price: 40,          // $/camera/month, assumption
  cams: 300,          // cameras after the pilot, assumption (deck scenario)
  camsPerGpu: 4,      // measured: 10 fps pipeline runs at 2x real time on an RTX 3060; 5 fps loses no accuracy (ablation)
  serverCost: 1200,   // $ per GPU server, assumption (RTX 3060 class)
  serverMonths: 36,   // amortisation, assumption
  powerKw: 0.3,       // kW per server under load, assumption
  kwhPrice: 0.08,     // $/kWh, assumption
  team: 3,            // people
  salary: 900,        // $/person/month, assumption
  fixedOther: 300,    // $/month: hosting, domain, tools, assumption
};

const FIELDS = [
  ["price", "Subscription price", "$ / camera / month", "assumption"],
  ["cams", "Cameras connected", "", "assumption"],
  ["camsPerGpu", "Cameras per GPU server", "", "measured"],
  ["serverCost", "GPU server price", "$", "assumption"],
  ["serverMonths", "Server life", "months", "assumption"],
  ["powerKw", "Server power draw", "kW", "assumption"],
  ["kwhPrice", "Electricity", "$ / kWh", "assumption"],
  ["team", "Team", "people", "assumption"],
  ["salary", "Salary", "$ / person / month", "assumption"],
  ["fixedOther", "Other fixed costs", "$ / month", "assumption"],
];

const PILOT = [
  ["Team: 3 people × 3 months", 3 * 3 * 900],
  ["2 GPU servers for 8 cameras (RTX 3060 class)", 2 * 1200],
  ["Labeling 2 weeks of footage per site (our own tool), 3 sites", 1500],
  ["Electricity, hosting, network for 3 months", 400],
  ["Ultralytics licence: AGPL-3.0 (open source) during the pilot", 0],
];

const fmt = (v) => `$${Math.round(v).toLocaleString("en-US")}`;

export default function Business() {
  const [a, setA] = useState(DEFAULTS);
  const servers = Math.ceil(a.cams / a.camsPerGpu);
  const infraPerCam = (a.serverCost / a.serverMonths + a.powerKw * 24 * 30 * a.kwhPrice) / a.camsPerGpu;
  const revenue = a.price * a.cams;
  const infra = infraPerCam * a.cams;
  const fixed = a.team * a.salary + a.fixedOther;
  const profit = revenue - infra - fixed;
  const breakEvenCams = Math.ceil(fixed / Math.max(0.01, a.price - infraPerCam));
  const pilotTotal = PILOT.reduce((s, [, v]) => s + v, 0);
  const payback = profit > 0 ? pilotTotal / profit : null;

  return (
    <Section id="business" kicker="Business" title="Who pays, what it costs, when it pays back"
      intro="Startup mode. City road-safety departments and insurers buy a monthly subscription per existing CCTV camera; no new hardware on the street.">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h3 className="font-semibold text-white">The user and the payer</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            <li><b className="text-white">User:</b> the traffic engineer of a city district, who must decide where to change signals, markings or crossings.</li>
            <li><b className="text-white">Payer:</b> the city road-safety budget (B2G subscription). Second customer: insurers buying per-intersection risk statistics.</li>
            <li><b className="text-white">Today:</b> decisions follow crash reports, after the crash. SafeJunction measures violations and near misses before anyone is hurt.</li>
            <li><b className="text-white">3-month pilot:</b> 8 existing cameras at 3 intersections. Video stays on the city's server, faces and plates are blurred, and only event metadata leaves the server.</li>
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-white">Pilot budget (3 months)</h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {PILOT.map(([k, v]) => <tr key={k} className="border-t border-white/5"><td className="py-1.5 pr-2 text-slate-300">{k}</td><td className="text-right font-mono">{fmt(v)}</td></tr>)}
              <tr className="border-t border-white/10"><td className="py-1.5 font-semibold text-white">Total</td><td className="text-right font-mono font-semibold text-white">{fmt(pilotTotal)}</td></tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">All amounts are assumptions. A commercial closed-source release needs an Ultralytics Enterprise licence or a switch to a permissively licensed detector.</p>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-white">Unit economics</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[["Infra per camera", fmt(infraPerCam) + "/mo"], ["Price per camera", fmt(a.price) + "/mo"],
              ["Gross margin", `${Math.round(100 * (1 - infraPerCam / a.price))}%`], ["Break-even", `${breakEvenCams} cameras`],
              ["Monthly profit", fmt(profit)], ["Pilot payback", payback ? `${payback.toFixed(1)} months` : "not yet"]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 p-2"><div className="font-display text-lg font-bold text-white">{v}</div><div className="text-[11px] text-slate-400">{k}</div></div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{servers} GPU server(s) for {a.cams} cameras. Payback = pilot budget ÷ monthly profit at the chosen scale.</p>
        </div>
      </div>
      <details className="card mt-4 p-4" open>
        <summary className="cursor-pointer font-semibold text-white">Change the assumptions</summary>
        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map(([k, name, unit, kind]) => (
            <label key={k} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-300">{name} {unit && <span className="text-slate-500">({unit})</span>}
                <span className={`ml-1 rounded px-1 text-[10px] ${kind === "measured" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-400"}`}>{kind}</span></span>
              <input type="number" value={a[k]} step="any" min="0"
                onChange={(e) => setA({ ...a, [k]: Math.max(0, Number(e.target.value) || 0) })}
                className="w-24 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-right font-mono text-white" />
            </label>
          ))}
        </div>
      </details>
    </Section>
  );
}

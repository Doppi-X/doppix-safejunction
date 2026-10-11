// Umumiy: ma'lumot yuklash, ranglar, formatlash.

// Demo serveri manzili: build paytida VITE_API_BASE, bo'lmasa ./data/api.json (server ishga tushganda yangilanadi).
// Bo'sh qator — sayt bilan bir xil manzil (lokal ishga tushirish).
let apiPromise = null;
export function getApiBase() {
  if (!apiPromise) {
    const env = import.meta.env.VITE_API_BASE;
    apiPromise = env != null ? Promise.resolve(env.replace(/\/$/, ""))
      : fetch(`./data/api.json?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { api: "" }))
        .then((d) => (d.api ?? "").replace(/\/$/, ""))
        .catch(() => "");
  }
  return apiPromise;
}

// The GPU server's tunnel address can change while a page is open (tunnel restart): re-read api.json.
export function refreshApiBase() {
  apiPromise = null;
  return getApiBase();
}

const cache = new Map();
export function fetchJSON(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }));
  }
  return cache.get(url);
}

export const OBJ_COLORS = {
  person: "#fbbf24",
  bicycle: "#38bdf8",
  car: "#4ade80",
  motorcycle: "#f472b6",
  bus: "#a78bfa",
  truck: "#2dd4bf",
  light_red: "#ef4444",
  light_not_red: "#22c55e",
};

export const EVENT_META = {
  red_light: { color: "#ef4444", name: "Red-light running" },
  stop_line: { color: "#f97316", name: "Stop-line violation" },
  jaywalking: { color: "#eab308", name: "Jaywalking" },
  failure_to_yield: { color: "#ec4899", name: "Failure to yield" },
  stopped_vehicle: { color: "#8b5cf6", name: "Stopped vehicle" },
  congestion: { color: "#3b82f6", name: "Congestion" },
  accident: { color: "#dc2626", name: "Accident" },
  near_miss: { color: "#fb7185", name: "Near miss" },
  conflict: { color: "#e11d48", name: "Serious conflict (PET < 1.5 s)" },
  wrong_way: { color: "#14b8a6", name: "Wrong way" },
  illegal_u_turn: { color: "#06b6d4", name: "Illegal U-turn" },
  illegal_turn: { color: "#0ea5e9", name: "Illegal turn" },
  solid_line_crossing: { color: "#84cc16", name: "Solid-line crossing" },
  road_obstacle: { color: "#a3a3a3", name: "Road obstacle" },
  fire_smoke: { color: "#f59e0b", name: "Fire / smoke" },
};
export const eventColor = (l) => EVENT_META[l]?.color || "#94a3b8";
export const eventName = (l) => EVENT_META[l]?.name || l;

export function fmtTime(t) {
  if (!isFinite(t)) return "–";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

// Hodisa klasslari tartibi (timeline qatorlari)
export function eventClasses(doc) {
  const set = new Set([...(doc.events || []), ...(doc.labels || [])].map((e) => e[2]));
  return Object.keys(EVENT_META).filter((c) => set.has(c));
}

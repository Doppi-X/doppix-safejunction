import { useEffect, useRef, useState } from "react";

// Element kengligini kuzatish (SVG grafiklar uchun)
export function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function useJSON(url, fetcher) {
  const [state, set] = useState({ data: null, error: null });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    set({ data: null, error: null });
    fetcher(url).then((d) => alive && set({ data: d, error: null }), (e) => alive && set({ data: null, error: e }));
    return () => { alive = false; };
  }, [url]);
  return state;
}

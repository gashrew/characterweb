// Phones get the quick-add view; tablets and computers get the map.
// A choice made with the in-app buttons (or ?view=quick / ?view=full) is remembered per device.
export const VIEW_KEY = "characterweb-view";
export type ViewMode = "quick" | "full";

export function initialViewMode(): ViewMode {
  try {
    const param = new URLSearchParams(window.location.search).get("view");
    if (param === "quick" || param === "full") {
      localStorage.setItem(VIEW_KEY, param);
      return param;
    }
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "quick" || saved === "full") return saved;
  } catch { /* storage unavailable */ }
  return Math.min(window.screen.width, window.screen.height) < 600 ? "quick" : "full";
}

export function setViewMode(mode: ViewMode) {
  try { localStorage.setItem(VIEW_KEY, mode); } catch { /* storage unavailable */ }
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  window.location.replace(url.toString());
}

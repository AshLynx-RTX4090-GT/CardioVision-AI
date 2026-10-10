// Single source of truth for risk colour + level, shared by the 3D viewer and the 2D charts
// so a vessel is always the same colour in the artery, the card and the bar.

export const LEVELS = [
  { id: "low", label: "Low", max: 0.33, color: "#17a673" },
  { id: "moderate", label: "Moderate", max: 0.66, color: "#f0a91c" },
  { id: "high", label: "High", max: 1.01, color: "#d8352a" },
];
export const NEUTRAL = "#8a94a3";

export function riskLevel(p) {
  return LEVELS.find((l) => p < l.max) || LEVELS[2];
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

// Colour anchored at the centre of each level band (0.165 / 0.495 / 0.83), blended in between.
const STOPS = [[0.165, hex(LEVELS[0].color)], [0.495, hex(LEVELS[1].color)], [0.83, hex(LEVELS[2].color)]];

export function riskColor(p) {
  if (p == null || Number.isNaN(p)) return NEUTRAL;
  if (p <= STOPS[0][0]) return toHex(STOPS[0][1]);
  if (p >= STOPS[2][0]) return toHex(STOPS[2][1]);
  for (let i = 0; i < 2; i++) {
    const [p0, c0] = STOPS[i], [p1, c1] = STOPS[i + 1];
    if (p <= p1) {
      const t = (p - p0) / (p1 - p0);
      return toHex(c0.map((v, k) => v + (c1[k] - v) * t));
    }
  }
  return NEUTRAL;
}

export const pct = (p, d = 1) => (p * 100).toFixed(d) + "%";

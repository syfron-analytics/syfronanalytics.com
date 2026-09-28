// Clean geometry of the Syfron mark (public/logo.svg): three overlapping pointy-top
// hexagons around a small filled hexagon with a "Y" (a cube seen from a corner).
// Units are arbitrary; the mark is centred on (0, 0).

export const LOGO_R = 40;
export const CORE_R = 14.3;
export const LOGO_VIEWBOX = { x: -54, y: -62, w: 108, h: 114 };

const HALF_APOTHEM = (LOGO_R * Math.sqrt(3)) / 4;

/** Centres of the three outer hexagons (top, bottom-left, bottom-right), R/2 from the middle. */
export const LOGO_HEXES: [number, number][] = [
  [0, -LOGO_R / 2],
  [-HALF_APOTHEM, LOGO_R / 4],
  [HALF_APOTHEM, LOGO_R / 4],
];

/** Vertices of a pointy-top hexagon, clockwise from the top vertex. */
export function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

export function hexPolygon(cx: number, cy: number, r: number) {
  return hexPoints(cx, cy, r)
    .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .join(' ');
}

/**
 * Points spread evenly along the outline of the mark: `perHex` on each outer
 * hexagon (a multiple of 6 keeps every vertex) plus the 6 vertices of the core.
 */
export function logoOutlinePoints(perHex: number) {
  const points: { x: number; y: number }[] = [];
  for (const [cx, cy] of LOGO_HEXES) {
    const v = hexPoints(cx, cy, LOGO_R);
    for (let k = 0; k < perHex; k++) {
      const pos = (k / perHex) * 6;
      const edge = Math.floor(pos);
      const t = pos - edge;
      const a = v[edge];
      const b = v[(edge + 1) % 6];
      points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  points.push(...hexPoints(0, 0, CORE_R));
  return points;
}

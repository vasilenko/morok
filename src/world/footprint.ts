/**
 * Collision of a small circle on the ground (the hero's feet) with the
 * footprints of solid scenery. A footprint is an axis-aligned ellipse, the
 * patch of ground an object stands on; the circle is pushed out of it along
 * the shortest way, which takes away only the part of a step that heads
 * into the obstacle, so the hero slides along its edge instead of sticking.
 */

/** An axis-aligned ellipse on the ground, in world units. */
export interface Ellipse {
  /** Centre. */
  x: number;
  y: number;
  /** Half-width and half-height. */
  rx: number;
  ry: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Slack for rounding, so a circle resting on an edge counts as clear. */
const EPSILON = 1e-6;

/**
 * The point of the ellipse's outline nearest to (x, y), from inside or
 * outside. Solved in the first quadrant and mirrored back: each step
 * treats the outline near the current guess as an arc around its centre of
 * curvature and moves the guess to where the point projects onto that arc.
 * It converges fast enough that three steps land well below a pixel.
 */
export function closestOnEllipse(e: Ellipse, x: number, y: number): Point {
  const px = Math.abs(x - e.x);
  const py = Math.abs(y - e.y);
  const a = e.rx;
  const b = e.ry;
  let tx = Math.SQRT1_2;
  let ty = Math.SQRT1_2;
  for (let i = 0; i < 3; i++) {
    // Centre of curvature of the outline at the current guess.
    const ex = ((a * a - b * b) * tx ** 3) / a;
    const ey = ((b * b - a * a) * ty ** 3) / b;
    const r = Math.hypot(a * tx - ex, b * ty - ey);
    const q = Math.hypot(px - ex, py - ey);
    // At the centre of a circle every direction is as near; keep the guess.
    if (q === 0) break;
    tx = Math.min(1, Math.max(0, (((px - ex) * r) / q + ex) / a));
    ty = Math.min(1, Math.max(0, (((py - ey) * r) / q + ey) / b));
    const t = Math.hypot(tx, ty);
    tx /= t;
    ty /= t;
  }
  return { x: e.x + Math.sign(x - e.x || 1) * a * tx, y: e.y + Math.sign(y - e.y || 1) * b * ty };
}

/**
 * Where a circle of the given radius centred at (x, y) has to be so that it
 * no longer overlaps the ellipse: unchanged when it is clear, otherwise
 * moved along the outline's normal to exactly `radius` from it.
 */
export function pushOut(x: number, y: number, radius: number, e: Ellipse): Point {
  const dx = (x - e.x) / e.rx;
  const dy = (y - e.y) / e.ry;
  const inside = dx * dx + dy * dy < 1;
  const edge = closestOnEllipse(e, x, y);
  if (!inside && Math.hypot(x - edge.x, y - edge.y) >= radius - EPSILON) return { x, y };

  // The outward normal at the nearest point of the outline.
  const nx = (edge.x - e.x) / (e.rx * e.rx);
  const ny = (edge.y - e.y) / (e.ry * e.ry);
  const n = Math.hypot(nx, ny);
  return { x: edge.x + (nx / n) * radius, y: edge.y + (ny / n) * radius };
}

/**
 * The circle pushed out of every ellipse in turn. Solid scenery is spread
 * far enough apart that the circle never touches two footprints at once, so
 * one pass settles it.
 */
export function pushOutAll(x: number, y: number, radius: number, footprints: readonly Ellipse[]): Point {
  let point = { x, y };
  for (const e of footprints) point = pushOut(point.x, point.y, radius, e);
  return point;
}

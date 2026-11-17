import type { BellConfig, ItemLadders } from '../config';

/**
 * The funeral bell as pure logic: a toll sends a ring out along the ground
 * from where the hero stood, and its front wounds each enemy once as it
 * passes. The ring lies on the ground, so seen from above at three-quarters
 * it is an ellipse, `flatten` times as tall as it is wide (CFG.ground), in
 * what it reaches as in how it is drawn. It never seeks anyone: it reaches
 * whoever stands in its way.
 */
export type BellStats = ItemLadders['bell'][number];

export interface Ring {
  /** The ground point it spreads from: the hero's feet when the bell tolled. It stays there. */
  x: number;
  y: number;
  /** Seconds since the toll. */
  age: number;
  /** How far it runs. */
  radius: number;
}

/** The part of the ground the front swept in one step: from `from` (exclusive) to `to`. */
export interface Sweep {
  from: number;
  to: number;
}

export function newRing(x: number, y: number, radius: number): Ring {
  return { x, y, age: 0, radius };
}

/**
 * How far the front has run `age` seconds after the toll: fast as it
 * leaves and slowing as it nears its radius, which it reaches at
 * `cfg.spread` and never passes.
 */
export function ringFront(age: number, radius: number, cfg: BellConfig): number {
  const t = Math.min(1, Math.max(0, age / cfg.spread));
  return radius * (1 - (1 - t) * (1 - t));
}

/** Whether the ring has run out and faded, and can be forgotten. */
export function ringDone(ring: Ring, cfg: BellConfig): boolean {
  return ring.age >= cfg.spread + cfg.linger;
}

/**
 * Ages the ring by `dt` and returns what its front swept in that step, or
 * null once it has stopped at its radius.
 */
export function stepRing(ring: Ring, dt: number, cfg: BellConfig): Sweep | null {
  if (ring.age >= cfg.spread) {
    ring.age += dt;
    return null;
  }
  const from = ringFront(ring.age, ring.radius, cfg);
  ring.age += dt;
  return { from, to: ringFront(ring.age, ring.radius, cfg) };
}

/**
 * How far a ground point (dx, dy) from the ring's centre is, measured on
 * the ground: on the flattened ellipse through it, the radius it has across.
 */
export function groundDistance(dx: number, dy: number, flatten: number): number {
  return Math.hypot(dx, dy / flatten);
}

/**
 * Whether the front passed a point `distance` from the centre in `sweep`:
 * it reached it, and the point was not already well inside where the front
 * had been (see cfg.slack). The caller wounds each enemy at most once a toll.
 */
export function swept(distance: number, sweep: Sweep, cfg: BellConfig): boolean {
  return distance <= sweep.to && distance > sweep.from - cfg.slack;
}

/** Width of the ring's band when its front has run `progress` of the way out (0..1 of its radius). */
export function bandWidth(progress: number, cfg: BellConfig): number {
  const [start, end] = cfg.band;
  return start + (end - start) * Math.min(1, Math.max(0, progress));
}

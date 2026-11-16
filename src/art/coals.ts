import { CFG } from '../config';

/**
 * The look of a spark, as pure logic: a small coal glowing just above the
 * ground, which grows a pair of pale wings when the skull draws it in.
 * textures.ts paints the coal and the wing from the light and cover this
 * returns; Sparks.ts makes them live.
 */

/** A colour as linear RGB, each channel 0..1. */
export type Rgb = readonly [number, number, number];

/**
 * The colour each grade of spark glows with (see CFG.spark.grades), as
 * heat: dull red, orange, pale yellow-white and blue-white. The grades are
 * told apart by colour alone; every coal is the same size.
 */
export const GRADE_COLORS: readonly Rgb[] = [
  [0.95, 0.2, 0.08],
  [1.0, 0.55, 0.12],
  [1.0, 0.86, 0.5],
  [0.62, 0.86, 1.0],
];

/** The colour `color` taken `share` (0..1) of the way to white and scaled by `scale`, as a hex number. */
export function colorHex(color: Rgb, share = 0, scale = 1): number {
  const channel = (c: number) => Math.round(255 * Math.min(1, scale * (c + (1 - c) * share)));
  return (channel(color[0]) << 16) | (channel(color[1]) << 8) | channel(color[2]);
}

/**
 * The colour `t` (0..1) of the way along `stops`, hex colours spread evenly
 * from 0 to 1: mixed channel by channel between the two stops either side
 * of it, the way Phaser's particles fade through a list of colours.
 */
export function colorAlong(stops: readonly number[], t: number): number {
  const last = stops.length - 1;
  const at = Math.min(1, Math.max(0, t)) * last;
  const i = Math.min(Math.floor(at), Math.max(0, last - 1));
  const [from, to] = [stops[i], stops[Math.min(i + 1, last)]];
  const share = at - i;
  const channel = (shift: number) => {
    const [a, b] = [(from >> shift) & 0xff, (to >> shift) & 0xff];
    return Math.round(a + (b - a) * share) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

/**
 * The coal's shape, in world units: a hot pale core in a halo of its
 * colour, with a faint smudge of that light on the soil below it, which
 * lies CFG.spark.hover below its heart. The core is its colour taken
 * `pale` of the way to white.
 */
export const COAL = {
  core: 1.1,
  pale: 0.75,
  /** The halo: a bright inner glow and a wide faint haze, each a Gaussian of this radius and strength. */
  glow: { radius: 1.9, strength: 0.85 },
  haze: { radius: 4.2, strength: 0.28 },
  /** The light on the soil: an ellipse of these radii. */
  pool: { rx: 4.5, ry: 1.4, strength: 0.32 },
  /** The texture frame, in world units round the heart: it holds every bit of light above a trace. */
  frame: { left: -9, top: -9, width: 18, height: 18 },
} as const;

/**
 * The light the coal of colour `color` gives at (x, y) world units from
 * its heart (y down), as additive RGB: what it adds over black. Off the
 * ground (`grounded` false) there is no light on the soil.
 */
export function coalLight(x: number, y: number, color: Rgb, grounded: boolean): [number, number, number] {
  const r = Math.hypot(x, y);
  const core = 1 - smoothstep(0.45 * COAL.core, COAL.core, r);
  const halo =
    COAL.glow.strength * Math.exp(-((r / COAL.glow.radius) ** 2)) +
    COAL.haze.strength * Math.exp(-((r / COAL.haze.radius) ** 2));
  const pool = COAL.pool;
  const soil = !grounded ? 0 : pool.strength * Math.exp(-((x / pool.rx) ** 2) - ((y - CFG.spark.hover) / pool.ry) ** 2);
  return [0, 1, 2].map((i) => {
    const pale = color[i] + (1 - color[i]) * COAL.pale;
    return core * pale + (1 - core) * (halo + soil) * color[i];
  }) as [number, number, number];
}

/**
 * How bright a coal smoulders at `time` seconds, given its `phase`: a slow,
 * uneven breathing between `low` and 1, made of three slow waves with no
 * common period, so it never settles into a beat, never goes out and never
 * flashes.
 */
export function smoulder(time: number, phase: number, low: number): number {
  const wave =
    0.5 * Math.sin(time * 1.9 + phase) +
    0.3 * Math.sin(time * 3.1 + phase * 2.3) +
    0.2 * Math.sin(time * 4.7 + phase * 3.7);
  return low + (1 - low) * (0.5 + 0.5 * wave);
}

/**
 * A wing, in world units: a soft, translucent membrane growing from the
 * coal at its root, `length` long and `width` across at the widest. Its
 * leading edge runs along the top, nearly straight and brighter than the
 * rest, with `lead` of the width above the root; the rest of the membrane
 * hangs below it and rounds off to the tip. It is drawn white; the sprite
 * tints it.
 */
export const WING = {
  length: 7.5,
  width: 3.2,
  lead: 0.3,
  /** Opacity of the membrane, and of its leading edge. */
  membrane: 0.42,
  edge: 0.9,
  /** How far the leading edge's brightness reaches into the membrane. */
  edgeWidth: 0.5,
  /** Width of the soft rim it fades out over. */
  soft: 0.45,
  /** The texture frame, in world units round the root: it holds the whole wing. */
  frame: { left: -1, top: -2, width: 9, height: 5 },
} as const;

/**
 * How opaque the wing is at (x, y) world units from its root, x along it
 * and y across, down from the leading edge's side.
 */
export function wingCover(x: number, y: number): number {
  const t = x / WING.length;
  if (t <= 0 || t >= 1) return 0;
  const above = WING.lead * WING.width * Math.sqrt(Math.sin(Math.PI * t)) * (1 - 0.3 * t);
  const below = (1 - WING.lead) * WING.width * Math.sin(Math.PI * t ** 0.75) ** 0.8;
  const inside = Math.min(y + above, below - y);
  if (inside <= 0) return 0;
  const edge = Math.exp(-(((y + above) / WING.edgeWidth) ** 2));
  const membrane = WING.membrane * (1 - 0.3 * t);
  return smoothstep(0, WING.soft, inside) * (membrane + (WING.edge - membrane) * edge);
}

/**
 * How far a spark's wings have unfurled (0..1), `flight` seconds after it
 * was drawn in, if they take `duration` seconds: eased in and out.
 */
export function unfurl(flight: number, duration: number): number {
  return duration > 0 ? smoothstep(0, duration, flight) : 1;
}

/**
 * Whether a coal of the given `phase` (0..2π, uniform per spark) shows a
 * single wing while it lies on the ground. It is decided by the phase,
 * which is fixed at the drop, so a coal keeps it or goes without for good;
 * about `share` of them have it, unrelated to how their phase looks.
 */
export function restingWing(phase: number, share: number): boolean {
  return ((phase / (Math.PI * 2)) * 97) % 1 < share;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

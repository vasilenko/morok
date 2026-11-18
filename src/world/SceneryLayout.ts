import { ART_SCALE } from '../art/scale';
import atlas from '../art/sprites/scenery.json';
import type { Ellipse, Point } from './footprint';

/**
 * Where the scenery stands on the endless plane. The plane is cut into
 * square cells and each cell holds at most one item, chosen and placed by
 * a hash of the cell and the run's seed. Nothing is stored, so any part of
 * the world can be rebuilt at any time and always looks the same within a
 * run, and items kept inside their own cell can never overlap.
 */

/** A frame of the scenery atlas. */
export type SceneryName = keyof typeof atlas.frames;

export interface SceneryKind {
  name: SceneryName;
  /** Size in world units. */
  width: number;
  height: number;
  /** Relative chance of being picked for an occupied cell. */
  weight: number;
  /** Lies on the ground (a puddle) rather than standing up from it. */
  flat: boolean;
  /** The ground it stands on, which the hero cannot enter; null when he walks over it. */
  footprint: Footprint | null;
}

/**
 * An ellipse on the ground under a solid item, relative to the centre of
 * its base, in world units. It covers where the object meets the ground,
 * not its whole image, so the hero can pass behind the top of a tall stone.
 */
export interface Footprint {
  /** Offset of the centre from the centre of the base; negative is up the screen. */
  dx: number;
  dy: number;
  /** Half-width and half-height. */
  rx: number;
  ry: number;
}

/** One placed item. The position is the centre of its base, the bottom edge of the image. */
export interface SceneryItem {
  kind: SceneryKind;
  x: number;
  y: number;
}

/** Side of a cell, in world units; large enough for the pond and its margins. */
export const SCENERY_CELL = 256;
/**
 * Chance that a cell holds an item. A 914x514 view spans about seven
 * cells, so it shows three or four items whole and four or five in part.
 */
export const SCENERY_CHANCE = 0.5;
/** Every item keeps this far inside its cell, so neighbours stay apart. */
export const SCENERY_MARGIN = 16;
/** Nothing comes this close to the origin, where the hero starts. */
export const START_CLEAR_RADIUS = 120;

/**
 * Standing props and puddles carry the same total weight, so they turn up
 * in similar numbers; the pond is the rare one.
 */
const WEIGHTS: Record<SceneryName, { weight: number; flat: boolean }> = {
  'sign-stone': { weight: 9, flat: false },
  'tally-stone': { weight: 9, flat: false },
  mound: { weight: 5, flat: false },
  'fire-pit': { weight: 6, flat: false },
  bones: { weight: 9, flat: false },
  'grave-pole': { weight: 6, flat: false },
  'puddle-round': { weight: 10, flat: true },
  'puddle-long': { weight: 9, flat: true },
  'puddle-double': { weight: 9, flat: true },
  'pool-reeds': { weight: 7, flat: true },
  'pool-bone': { weight: 7, flat: true },
  pond: { weight: 2, flat: true },
};

/**
 * Footprints of the solid kinds, measured on the art: the base of each
 * stone above the grass drawn in front of it, the mound's earth below its
 * crest, the fire pit's ring of stones, the foot of the pole. Bones and
 * water lie flat and are walked over.
 */
const FOOTPRINTS: Partial<Record<SceneryName, Footprint>> = {
  'sign-stone': { dx: 1.5, dy: -10, rx: 22, ry: 7 },
  'tally-stone': { dx: 0, dy: -9, rx: 15, ry: 6 },
  mound: { dx: 0, dy: -22, rx: 54, ry: 17 },
  'fire-pit': { dx: 0, dy: -19, rx: 35, ry: 16 },
  'grave-pole': { dx: 1.5, dy: -8, rx: 7, ry: 4 },
};

/** Every scenery frame with its world size, read from the atlas the sprite build writes. */
export const SCENERY_KINDS: readonly SceneryKind[] = Object.entries(atlas.frames).map(([name, { frame }]) => ({
  name: name as SceneryName,
  width: frame.w / ART_SCALE,
  height: frame.h / ART_SCALE,
  ...WEIGHTS[name as SceneryName],
  footprint: FOOTPRINTS[name as SceneryName] ?? null,
}));

/** The item in the given cell for this seed, or null when the cell is empty. */
export function sceneryInCell(
  cellX: number,
  cellY: number,
  seed: number,
  kinds: readonly SceneryKind[] = SCENERY_KINDS,
): SceneryItem | null {
  const random = generator(hashCell(cellX, cellY, seed));
  if (random() >= SCENERY_CHANCE) return null;

  const kind = pick(kinds, random());
  const left = cellX * SCENERY_CELL + SCENERY_MARGIN + random() * (SCENERY_CELL - 2 * SCENERY_MARGIN - kind.width);
  const top = cellY * SCENERY_CELL + SCENERY_MARGIN + random() * (SCENERY_CELL - 2 * SCENERY_MARGIN - kind.height);
  const item = { kind, x: left + kind.width / 2, y: top + kind.height };
  return nearStart(item) ? null : item;
}

/** The ground the item stands on, in world coordinates, or null when it can be walked over. */
export function footprintOf({ kind, x, y }: SceneryItem): Ellipse | null {
  const f = kind.footprint;
  return f && { x: x + f.dx, y: y + f.dy, rx: f.rx, ry: f.ry };
}

/**
 * Footprints of the items in every cell that touches the given world
 * rectangle. An item never leaves its cell, so this holds every footprint
 * that reaches into the rectangle.
 */
export function footprintsIn(left: number, top: number, width: number, height: number, seed: number): Ellipse[] {
  const footprints: Ellipse[] = [];
  for (let cx = Math.floor(left / SCENERY_CELL); cx <= Math.floor((left + width) / SCENERY_CELL); cx++) {
    for (let cy = Math.floor(top / SCENERY_CELL); cy <= Math.floor((top + height) / SCENERY_CELL); cy++) {
      const item = sceneryInCell(cx, cy, seed);
      const footprint = item && footprintOf(item);
      if (footprint) footprints.push(footprint);
    }
  }
  return footprints;
}

/** The middle of a puddle or pond: the centre of its image, which lies flat on the ground. */
export function waterMiddle({ kind, x, y }: SceneryItem): Point {
  return { x, y: y - kind.height / 2 };
}

/**
 * The middles of the puddles and ponds (the flat scenery) that lie between
 * `near` and `far` from the point (x, y), in the cells within `far` of it.
 */
export function watersAround(x: number, y: number, near: number, far: number, seed: number): Point[] {
  const waters: Point[] = [];
  for (let cx = Math.floor((x - far) / SCENERY_CELL); cx <= Math.floor((x + far) / SCENERY_CELL); cx++) {
    for (let cy = Math.floor((y - far) / SCENERY_CELL); cy <= Math.floor((y + far) / SCENERY_CELL); cy++) {
      const item = sceneryInCell(cx, cy, seed);
      if (!item?.kind.flat) continue;
      const middle = waterMiddle(item);
      const distance = Math.hypot(middle.x - x, middle.y - y);
      if (distance >= near && distance <= far) waters.push(middle);
    }
  }
  return waters;
}

/** A fresh seed for a run. */
export function randomScenerySeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** The kind at `roll` (0..1) along the cumulative weights. */
function pick(kinds: readonly SceneryKind[], roll: number): SceneryKind {
  const total = kinds.reduce((sum, kind) => sum + kind.weight, 0);
  let left = roll * total;
  for (const kind of kinds) {
    left -= kind.weight;
    if (left < 0) return kind;
  }
  return kinds[kinds.length - 1];
}

/** Whether any part of the item is within START_CLEAR_RADIUS of the origin. */
function nearStart({ kind, x, y }: SceneryItem): boolean {
  const dx = Math.max(x - kind.width / 2, 0, -(x + kind.width / 2));
  const dy = Math.max(y - kind.height, 0, -y);
  return dx * dx + dy * dy < START_CLEAR_RADIUS * START_CLEAR_RADIUS;
}

/** A 32-bit hash of a cell and the seed, well mixed in every bit. */
function hashCell(cellX: number, cellY: number, seed: number): number {
  let h = Math.imul(cellX, 0x27d4eb2d) ^ Math.imul(cellY, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Mulberry32: a small, fast generator of numbers in [0, 1) from a 32-bit state. */
function generator(state: number): () => number {
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

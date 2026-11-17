import type { ItemLadders, TeethConfig } from '../config';

/**
 * The wolf teeth as pure logic: fangs evenly spaced on a circle round the
 * hero, turning together. The circle lies on the ground, so seen from above
 * at three-quarters it is an ellipse, `flatten` times as tall as it is wide.
 */
export type TeethStats = ItemLadders['teeth'][number];

export interface Fang {
  /** Its place on the circle, in radians ahead of the turn of the whole. */
  slot: number;
  /** How far it has grown out from the hero since it was gained, 0..1. */
  grow: number;
}

export interface Teeth {
  /** How far the circle has turned, in radians. */
  turn: number;
  /** The circle's radius, easing towards the level's. */
  radius: number;
  fangs: Fang[];
}

/** Where a fang is: its point on the ground, and the way it travels on screen. */
export interface FangPlace {
  x: number;
  y: number;
  /** The direction it travels in, as seen on screen, in radians. */
  heading: number;
}

const TAU = Math.PI * 2;

export function newTeeth(): Teeth {
  return { turn: 0, radius: 0, fangs: [] };
}

/**
 * Turns the circle by `dt` seconds and lets every fang settle towards the
 * level's numbers: a fang gained grows out from the hero in its new place,
 * the others ease round to space themselves evenly, and the circle eases to
 * its new radius, none of it in a jump.
 */
export function stepTeeth(teeth: Teeth, stats: TeethStats, dt: number, cfg: TeethConfig): void {
  teeth.turn = (teeth.turn + (TAU / stats.period) * dt) % TAU;
  const ease = 1 - Math.exp(-cfg.settle * dt);
  // The first fangs grow out with the circle itself.
  if (teeth.fangs.length === 0) teeth.radius = stats.radius;
  else teeth.radius += (stats.radius - teeth.radius) * ease;

  const count = stats.count;
  while (teeth.fangs.length < count) teeth.fangs.push({ slot: (teeth.fangs.length * TAU) / count, grow: 0 });
  teeth.fangs.length = count;
  teeth.fangs.forEach((fang, i) => {
    fang.slot += angleBetween(fang.slot, (i * TAU) / count) * ease;
    fang.grow += (1 - fang.grow) * ease;
  });
}

/**
 * Where `fang` is round a hero whose feet stand on the ground point
 * (heroX, heroY). It travels clockwise on screen.
 */
export function placeFang(teeth: Teeth, fang: Fang, heroX: number, heroY: number, cfg: TeethConfig): FangPlace {
  const angle = teeth.turn + fang.slot;
  const reach = teeth.radius * fang.grow;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: heroX + reach * cos,
    y: heroY + reach * cfg.flatten * sin,
    heading: Math.atan2(cfg.flatten * cos, -sin),
  };
}

/** Whether an enemy last wounded by the teeth at `last` (or never, if undefined) can be wounded at `now`. */
export function canBite(last: number | undefined, now: number, cfg: TeethConfig): boolean {
  return last === undefined || now - last >= cfg.rehit;
}

/** The signed angle from `from` to `to` the short way round, in -PI..PI. */
function angleBetween(from: number, to: number): number {
  const d = (((to - from) % TAU) + TAU) % TAU;
  return d > Math.PI ? d - TAU : d;
}

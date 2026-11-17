import type { BookConfig, ItemLadders } from '../config';

/**
 * The black book as pure logic: it picks where to cut its signs, and each
 * sign, lying where it was cut, strikes once after its delay at whoever
 * stands on it then. A sign lies on the ground, so seen from above at
 * three-quarters it is an ellipse, `flatten` times as tall as it is wide
 * (CFG.ground), in what it strikes as in how it is drawn. It never moves
 * after anyone: an enemy that walks off before the strike is missed.
 */
export type BookStats = ItemLadders['book'][number];

/** A ground point a sign can be cut under: an enemy's feet. */
export interface Place {
  x: number;
  y: number;
}

export interface Sign {
  /** Its middle, on the ground. */
  x: number;
  y: number;
  /** Seconds since it was cut. */
  age: number;
  /** When it strikes, in seconds after it was cut. */
  delay: number;
  radius: number;
  /** Which of the drawings it is. */
  drawing: number;
  struck: boolean;
}

/** How a sign shines at a moment of its life, each 0..1. */
export interface SignLight {
  /** How far its light has grown towards the strike: faint when cut, full just before. */
  grow: number;
  /** The surge at the strike: 1 at that moment, dying down to 0 soon after. */
  surge: number;
  /** What is left of it as it fades out after the strike: 1 until then. */
  fade: number;
}

/**
 * Up to `count` of `places`, each a different one, picked at random with
 * `random` (0..1, uniform) among those within `cfg.reach` of the hero's
 * feet (heroX, heroY); fewer when fewer are in reach, none when none is.
 */
export function pickPlaces<T extends Place>(
  places: readonly T[],
  heroX: number,
  heroY: number,
  count: number,
  cfg: BookConfig,
  random: () => number,
): T[] {
  const reach = cfg.reach * cfg.reach;
  const pool = places.filter((p) => (p.x - heroX) ** 2 + (p.y - heroY) ** 2 <= reach);
  // A partial Fisher-Yates shuffle: the first `take` places are a uniform draw.
  const take = Math.min(count, pool.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.min(pool.length - i - 1, Math.floor(random() * (pool.length - i)));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}

export function newSign(place: Place, stats: BookStats, drawing: number): Sign {
  return { x: place.x, y: place.y, age: 0, delay: stats.delay, radius: stats.radius, drawing, struck: false };
}

/** Ages the sign by `dt`. Returns true on the step it strikes, which comes once, `delay` after it was cut. */
export function stepSign(sign: Sign, dt: number): boolean {
  sign.age += dt;
  if (sign.struck || sign.age < sign.delay) return false;
  sign.struck = true;
  return true;
}

/** Whether the sign has struck and faded out, and can be forgotten. */
export function signDone(sign: Sign, cfg: BookConfig): boolean {
  return sign.struck && sign.age >= sign.delay + cfg.fade;
}

/**
 * Whether a ground point (dx, dy) from a sign's middle is within its
 * strike: inside the ellipse of `radius` across, flattened by `flatten`.
 */
export function inStrike(dx: number, dy: number, radius: number, flatten: number): boolean {
  return dx * dx + (dy / flatten) ** 2 <= radius * radius;
}

/**
 * How the sign shines `age` seconds after it was cut: its light grows from
 * `cfg.faint` to full over its delay, faster towards the end, so the eye
 * can tell when it will strike; at the strike it surges, then fades out.
 */
export function signLight(age: number, delay: number, cfg: BookConfig): SignLight {
  const toward = Math.min(1, Math.max(0, age / delay));
  const after = Math.max(0, age - delay);
  return {
    grow: cfg.faint + (1 - cfg.faint) * toward * toward,
    surge: age < delay ? 0 : Math.max(0, 1 - after / cfg.surge),
    fade: Math.max(0, 1 - after / cfg.fade),
  };
}

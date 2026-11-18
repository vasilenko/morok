import type { Point } from '../world/footprint';

/**
 * Which water an utopets rises out of, as pure logic. A water he rises out
 * of is taken while he rises and for a while after he has stood and begun
 * to walk off, so the next one due comes up out of another, or, with none
 * free, walks in from beyond the edge of the view like any other enemy.
 * Waters are told apart by their middles: a puddle or a pond is one piece
 * of water, and raises one utopets at a time, whatever its size.
 */
export interface RisingClaim {
  /** The middle of the water. */
  x: number;
  y: number;
  /** Time (seconds into the run) at which the water is free again. */
  until: number;
}

export interface RisingRules {
  /** Seconds he takes to rise. */
  rise: number;
  /** Seconds the water stays taken after he has stood. */
  hold: number;
}

/** Forgets the claims that have run out by `now`. */
export function pruneClaims(claims: RisingClaim[], now: number): void {
  let kept = 0;
  for (const claim of claims) if (claim.until > now) claims[kept++] = claim;
  claims.length = kept;
}

/** The waters not taken at `now`. */
export function freeWaters(waters: readonly Point[], claims: readonly RisingClaim[], now: number): Point[] {
  return waters.filter((water) => !claims.some((c) => c.until > now && c.x === water.x && c.y === water.y));
}

/**
 * The water an utopets due now rises out of: one of the free `waters`,
 * picked by `roll` (uniform in [0, 1)), or null when none is free and he
 * walks in instead.
 */
export function pickWater(waters: readonly Point[], claims: RisingClaim[], now: number, roll: number): Point | null {
  pruneClaims(claims, now);
  const free = freeWaters(waters, claims, now);
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(roll * free.length))];
}

/** Takes `water` from `now` until he has risen out of it and walked off for `hold` seconds. */
export function claimWater(claims: RisingClaim[], water: Point, now: number, rules: RisingRules): void {
  claims.push({ x: water.x, y: water.y, until: now + rules.rise + rules.hold });
}

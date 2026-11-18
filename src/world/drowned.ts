import type { DrownedConfig } from '../config';

/**
 * Drowned water, as pure logic: the puddles the utoptsy leave, how big
 * each is over its life, and whether a point on the ground is in one. A
 * puddle spreads, stays, then dries away, shrinking to nothing; at most
 * `cap` are wet at once, and leaving one more makes the oldest wet one
 * start to dry at once.
 */
export interface DrownedPool {
  /** Middle, on the ground. */
  x: number;
  y: number;
  /** Seconds since it was left. */
  age: number;
  /** Age at which it starts to dry: `last`, or earlier when it made room for a newer one. */
  dryAt: number;
}

/** Leaves a puddle at (x, y), making the oldest wet one start to dry if there are `cap` already. */
export function addPool(pools: DrownedPool[], x: number, y: number, cfg: DrownedConfig): void {
  const wet = pools.filter((pool) => pool.age < pool.dryAt);
  if (wet.length >= cfg.cap) {
    const oldest = wet.reduce((a, b) => (b.age > a.age ? b : a));
    oldest.dryAt = oldest.age;
  }
  pools.push({ x, y, age: 0, dryAt: cfg.last });
}

/** Ages every puddle by `dt` seconds and drops those that have dried away. */
export function agePools(pools: DrownedPool[], dt: number, cfg: DrownedConfig): void {
  let kept = 0;
  for (const pool of pools) {
    pool.age += dt;
    if (pool.age < pool.dryAt + cfg.dry) pools[kept++] = pool;
  }
  pools.length = kept;
}

/**
 * How big the puddle is now, as a share of its full size: easing out from
 * nothing as it spreads, whole while it stays, and shrinking evenly to
 * nothing as it dries.
 */
export function poolSize(pool: DrownedPool, cfg: DrownedConfig): number {
  if (pool.age >= pool.dryAt) return Math.max(0, 1 - (pool.age - pool.dryAt) / cfg.dry);
  if (pool.age < cfg.spread) {
    const t = pool.age / cfg.spread;
    return 1 - (1 - t) * (1 - t);
  }
  return 1;
}

/**
 * Whether the point (x, y) on the ground is in a puddle: inside the
 * ellipse of its present size, `cfg.width` across and `flatten` of that
 * from top to bottom.
 */
export function inDrownedWater(
  pools: readonly DrownedPool[],
  x: number,
  y: number,
  cfg: DrownedConfig,
  flatten: number,
): boolean {
  for (const pool of pools) {
    const size = poolSize(pool, cfg);
    if (size <= 0) continue;
    const rx = (cfg.width / 2) * size;
    const ry = rx * flatten;
    const dx = (x - pool.x) / rx;
    const dy = (y - pool.y) / ry;
    if (dx * dx + dy * dy < 1) return true;
  }
  return false;
}

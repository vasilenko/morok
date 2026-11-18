import { describe, expect, it } from 'vitest';
import type { DrownedConfig } from '../config';
import { addPool, agePools, inDrownedWater, poolSize, type DrownedPool } from './drowned';

const cfg: DrownedConfig = { spread: 0.4, last: 14, dry: 2, slow: 0.55, width: 44, cap: 12 };
const FLATTEN = 0.75;
const STEP = 1 / 60;

function run(pools: DrownedPool[], seconds: number): void {
  for (let t = 0; t < seconds - 1e-9; t += STEP) agePools(pools, STEP, cfg);
}

describe('drowned water', () => {
  it('spreads from nothing to its full size over the spread time', () => {
    const pools: DrownedPool[] = [];
    addPool(pools, 0, 0, cfg);
    expect(poolSize(pools[0], cfg)).toBe(0);
    run(pools, 0.2);
    expect(poolSize(pools[0], cfg)).toBeGreaterThan(0.5);
    expect(poolSize(pools[0], cfg)).toBeLessThan(1);
    run(pools, 0.2);
    expect(poolSize(pools[0], cfg)).toBeCloseTo(1);
  });

  it('stays whole until it has lasted, then dries away and is gone', () => {
    const pools: DrownedPool[] = [];
    addPool(pools, 0, 0, cfg);
    run(pools, 13.9);
    expect(poolSize(pools[0], cfg)).toBe(1);
    run(pools, 1.1);
    expect(poolSize(pools[0], cfg)).toBeCloseTo(0.5, 1);
    run(pools, 0.95);
    expect(pools).toHaveLength(1);
    run(pools, 0.1);
    expect(pools).toHaveLength(0);
  });

  it('holds the point at its middle and within its flattened outline, not beyond', () => {
    const pools: DrownedPool[] = [];
    addPool(pools, 100, 50, cfg);
    run(pools, 1);
    expect(inDrownedWater(pools, 100, 50, cfg, FLATTEN)).toBe(true);
    expect(inDrownedWater(pools, 100 + 21, 50, cfg, FLATTEN)).toBe(true);
    expect(inDrownedWater(pools, 100 + 23, 50, cfg, FLATTEN)).toBe(false);
    // Flattened: it reaches 16.5 up and down, not 22.
    expect(inDrownedWater(pools, 100, 50 + 16, cfg, FLATTEN)).toBe(true);
    expect(inDrownedWater(pools, 100, 50 + 18, cfg, FLATTEN)).toBe(false);
  });

  it('holds nothing as it is left and less as it dries', () => {
    const pools: DrownedPool[] = [];
    addPool(pools, 0, 0, cfg);
    expect(inDrownedWater(pools, 0, 0, cfg, FLATTEN)).toBe(false);
    run(pools, 15);
    // Half dried: half its width.
    expect(inDrownedWater(pools, 10, 0, cfg, FLATTEN)).toBe(true);
    expect(inDrownedWater(pools, 12, 0, cfg, FLATTEN)).toBe(false);
  });

  it('keeps at most `cap` wet, the oldest drying early to make room', () => {
    const pools: DrownedPool[] = [];
    for (let i = 0; i < cfg.cap; i++) {
      addPool(pools, i * 100, 0, cfg);
      run(pools, 0.5);
    }
    expect(pools.every((pool) => pool.age < pool.dryAt)).toBe(true);
    addPool(pools, 5000, 0, cfg);
    const wet = pools.filter((pool) => pool.age < pool.dryAt);
    expect(wet).toHaveLength(cfg.cap);
    // The first one left is the one drying, and it dries over the usual time.
    expect(pools[0].age).toBe(pools[0].dryAt);
    run(pools, cfg.dry + 0.05);
    expect(pools).toHaveLength(cfg.cap);
    expect(pools.some((pool) => pool.x === 0)).toBe(false);
  });
});

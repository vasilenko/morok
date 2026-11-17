import { describe, expect, it } from 'vitest';
import { CFG } from '../config';
import { inStrike, newSign, pickPlaces, signDone, signLight, stepSign, type Place } from './book';

const cfg = CFG.book;
const FLATTEN = CFG.ground.flatten;
const STEP = 1 / 60;
const level1 = CFG.items.book[0];

/** A random source that walks through the given draws, round and round. */
const draws = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const at = (x: number, y: number): Place => ({ x, y });

describe('the black book', () => {
  it('cuts its signs under enemies within reach of the hero, never further', () => {
    const near = [at(100, 0), at(0, -229), at(-160, 160), at(10, 10)];
    const far = [at(231, 0), at(0, 300), at(-170, 170)];
    for (let trial = 0; trial < 200; trial++) {
      const picked = pickPlaces([...far, ...near], 0, 0, 4, cfg, Math.random);
      expect(picked).toHaveLength(4);
      for (const place of picked) {
        expect(near).toContain(place);
        expect(Math.hypot(place.x, place.y)).toBeLessThanOrEqual(cfg.reach);
      }
    }
  });

  it('measures the reach from the hero, wherever he is', () => {
    expect(pickPlaces([at(1100, 1000)], 1000, 1000, 1, cfg, Math.random)).toHaveLength(1);
    expect(pickPlaces([at(100, 0)], 1000, 1000, 1, cfg, Math.random)).toHaveLength(0);
  });

  it('cuts each sign under a different enemy, as many as the level gives', () => {
    const places = Array.from({ length: 10 }, (_, i) => at(i * 10, 0));
    for (const stats of CFG.items.book) {
      const picked = pickPlaces(places, 0, 0, stats.count, cfg, Math.random);
      expect(picked).toHaveLength(stats.count);
      expect(new Set(picked).size).toBe(stats.count);
    }
  });

  it('cuts fewer when fewer are in reach, and none when none is', () => {
    expect(pickPlaces([at(10, 0), at(500, 0)], 0, 0, 4, cfg, Math.random)).toEqual([at(10, 0)]);
    expect(pickPlaces([at(500, 0)], 0, 0, 4, cfg, Math.random)).toEqual([]);
    expect(pickPlaces([], 0, 0, 4, cfg, Math.random)).toEqual([]);
  });

  it('picks at random among those in reach', () => {
    const places = [at(10, 0), at(20, 0), at(30, 0)];
    expect(pickPlaces(places, 0, 0, 1, cfg, draws(0))).toEqual([at(10, 0)]);
    expect(pickPlaces(places, 0, 0, 1, cfg, draws(0.5))).toEqual([at(20, 0)]);
    expect(pickPlaces(places, 0, 0, 1, cfg, draws(0.99))).toEqual([at(30, 0)]);
  });

  it('strikes once, its delay after it was cut, where it was cut', () => {
    const sign = newSign(at(50, 60), level1, 2);
    const strikes: number[] = [];
    for (let i = 1; i <= 120; i++) if (stepSign(sign, STEP)) strikes.push(i * STEP);
    expect(strikes).toHaveLength(1);
    expect(strikes[0]).toBeGreaterThanOrEqual(level1.delay - 1e-9);
    expect(strikes[0]).toBeLessThan(level1.delay + STEP);
    expect([sign.x, sign.y]).toEqual([50, 60]);
  });

  it('is forgotten once it has struck and faded out', () => {
    const sign = newSign(at(0, 0), level1, 0);
    let steps = 0;
    while (!signDone(sign, cfg)) {
      stepSign(sign, STEP);
      steps++;
    }
    expect(steps * STEP).toBeCloseTo(level1.delay + cfg.fade, 1);
  });

  it('strikes all within its radius on the ground, flattened, and no one outside', () => {
    const r = 45;
    expect(inStrike(0, 0, r, FLATTEN)).toBe(true);
    expect(inStrike(44, 0, r, FLATTEN)).toBe(true);
    expect(inStrike(-44, 0, r, FLATTEN)).toBe(true);
    expect(inStrike(0, 33, r, FLATTEN)).toBe(true);
    expect(inStrike(0, -33, r, FLATTEN)).toBe(true);
    expect(inStrike(46, 0, r, FLATTEN)).toBe(false);
    expect(inStrike(0, 35, r, FLATTEN)).toBe(false);
    expect(inStrike(30, 30, r, FLATTEN)).toBe(false);
  });

  it('misses an enemy that has walked off before the strike', () => {
    const sign = newSign(at(0, 0), level1, 0);
    // A navia at the fastest walk, starting on the sign's middle.
    let x = 0;
    let struck = false;
    while (!struck) {
      x += CFG.navia.speedMax * STEP;
      struck = stepSign(sign, STEP);
    }
    expect(x).toBeGreaterThan(level1.radius);
    expect(inStrike(x, 0, sign.radius, FLATTEN)).toBe(false);
  });

  it('shines faint when cut and grows towards the strike, surges at it and fades out', () => {
    const delay = level1.delay;
    const cut = signLight(0, delay, cfg);
    expect(cut.grow).toBeCloseTo(cfg.faint, 9);
    expect(cut.surge).toBe(0);
    expect(cut.fade).toBe(1);
    let last = cut.grow;
    for (let i = 1; i < 54; i++) {
      const light = signLight(i * STEP, delay, cfg);
      expect(light.grow).toBeGreaterThan(last);
      last = light.grow;
    }
    expect(signLight(delay - 0.01, delay, cfg).grow).toBeGreaterThan(0.95);
    expect(signLight(delay, delay, cfg)).toEqual({ grow: 1, surge: 1, fade: 1 });
    expect(signLight(delay + cfg.surge, delay, cfg).surge).toBeCloseTo(0, 9);
    expect(signLight(delay + cfg.fade / 2, delay, cfg).fade).toBeCloseTo(0.5, 9);
    expect(signLight(delay + cfg.fade, delay, cfg).fade).toBeCloseTo(0, 9);
  });
});

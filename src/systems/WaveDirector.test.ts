import { describe, expect, it } from 'vitest';
import type { SpawnConfig } from '../config';
import { spawnedKind, WaveDirector, type WaveEvent } from './WaveDirector';

const cfg: SpawnConfig = {
  trickle: 2,
  trickleGrowth: 6,
  firstWave: 3,
  waveEvery: 10,
  waveBase: 8,
  waveGrowth: 4,
  ringEvery: 4,
  maxEnemies: 700,
};

/** Runs the director in fixed steps and records what it spawned. */
function run(director: WaveDirector, seconds: number, startAt = 0, step = 0.1) {
  const angles: number[] = [];
  const waves: WaveEvent[] = [];
  const steps = Math.round(seconds / step);
  for (let i = 0; i < steps; i++) {
    const event = director.update(step, startAt + i * step, (angle) => angles.push(angle));
    if (event) waves.push(event);
  }
  return { angles, waves };
}

describe('WaveDirector', () => {
  it('trickles enemies at the configured rate before the first wave', () => {
    const director = new WaveDirector({ ...cfg, trickleGrowth: 0 });

    const { angles, waves } = run(director, 2.5);

    expect(waves).toEqual([]);
    expect(angles.length).toBe(5);
  });

  it('thickens the trickle as the night goes on', () => {
    const early = run(new WaveDirector({ ...cfg, firstWave: 999 }), 1, 0);
    const late = run(new WaveDirector({ ...cfg, firstWave: 999 }), 1, 60);

    expect(early.angles.length).toBe(2);
    expect(late.angles.length).toBe(8);
  });

  it('starts waves on schedule and grows each one', () => {
    const director = new WaveDirector({ ...cfg, trickle: 0, trickleGrowth: 0 });

    const { waves } = run(director, 24);

    expect(waves).toEqual([
      { wave: 1, ring: false, count: 8 },
      { wave: 2, ring: false, count: 12 },
      { wave: 3, ring: false, count: 16 },
    ]);
    expect(director.wave).toBe(3);
  });

  it('sends a regular wave from one side', () => {
    const director = new WaveDirector({ ...cfg, trickle: 0, trickleGrowth: 0 });

    const { angles } = run(director, 4);

    expect(angles.length).toBe(8);
    expect(Math.max(...angles) - Math.min(...angles)).toBeLessThanOrEqual(1.0);
  });

  it('spreads every fourth wave evenly around the player', () => {
    const director = new WaveDirector({ ...cfg, trickle: 0, trickleGrowth: 0, ringEvery: 1 });

    const { angles, waves } = run(director, 4);

    expect(waves[0]).toEqual({ wave: 1, ring: true, count: 8 });
    const gaps = angles.slice(1).map((angle, i) => angle - angles[i]);
    for (const gap of gaps) expect(gap).toBeCloseTo((Math.PI * 2) / 8);
  });
});

describe('spawnedKind', () => {
  const upyr = { appearsAt: 45, share: 1 / 8 };
  const utopets = { appearsAt: 90, share: 1 / 10 };
  const kinds = [upyr, utopets];
  const rolls = Array.from({ length: 4000 }, (_, i) => (i + 0.5) / 4000);
  const count = (elapsed: number, kind: number) => rolls.filter((roll) => spawnedKind(elapsed, roll, kinds) === kind).length;

  it('spawns only the common kind before any other appears', () => {
    expect(count(0, -1)).toBe(rolls.length);
    expect(spawnedKind(44.9, 0, kinds)).toBe(-1);
  });

  it('makes one enemy in eight an upyr from 45 s, and no utopets before 90 s', () => {
    expect(count(45, 0)).toBe(500);
    expect(count(89.9, 0)).toBe(500);
    expect(count(89.9, 1)).toBe(0);
    expect(count(89.9, -1)).toBe(3500);
  });

  it('makes one in ten an utopets from 90 s, leaving the upyr its share', () => {
    expect(count(90, 0)).toBe(500);
    expect(count(90, 1)).toBe(400);
    expect(count(300, -1)).toBe(3100);
  });

  it('gives each kind its own slice of the roll', () => {
    expect(spawnedKind(300, 0, kinds)).toBe(0);
    expect(spawnedKind(300, 0.124, kinds)).toBe(0);
    expect(spawnedKind(300, 0.125, kinds)).toBe(1);
    expect(spawnedKind(300, 0.224, kinds)).toBe(1);
    expect(spawnedKind(300, 0.225, kinds)).toBe(-1);
  });
});

import { describe, expect, it } from 'vitest';
import type { SpawnConfig } from '../config';
import { spawnsUpyr, WaveDirector, type WaveEvent } from './WaveDirector';

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

describe('spawnsUpyr', () => {
  const upyr = { appearsAt: 45, share: 1 / 8 };

  it('never spawns an upyr before it appears', () => {
    expect(spawnsUpyr(0, 0, upyr)).toBe(false);
    expect(spawnsUpyr(44.9, 0, upyr)).toBe(false);
  });

  it('spawns an upyr for rolls under its share once it has appeared', () => {
    expect(spawnsUpyr(45, 0, upyr)).toBe(true);
    expect(spawnsUpyr(300, 0.124, upyr)).toBe(true);
    expect(spawnsUpyr(300, 0.125, upyr)).toBe(false);
    expect(spawnsUpyr(300, 0.99, upyr)).toBe(false);
  });

  it('makes about one enemy in eight an upyr', () => {
    const rolls = Array.from({ length: 800 }, (_, i) => (i + 0.5) / 800);
    expect(rolls.filter((roll) => spawnsUpyr(60, roll, upyr)).length).toBe(100);
  });
});

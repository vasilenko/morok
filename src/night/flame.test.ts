import { describe, expect, it } from 'vitest';
import { drainFlare, eyeFire, flameWaver, flareStrength } from './flame';

const STEP = 1 / 60;

/** The waver sampled every frame at 60 fps for `seconds` from `start`. */
function samples(start: number, seconds: number): number[] {
  const values: number[] = [];
  for (let i = 0; i <= seconds / STEP; i++) values.push(flameWaver(start + i * STEP));
  return values;
}

describe('flameWaver', () => {
  it('stays within -1..1 and uses most of that range', () => {
    const values = samples(0, 600);
    expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(Math.max(...values)).toBeGreaterThan(0.7);
    expect(Math.min(...values)).toBeLessThan(-0.7);
  });

  it('changes only a little from one frame to the next', () => {
    for (const start of [0, 137.2, 86_400]) {
      const values = samples(start, 30);
      for (let i = 1; i < values.length; i++) {
        expect(Math.abs(values[i] - values[i - 1])).toBeLessThan(0.2);
      }
    }
  });

  it('does not repeat itself over a few seconds', () => {
    const window = samples(10, 6);
    for (let lag = 0.5; lag <= 5; lag += STEP) {
      const shifted = samples(10 + lag, 6);
      let difference = 0;
      for (let i = 0; i < window.length; i++) difference += Math.abs(window[i] - shifted[i]);
      expect(difference / window.length).toBeGreaterThan(0.1);
    }
  });

  it('is the same for the same time', () => {
    expect(flameWaver(42.123)).toBe(flameWaver(42.123));
    expect(flameWaver(7, 1.5, 0.3)).toBe(flameWaver(7, 1.5, 0.3));
  });

  it('moves mostly slowly, turning a few times a second', () => {
    const values = samples(0, 60);
    let turns = 0;
    for (let i = 2; i < values.length; i++) {
      if ((values[i] - values[i - 1]) * (values[i - 1] - values[i - 2]) < 0) turns++;
    }
    const perSecond = turns / 60;
    expect(perSecond).toBeGreaterThan(1);
    expect(perSecond).toBeLessThan(12);
  });
});

describe('eyeFire', () => {
  const eye = {
    halo: 5,
    intensity: 1,
    haloColor: [1, 0.5, 0.1] as const,
    emberColor: [0.5, 0.1, 0] as const,
    flicker: 0.4,
    breathe: 0.2,
    shade: 0.6,
    flare: { intensity: 1.5, halo: 0.8 },
  };

  it('rests at the configured values halfway between ember and flare', () => {
    const fire = eyeFire(eye, 0);
    expect(fire.intensity).toBeCloseTo(1);
    expect(fire.halo).toBeCloseTo(5);
    expect(fire.shade).toBeCloseTo(0.7);
    expect(fire.haloColor[0]).toBeCloseTo(0.75);
    expect(fire.haloColor[1]).toBeCloseTo(0.3);
    expect(fire.haloColor[2]).toBeCloseTo(0.05);
  });

  it('swings strength and radius by their shares, and the colour from ember to flare', () => {
    const high = eyeFire(eye, 1);
    const low = eyeFire(eye, -1);
    expect(high.intensity).toBeCloseTo(1.4);
    expect(low.intensity).toBeCloseTo(0.6);
    expect(high.halo).toBeCloseTo(6);
    expect(low.halo).toBeCloseTo(4);
    expect(high.haloColor).toEqual([1, 0.5, 0.1]);
    expect(low.haloColor).toEqual([0.5, 0.1, 0]);
    // The bone is untouched at the top of a flare and darkest at the bottom.
    expect(high.shade).toBeCloseTo(1);
    expect(low.shade).toBeCloseTo(0.4);
  });

  it('never goes past the ends of the swing', () => {
    expect(eyeFire(eye, 3)).toEqual(eyeFire(eye, 1));
    expect(eyeFire(eye, -3)).toEqual(eyeFire(eye, -1));
  });

  it('flares on top of the swing and turns to its hottest at full flare', () => {
    const rest = eyeFire(eye, -1);
    const full = eyeFire(eye, -1, 1);
    expect(full.intensity - rest.intensity).toBeCloseTo(1.5);
    expect(full.halo - rest.halo).toBeCloseTo(4);
    expect(full.haloColor).toEqual([1, 0.5, 0.1]);
    expect(full.shade).toBeCloseTo(1);
    // The flicker swings by the same amount however hard it flares.
    expect(eyeFire(eye, 1, 0.5).intensity - eyeFire(eye, -1, 0.5).intensity).toBeCloseTo(0.8);
    expect(eyeFire(eye, 0, 3)).toEqual(eyeFire(eye, 0, 1));
  });
});

describe('the flare from sparks', () => {
  const FADE = 0.18;
  const KNEE = 2.5;
  /** Strength of the flare every frame for `seconds`, with sparks of `worth` arriving at `times`. */
  function trace(times: number[], worth: number, seconds: number): number[] {
    let heat = 0;
    let at = 0;
    let next = 0;
    const values: number[] = [];
    for (let i = 0; i <= seconds / STEP; i++) {
      const t = i * STEP;
      while (next < times.length && times[next] <= t + 1e-9) {
        heat = drainFlare(heat, t - at, FADE) + worth;
        at = t;
        next++;
      }
      values.push(flareStrength(drainFlare(heat, t - at, FADE), KNEE));
    }
    return values;
  }

  it('flashes harder for a larger spark, and never past full', () => {
    const small = flareStrength(1, KNEE);
    const large = flareStrength(5, KNEE);
    expect(small).toBeGreaterThan(0.2);
    expect(large).toBeGreaterThan(2.5 * small);
    expect(flareStrength(1000, KNEE)).toBeLessThanOrEqual(1);
    expect(flareStrength(0, KNEE)).toBe(0);
  });

  it('dies down within a fraction of a second', () => {
    const values = trace([0], 5, 1);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    expect(values[Math.round(0.6 / STEP)]).toBeLessThan(0.1 * values[0]);
  });

  it('holds a steady strong burn through a stream of sparks', () => {
    // Twenty sparks, one every other frame; past the first quarter second.
    const times = Array.from({ length: 20 }, (_, i) => i * 2 * STEP);
    const values = trace(times, 1, 1).slice(16, 38);
    expect(Math.min(...values)).toBeGreaterThan(0.8);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.1);
  });

  it('does not grow when the clock jumps back', () => {
    expect(drainFlare(2, -5, FADE)).toBe(2);
  });
});

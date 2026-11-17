import { describe, expect, it } from 'vitest';
import { bakeGlow, bakeRays, bandRows, pulse, reachPixels, SIGN_LIGHT, strands } from './signs';

/** A uniform random source that repeats for the same seed. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("the signs' light", () => {
  it('stands in strands with gaps between them, no two in a row pulsing together', () => {
    const { strength, group } = strands(220, seeded(3));
    let gaps = 0;
    let lastGroup = -1;
    for (let x = 0; x < 220; x++) {
      if (strength[x] === 0) gaps++;
      expect(group[x]).toBeLessThan(SIGN_LIGHT.groups);
    }
    expect(gaps).toBeGreaterThan(10);
    // Walk the strands: a lit strand's group differs from the last lit one's.
    for (let x = 0; x < 220; ) {
      let end = x;
      while (end < 220 && group[end] === group[x] && (strength[end] > 0) === (strength[x] > 0)) end++;
      if (strength[x] > 0) {
        expect(group[x]).not.toBe(lastGroup);
        lastGroup = group[x];
      }
      x = end;
    }
  });

  it('rises straight up from a cut, fading towards its top, and not below it', () => {
    const width = 4;
    const height = 40;
    const mask = new Float32Array(width * height);
    // One point of cut, in the last band.
    const cutRow = 35;
    mask[cutRow * width + 1] = 1;
    const lines = { strength: Float32Array.from([1, 1, 1, 1]), group: Uint8Array.from([0, 0, 0, 0]) };
    const band = SIGN_LIGHT.bands - 1;
    const { top } = bandRows(band, height);
    const rays = bakeRays(mask, width, height, band, 0, lines);
    const reach = reachPixels();
    const row = (signRow: number) => signRow - (top - reach);
    // Only its own column is lit.
    for (let y = 0; y < rays.length / width; y++) {
      expect(rays[y * width]).toBe(0);
      expect(rays[y * width + 2]).toBe(0);
    }
    expect(rays[row(cutRow) * width + 1]).toBeGreaterThan(0);
    expect(rays[row(cutRow - 10) * width + 1]).toBeLessThan(rays[row(cutRow) * width + 1]);
    expect(rays[row(cutRow - 10) * width + 1]).toBeGreaterThan(0);
    expect(rays[row(cutRow - reach) * width + 1]).toBe(0);
    expect(rays[row(cutRow + 1) * width + 1]).toBe(0);
  });

  it('leaves the columns of other groups dark', () => {
    const mask = new Float32Array(4 * 40).fill(1);
    const lines = { strength: Float32Array.from([1, 1, 1, 1]), group: Uint8Array.from([0, 1, 0, 1]) };
    const rays = bakeRays(mask, 4, 40, 0, 1, lines);
    for (let y = 0; y < rays.length / 4; y++) {
      expect(rays[y * 4]).toBe(0);
      expect(rays[y * 4 + 2]).toBe(0);
    }
  });

  it('glows brightest and palest on the cut itself', () => {
    const mask = new Float32Array(30 * 30);
    mask[15 * 30 + 15] = 1;
    const glow = bakeGlow(mask, 30, 30);
    const w = 30 + 2 * SIGN_LIGHT.margin;
    const on = (15 + SIGN_LIGHT.margin) * w + 15 + SIGN_LIGHT.margin;
    const beside = on + 3;
    expect(glow[on * 3 + 1]).toBeGreaterThan(glow[beside * 3 + 1]);
    expect(glow[beside * 3 + 1]).toBeGreaterThan(glow[beside * 3]);
  });

  it('pulses between its low and full at its rate', () => {
    const values = Array.from({ length: 200 }, (_, i) => pulse(i / 200, 2, 0));
    expect(Math.min(...values)).toBeCloseTo(SIGN_LIGHT.low, 2);
    expect(Math.max(...values)).toBeCloseTo(1, 2);
    expect(pulse(0.1, 2, 0.3)).toBeCloseTo(pulse(0.6, 2, 0.3), 9);
  });
});

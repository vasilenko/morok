import { describe, expect, it } from 'vitest';
import { bodyAxis, rippleOffset, rippleWeight, warpRipple } from './ripple.mjs';

const config = {
  head: [10, 10],
  tail: [10, 110],
  rigidUntil: 0.3,
  looseFrom: 0.8,
  amplitude: 0.04,
  waves: 1.25,
};
const samples = Array.from({ length: 201 }, (_, i) => -0.2 + i * 0.007);

describe('rippleOffset', () => {
  it('leaves the rigid front still at every phase', () => {
    for (const phase of [0, 0.125, 0.4, 0.9]) {
      for (const s of samples.filter((s) => s <= config.rigidUntil)) {
        expect(rippleOffset(s, phase, config)).toBe(0);
      }
    }
  });

  it('closes the loop: phase 1 equals phase 0', () => {
    for (const s of samples) {
      expect(rippleOffset(s, 1, config)).toBeCloseTo(rippleOffset(s, 0, config), 9);
    }
  });

  it('never pushes further than the configured amplitude', () => {
    const limit = config.amplitude * bodyAxis(config).length;
    let largest = 0;
    for (let phase = 0; phase < 1; phase += 1 / 16) {
      for (const s of samples) largest = Math.max(largest, Math.abs(rippleOffset(s, phase, config)));
    }
    expect(largest).toBeLessThanOrEqual(limit);
    // and the tail actually reaches it
    expect(largest).toBeGreaterThan(limit * 0.95);
  });

  it('frees the cloth gradually from the body to the tail', () => {
    const weights = samples.map((s) => rippleWeight(s, config));
    for (let i = 1; i < weights.length; i++) expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1]);
    expect(rippleWeight(1, config)).toBe(1);
  });
});

describe('warpRipple', () => {
  it('copies the rigid front unchanged and keeps transparency clear of fringes', () => {
    const width = 20;
    const height = 120;
    const data = Buffer.alloc(width * height * 4);
    // a solid white bar down the middle of the axis
    for (let y = 0; y < height; y++) {
      for (let x = 7; x < 13; x++) data.set([255, 255, 255, 255], (y * width + x) * 4);
    }
    const out = warpRipple(data, width, height, 0.3, config);

    const rigidRows = 10 + config.rigidUntil * 100 - 1;
    for (let y = 0; y < rigidRows; y++) {
      const row = (y * width) * 4;
      expect(out.subarray(row, row + width * 4)).toEqual(data.subarray(row, row + width * 4));
    }
    for (let i = 0; i < out.length; i += 4) {
      // any visible pixel keeps the bar's colour; edges only lose alpha
      if (out[i + 3] > 0) expect([out[i], out[i + 1], out[i + 2]]).toEqual([255, 255, 255]);
    }
  });
});

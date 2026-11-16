import { describe, expect, it } from 'vitest';
import { CFG } from '../config';
import { COAL, coalLight, GRADE_COLORS, restingWing, smoulder, unfurl, WING, wingCover } from './coals';

const peak = (light: readonly number[]) => Math.max(...light);

describe('the coals', () => {
  it('keep all their light inside their frame', () => {
    const { left, top, width, height } = COAL.frame;
    for (const color of GRADE_COLORS) {
      for (const grounded of [true, false]) {
        const light = (x: number, y: number) => peak(coalLight(x, y, color, grounded));
        for (let x = left; x <= left + width; x += 0.25) {
          expect(light(x, top)).toBeLessThan(0.01);
          expect(light(x, top + height)).toBeLessThan(0.01);
        }
        for (let y = top; y <= top + height; y += 0.25) {
          expect(light(left, y)).toBeLessThan(0.01);
          expect(light(left + width, y)).toBeLessThan(0.01);
        }
      }
    }
  });

  it('light the soil below them only while on the ground', () => {
    for (const color of GRADE_COLORS) {
      const below = (grounded: boolean) => peak(coalLight(0, CFG.spark.hover, color, grounded));
      expect(below(true)).toBeGreaterThan(below(false) + 0.1);
    }
  });

  it('have a hot pale core in a halo of their colour', () => {
    for (const color of GRADE_COLORS) {
      const whiteness = (light: readonly number[]) => Math.min(...light) / peak(light);
      expect(peak(coalLight(0, 0, color, true))).toBeGreaterThan(0.95);
      expect(whiteness(coalLight(0, 0, color, true))).toBeGreaterThan(whiteness(coalLight(2, 0, color, true)) + 0.2);
    }
  });

  it('are all the same size', () => {
    const reach = (color: readonly [number, number, number]) => {
      let x = 0;
      while (peak(coalLight(x, -x, color, true)) > 0.1) x += 0.05;
      return x;
    };
    const reaches = GRADE_COLORS.map(reach);
    for (const r of reaches) expect(r).toBeCloseTo(reaches[0], 0);
  });

  it('smoulder slowly, never going out and never flashing', () => {
    const low = 0.7;
    for (const phase of [0, 1, 2.5, 4]) {
      let last = smoulder(0, phase, low);
      let [least, most] = [last, last];
      for (let t = 1 / 60; t < 60; t += 1 / 60) {
        const glow = smoulder(t, phase, low);
        expect(glow).toBeGreaterThanOrEqual(low);
        expect(glow).toBeLessThanOrEqual(1);
        expect(Math.abs(glow - last)).toBeLessThan(0.01);
        [least, most, last] = [Math.min(least, glow), Math.max(most, glow), glow];
      }
      // It does breathe, over most of its range.
      expect(most - least).toBeGreaterThan(0.6 * (1 - low));
    }
  });
});

describe('the wings', () => {
  it('fit their frame, with the root at the coal', () => {
    const { left, top, width, height } = WING.frame;
    for (let x = left; x <= left + width; x += 0.1) {
      expect(wingCover(x, top)).toBe(0);
      expect(wingCover(x, top + height)).toBe(0);
    }
    for (let y = top; y <= top + height; y += 0.1) {
      expect(wingCover(left, y)).toBe(0);
      expect(wingCover(left + width, y)).toBe(0);
    }
    expect(wingCover(0.3, 0)).toBeGreaterThan(0.1);
  });

  it('are longer than wide, soft and translucent, brightest along the leading edge', () => {
    expect(WING.length).toBeGreaterThan(2 * WING.width);
    const x = WING.length / 2;
    let edge = 0;
    let edgeY = 0;
    for (let y = -WING.width; y < WING.width; y += 0.05) {
      const cover = wingCover(x, y);
      expect(cover).toBeLessThan(1);
      if (cover > edge) [edge, edgeY] = [cover, y];
    }
    // The brightest line is near the top, well above the middle of the membrane.
    expect(edgeY).toBeLessThan(0);
    expect(edge).toBeGreaterThan(1.5 * wingCover(x, WING.width / 2));
  });

  it('unfurl from nothing to full in their time, never going back', () => {
    const duration = 0.2;
    expect(unfurl(0, duration)).toBe(0);
    expect(unfurl(duration, duration)).toBe(1);
    expect(unfurl(5, duration)).toBe(1);
    let last = 0;
    for (let t = 0; t <= duration; t += 0.01) {
      const u = unfurl(t, duration);
      expect(u).toBeGreaterThanOrEqual(last);
      last = u;
    }
  });
});

describe('the resting wing', () => {
  it('is fixed for a coal', () => {
    for (const phase of [0.1, 1.7, 3.3, 6]) expect(restingWing(phase, 0.2)).toBe(restingWing(phase, 0.2));
  });

  it('is shown by about the given share of coals', () => {
    // Phases as random as the drops' ones, from a fixed generator.
    let seed = 12345;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const count = 20000;
    let winged = 0;
    for (let i = 0; i < count; i++) if (restingWing(random() * Math.PI * 2, 0.2)) winged++;
    expect(winged / count).toBeCloseTo(0.2, 1);
  });
});

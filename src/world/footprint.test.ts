import { describe, expect, it } from 'vitest';
import { closestOnEllipse, pushOut, pushOutAll, type Ellipse } from './footprint';

/** A wide, flat footprint like the mound's, away from the origin. */
const WIDE: Ellipse = { x: 40, y: -30, rx: 54, ry: 17 };
const RADIUS = 10;

/** Distance from a point to the outline, found by walking the whole outline finely. */
function bruteDistance(e: Ellipse, x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < 20000; i++) {
    const t = (i / 20000) * 2 * Math.PI;
    best = Math.min(best, Math.hypot(x - (e.x + e.rx * Math.cos(t)), y - (e.y + e.ry * Math.sin(t))));
  }
  return best;
}

function inside(e: Ellipse, x: number, y: number): boolean {
  return ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 < 1;
}

/** Points scattered over the ellipse and around it. */
function samples(e: Ellipse): { x: number; y: number }[] {
  const points = [];
  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      points.push({ x: e.x + (i / 5) * (e.rx + RADIUS), y: e.y + (j / 5) * (e.ry + RADIUS) });
    }
  }
  return points;
}

describe('closestOnEllipse', () => {
  it('finds the nearest point of the outline from inside and outside', () => {
    for (const e of [WIDE, { x: 0, y: 0, rx: 7, ry: 4 }, { x: 5, y: 5, rx: 12, ry: 12 }]) {
      for (const { x, y } of samples(e)) {
        const p = closestOnEllipse(e, x, y);
        expect(((p.x - e.x) / e.rx) ** 2 + ((p.y - e.y) / e.ry) ** 2).toBeCloseTo(1, 6);
        expect(Math.hypot(x - p.x, y - p.y)).toBeCloseTo(bruteDistance(e, x, y), 2);
      }
    }
  });
});

describe('pushOut', () => {
  it('leaves a circle clear of the footprint where it is', () => {
    expect(pushOut(200, 200, RADIUS, WIDE)).toEqual({ x: 200, y: 200 });
    // Just beyond touching distance below the bottom of the ellipse.
    const y = WIDE.y + WIDE.ry + RADIUS + 0.01;
    expect(pushOut(WIDE.x, y, RADIUS, WIDE)).toEqual({ x: WIDE.x, y });
  });

  it('moves an overlapping circle to exactly touch the footprint, never inside', () => {
    for (const { x, y } of samples(WIDE)) {
      const p = pushOut(x, y, RADIUS, WIDE);
      expect(inside(WIDE, p.x, p.y)).toBe(false);
      const distance = bruteDistance(WIDE, p.x, p.y);
      if (p.x !== x || p.y !== y) expect(distance).toBeCloseTo(RADIUS, 2);
      else expect(distance).toBeGreaterThanOrEqual(RADIUS - 1e-3);
    }
  });

  it('takes the shortest way out', () => {
    // From just inside the top edge, out through the top, not the sides.
    const p = pushOut(WIDE.x + 10, WIDE.y - WIDE.ry + 2, RADIUS, WIDE);
    expect(p.y).toBeLessThan(WIDE.y - WIDE.ry);
    expect(Math.abs(p.x - (WIDE.x + 10))).toBeLessThan(3);
  });

  it('settles at once: pushing out again changes nothing', () => {
    for (const { x, y } of samples(WIDE)) {
      const once = pushOut(x, y, RADIUS, WIDE);
      const twice = pushOut(once.x, once.y, RADIUS, WIDE);
      expect(twice.x).toBeCloseTo(once.x, 9);
      expect(twice.y).toBeCloseTo(once.y, 9);
    }
  });

  it('slides a diagonal walk along the edge instead of stopping it', () => {
    // Walking down and to the right onto the top of the footprint.
    let x = WIDE.x - 15;
    let y = WIDE.y - WIDE.ry - RADIUS - 6;
    const step = 175 / 60 / Math.SQRT2;
    let blocked = false;
    for (let i = 0; i < 20; i++) {
      const p = pushOut(x + step, y + step, RADIUS, WIDE);
      if (p.y < y + step - 1e-9) blocked = true;
      expect(p.x).toBeGreaterThan(x + step / 2);
      expect(inside(WIDE, p.x, p.y)).toBe(false);
      x = p.x;
      y = p.y;
    }
    expect(blocked).toBe(true);
    expect(x).toBeGreaterThan(WIDE.x + 15);
    expect(bruteDistance(WIDE, x, y)).toBeCloseTo(RADIUS, 2);
  });
});

describe('pushOutAll', () => {
  it('changes nothing without footprints', () => {
    expect(pushOutAll(3, 4, RADIUS, [])).toEqual({ x: 3, y: 4 });
  });

  it('pushes out of whichever footprint the circle overlaps', () => {
    const far: Ellipse = { x: 400, y: 0, rx: 20, ry: 8 };
    const p = pushOutAll(WIDE.x, WIDE.y, RADIUS, [far, WIDE]);
    expect(bruteDistance(WIDE, p.x, p.y)).toBeCloseTo(RADIUS, 2);
  });
});

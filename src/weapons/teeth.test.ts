import { describe, expect, it } from 'vitest';
import { CFG, type TeethConfig } from '../config';
import { canBite, newTeeth, placeFang, stepTeeth, type Teeth, type TeethStats } from './teeth';

const cfg: TeethConfig = { rehit: 0.3, knockback: 90, hitRadius: 6, flatten: 0.75, lift: 26, settle: 5 };
const STEP = 1 / 60;
const level1: TeethStats = { count: 2, damage: 10, radius: 85, period: 1.6 };

function run(teeth: Teeth, stats: TeethStats, seconds: number): void {
  for (let t = 0; t < seconds - 1e-9; t += STEP) stepTeeth(teeth, stats, STEP, cfg);
}

/** The fangs' angles apart, in order round the circle, in radians. */
function gaps(teeth: Teeth): number[] {
  const slots = teeth.fangs.map((f) => (((f.slot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))).sort((a, b) => a - b);
  return slots.map((s, i) => (i + 1 < slots.length ? slots[i + 1] - s : slots[0] + 2 * Math.PI - s));
}

describe('the wolf teeth', () => {
  it('have as many fangs as the level gives', () => {
    const teeth = newTeeth();
    run(teeth, level1, 0.1);
    expect(teeth.fangs).toHaveLength(2);
    run(teeth, { ...level1, count: 5 }, 0.1);
    expect(teeth.fangs).toHaveLength(5);
  });

  it('make one turn in the period', () => {
    const teeth = newTeeth();
    run(teeth, level1, 0.4);
    expect(teeth.turn).toBeCloseTo((2 * Math.PI * 0.4) / 1.6, 5);
  });

  it('grow out from the hero when gained, without a jump', () => {
    const teeth = newTeeth();
    stepTeeth(teeth, level1, STEP, cfg);
    let last = placeFang(teeth, teeth.fangs[0], 0, 0, cfg);
    // A tenth of the way out after a frame, and never more than an eighth of the way in one frame.
    expect(Math.hypot(last.x, last.y)).toBeLessThan(level1.radius / 10);
    for (let i = 0; i < 120; i++) {
      stepTeeth(teeth, level1, STEP, cfg);
      const place = placeFang(teeth, teeth.fangs[0], 0, 0, cfg);
      expect(Math.hypot(place.x - last.x, place.y - last.y)).toBeLessThan(level1.radius / 8);
      last = place;
    }
    expect(teeth.fangs[0].grow).toBeGreaterThan(0.99);
  });

  it('spread out evenly, easing round to make room for a new fang', () => {
    const teeth = newTeeth();
    run(teeth, level1, 2);
    expect(gaps(teeth)).toEqual([expect.closeTo(Math.PI, 3), expect.closeTo(Math.PI, 3)]);
    const before = teeth.fangs.map((f) => f.slot);
    stepTeeth(teeth, { ...level1, count: 3 }, STEP, cfg);
    // One step later the old fangs have hardly moved...
    teeth.fangs.slice(0, 2).forEach((f, i) => expect(Math.abs(f.slot - before[i])).toBeLessThan(0.1));
    // ...and a while later all three are a third of a turn apart.
    run(teeth, { ...level1, count: 3 }, 2);
    for (const gap of gaps(teeth)) expect(gap).toBeCloseTo((2 * Math.PI) / 3, 3);
  });

  it('widen the circle gradually', () => {
    const teeth = newTeeth();
    run(teeth, level1, 2);
    expect(teeth.radius).toBe(85);
    let last = teeth.radius;
    for (let i = 0; i < 120; i++) {
      stepTeeth(teeth, { ...level1, radius: 115 }, STEP, cfg);
      expect(teeth.radius - last).toBeLessThan(3);
      last = teeth.radius;
    }
    expect(teeth.radius).toBeCloseTo(115, 1);
  });

  it('circle on an ellipse flattened on the ground, travelling clockwise with the tip ahead', () => {
    const teeth = newTeeth();
    run(teeth, level1, 3);
    const fang = teeth.fangs[0];
    // Right of the hero: as wide as the radius, heading down the screen.
    fang.slot = -teeth.turn;
    const right = placeFang(teeth, fang, 100, 200, cfg);
    expect(right.x).toBeCloseTo(185, 1);
    expect(right.y).toBeCloseTo(200, 3);
    expect(right.heading).toBeCloseTo(Math.PI / 2, 3);
    // Below the hero: three quarters as far, heading left.
    fang.slot = Math.PI / 2 - teeth.turn;
    const below = placeFang(teeth, fang, 100, 200, cfg);
    expect(below.x).toBeCloseTo(100, 1);
    expect(below.y).toBeCloseTo(200 + 63.75, 1);
    expect(Math.abs(below.heading)).toBeCloseTo(Math.PI, 3);
  });

  it('wound an enemy at most once in the rehit time', () => {
    expect(canBite(undefined, 3, cfg)).toBe(true);
    expect(canBite(3, 3.29, cfg)).toBe(false);
    expect(canBite(3, 3.31, cfg)).toBe(true);
  });

  it('point the way they travel all round the ellipse', () => {
    const teeth = newTeeth();
    run(teeth, level1, 3);
    const fang = teeth.fangs[0];
    for (let k = 0; k < 16; k++) {
      fang.slot = (k * Math.PI) / 8;
      const here = placeFang(teeth, fang, 0, 0, cfg);
      fang.slot += 1e-4;
      const next = placeFang(teeth, fang, 0, 0, cfg);
      const travel = Math.atan2(next.y - here.y, next.x - here.x);
      expect(Math.abs(Math.atan2(Math.sin(travel - here.heading), Math.cos(travel - here.heading)))).toBeLessThan(1e-3);
    }
  });
});

describe('the wolf teeth ladder', () => {
  const cfg = CFG.teeth;

  it('keeps the fangs well clear of the hero, above and below him too', () => {
    for (const row of CFG.items.teeth) expect(row.radius * cfg.flatten).toBeGreaterThanOrEqual(60);
  });

  it('never moves a fang further in a frame than it can bite across', () => {
    for (const row of CFG.items.teeth) {
      const teeth = newTeeth();
      run(teeth, row, 3);
      const fang = teeth.fangs[0];
      let last = placeFang(teeth, fang, 0, 0, cfg);
      for (let i = 0; i < 120; i++) {
        stepTeeth(teeth, row, STEP, cfg);
        const place = placeFang(teeth, fang, 0, 0, cfg);
        // Less than the reach of a fang on the smallest enemy, a navia.
        expect(Math.hypot(place.x - last.x, place.y - last.y)).toBeLessThan(cfg.hitRadius + CFG.navia.radius);
        last = place;
      }
    }
  });

  it('spares an enemy for less than the time between two fangs passing it', () => {
    for (const row of CFG.items.teeth) expect(cfg.rehit).toBeLessThan(row.period / row.count);
  });
});

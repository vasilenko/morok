import { describe, expect, it } from 'vitest';
import { CFG } from '../config';
import { bladeAngle, cuts, fanPoint, inFan, stepSwing, swingLife, swingOver, swingSickles, type Swing } from './sickle';

const cfg = CFG.sickle;
const FLATTEN = CFG.ground.flatten;
const STEP = 1 / 60;
const DEG = Math.PI / 180;
const ladder = CFG.items.sickle;
const DOWN = 1;
const UP = -1;
const SWEEP_START = cfg.raise;
const SWEEP_END = cfg.raise + cfg.sweep;

interface Body {
  x: number;
  y: number;
  /** Seconds into the swing it was cut, each time. */
  cuts: number[];
}

const body = (x: number, y: number): Body => ({ x, y, cuts: [] });

/** Swings once, through all three beats, from the hero's feet at the origin, cutting as the scene does: each body at most once a swing. */
function swing(s: Swing, bodies: Body[], dt = STEP, move?: (b: Body, age: number) => void): void {
  const cut = new Set<Body>();
  while (s.age < swingLife(s, cfg.trail.linger)) {
    for (const b of bodies) move?.(b, s.age);
    const sweep = stepSwing(s, dt);
    if (!sweep) continue;
    for (const b of bodies) {
      if (cut.has(b) || !cuts(s, sweep, b.x, b.y, FLATTEN, cfg)) continue;
      cut.add(b);
      b.cuts.push(s.age);
    }
  }
}

/** A body on the ground at `radius` and `angle` (degrees) in the fan of a swing pointing `heading`. */
const at = (heading: number, angle: number, radius: number) => {
  const p = fanPoint(heading, angle * DEG, radius, FLATTEN);
  return body(p.x, p.y);
};

describe('the sickle', () => {
  it('is raised at the start edge, sweeps to the far edge and rests there', () => {
    const [right] = swingSickles(DOWN, true, ladder[0], cfg);
    const [left] = swingSickles(DOWN, false, ladder[0], cfg);
    const half = ladder[0].arc / 2;
    expect(bladeAngle(right, 0)).toBeCloseTo(-half * DEG, 9);
    expect(bladeAngle(left, 0)).toBeCloseTo(half * DEG, 9);
    // Drawn back behind the start edge at the end of the raise.
    expect(bladeAngle(right, SWEEP_START)).toBeCloseTo(-(half + cfg.drawBack) * DEG, 9);
    expect(bladeAngle(right, SWEEP_END)).toBeCloseTo(half * DEG, 9);
    expect(bladeAngle(right, SWEEP_END + cfg.rest)).toBeCloseTo(half * DEG, 9);
    expect(bladeAngle(left, SWEEP_END)).toBeCloseTo(-half * DEG, 9);
    // Fastest in the middle of the sweep, easing into the far edge.
    const speed = (age: number) => Math.abs(bladeAngle(right, age + 0.005) - bladeAngle(right, age));
    expect(speed(SWEEP_START + cfg.sweep / 2)).toBeGreaterThan(speed(SWEEP_END - 0.02) * 4);
  });

  it('cuts only during the sweep, never in the raise or the rest', () => {
    const bodies: Body[] = [];
    for (let angle = -60; angle <= 60; angle += 5) for (const r of [20, 50, 85]) bodies.push(at(DOWN, angle, r));
    for (const rightward of [true, false]) {
      for (const b of bodies) b.cuts = [];
      const [s] = swingSickles(DOWN, rightward, ladder[0], cfg);
      swing(s, bodies);
      for (const b of bodies.filter((b) => b.cuts.length > 0)) {
        expect(b.cuts[0]).toBeGreaterThan(SWEEP_START);
        expect(b.cuts[0]).toBeLessThanOrEqual(SWEEP_END + STEP);
      }
    }
  });

  it('cuts exactly those inside its reach and arc, at every level, up or down and either way across', () => {
    for (const stats of ladder) {
      for (const heading of [DOWN, UP]) {
        for (const rightward of [true, false]) {
          const inside: Body[] = [];
          const outside: Body[] = [];
          // Steps that never land exactly on an edge of the fan.
          for (let angle = -174; angle <= 175; angle += 7) {
            for (const radius of [5, stats.reach * 0.5, stats.reach * 0.97, stats.reach * 1.03, stats.reach * 1.5]) {
              const b = at(heading, angle, radius);
              const within = radius <= stats.reach && Math.abs(angle) <= stats.arc / 2;
              const behindToo = stats.ways >= 2 && radius <= stats.reach && Math.abs(angle) >= 180 - stats.arc / 2;
              (within || behindToo ? inside : outside).push(b);
            }
          }
          const swings = swingSickles(heading, rightward, stats, cfg);
          const all = [...inside, ...outside];
          for (const s of swings) swing(s, all);
          for (const b of inside) expect(b.cuts).toHaveLength(1);
          for (const b of outside) expect(b.cuts).toHaveLength(0);
        }
      }
    }
  });

  it('never cuts to the sides of the hero, at any level', () => {
    for (const stats of ladder) {
      const beside = [body(30, 0), body(-30, 0), body(stats.reach * 0.9, 0), body(-stats.reach * 0.9, 0), body(60, 5)];
      for (const heading of [DOWN, UP]) for (const s of swingSickles(heading, true, stats, cfg)) swing(s, beside);
      for (const b of beside) expect(b.cuts).toHaveLength(0);
    }
  });

  it('reaches less far down the screen than across, as the ground is flattened', () => {
    const [s] = swingSickles(DOWN, true, { ...ladder[2], arc: 180 }, cfg);
    const reach = ladder[2].reach;
    const across = body(reach * 0.99, 0.01);
    const below = body(0, reach * FLATTEN * 0.99);
    const tooLow = body(0, reach * FLATTEN * 1.05);
    swing(s, [across, below, tooLow]);
    expect(across.cuts).toHaveLength(1);
    expect(below.cuts).toHaveLength(1);
    expect(tooLow.cuts).toHaveLength(0);
  });

  it('cuts in the order the blade passes: left first going right, right first going left', () => {
    for (const heading of [DOWN, UP]) {
      for (const rightward of [true, false]) {
        const left = at(heading, -40, 60);
        const middle = at(heading, 0, 60);
        const right = at(heading, 40, 60);
        // Sanity: "left" is on the left of the screen.
        expect(left.x).toBeLessThan(0);
        const [s] = swingSickles(heading, rightward, ladder[0], cfg);
        swing(s, [left, middle, right]);
        const order = rightward ? [left, middle, right] : [right, middle, left];
        expect(order[0].cuts[0]).toBeLessThan(order[1].cuts[0]);
        expect(order[1].cuts[0]).toBeLessThan(order[2].cuts[0]);
      }
    }
  });

  it('cuts each enemy once a swing, however slow the frames', () => {
    for (const dt of [STEP, 0.05]) {
      const bodies = Array.from({ length: 30 }, (_, i) => at(DOWN, -48 + i * 3.3, 20 + i * 2));
      const [s] = swingSickles(DOWN, true, ladder[0], cfg);
      swing(s, bodies, dt);
      for (const b of bodies) expect(b.cuts).toHaveLength(1);
    }
  });

  it('misses an enemy that leaves the fan before the blade gets there', () => {
    // At the far edge of a rightward swing, stepping out of reach a third of the way through the sweep.
    const leaver = at(DOWN, 45, 60);
    const [s] = swingSickles(DOWN, true, ladder[0], cfg);
    swing(s, [leaver], STEP, (b, age) => {
      if (age >= SWEEP_START + cfg.sweep / 3) b.y = 300;
    });
    expect(leaver.cuts).toHaveLength(0);
  });

  it('cuts one stepping into the blade against the swing', () => {
    // Walking left towards a blade coming from the left, at a navia's best speed.
    const walker = at(DOWN, 15, 60);
    const [s] = swingSickles(DOWN, true, ladder[0], cfg);
    swing(s, [walker], STEP, (b) => {
      b.x -= CFG.navia.speedMax * STEP;
    });
    expect(walker.cuts).toHaveLength(1);
  });

  it('reaps up and down at once from level 4, both sweeping the same way across', () => {
    expect(swingSickles(DOWN, true, ladder[2], cfg)).toHaveLength(1);
    const [down, up] = swingSickles(DOWN, true, ladder[3], cfg);
    expect([down.heading, up.heading]).toEqual([DOWN, UP]);
    const above = body(10, -50);
    const below = body(10, 50);
    swing(down, [above, below]);
    expect([above.cuts.length, below.cuts.length]).toEqual([0, 1]);
    swing(up, [above]);
    expect(above.cuts).toHaveLength(1);
    // At the same moment the blades stand at the same place across the screen.
    for (const t of [0.15, 0.25, 0.35]) {
      const a = fanPoint(down.heading, bladeAngle(down, t), 50, FLATTEN);
      const b = fanPoint(up.heading, bladeAngle(up, t), 50, FLATTEN);
      expect(b.x).toBeCloseTo(a.x, 9);
      expect(b.y).toBeCloseTo(-a.y, 9);
    }
    expect(inFan(up, 0, -40, FLATTEN).angle).toBeCloseTo(0, 9);
  });

  it('lays a navia to rest with one cut at every level, and an upyr with three, two or one', () => {
    for (const stats of ladder) expect(stats.damage).toBeGreaterThanOrEqual(CFG.navia.hp);
    expect(ladder.map((stats) => Math.ceil(CFG.upyr.hp / stats.damage))).toEqual([3, 3, 2, 2, 1]);
  });

  it('is gone, trail and all, before the next swing at every level', () => {
    const [s] = swingSickles(DOWN, true, ladder[0], cfg);
    expect(swingOver(s)).toBe(false);
    s.age = SWEEP_END;
    expect(swingOver(s)).toBe(true);
    for (const stats of ladder) expect(swingLife(s, cfg.trail.linger)).toBeLessThan(stats.cooldown);
  });
});

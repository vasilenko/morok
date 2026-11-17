import { describe, expect, it } from 'vitest';
import { CFG } from '../config';
import { bandWidth, groundDistance, newRing, ringDone, ringFront, stepRing, swept, type Ring } from './bell';

const cfg = CFG.bell;
const FLATTEN = CFG.ground.flatten;
const STEP = 1 / 60;

interface Body {
  x: number;
  y: number;
  /** Seconds after the toll it was wounded, each time. */
  hits: number[];
}

/** Tolls at the origin and runs the ring out, wounding the bodies as the scene does: at most once a toll. */
function toll(radius: number, bodies: Body[], dt = STEP, move?: (body: Body, dt: number) => void): Ring {
  const ring = newRing(0, 0, radius);
  const wounded = new Set<Body>();
  while (!ringDone(ring, cfg)) {
    for (const body of bodies) move?.(body, dt);
    const sweep = stepRing(ring, dt, cfg);
    if (!sweep) continue;
    for (const body of bodies) {
      if (wounded.has(body) || !swept(groundDistance(body.x - ring.x, body.y - ring.y, FLATTEN), sweep, cfg)) continue;
      wounded.add(body);
      body.hits.push(ring.age);
    }
  }
  return ring;
}

const body = (x: number, y: number): Body => ({ x, y, hits: [] });

describe('the funeral bell ring', () => {
  it('runs out from the feet to its radius in the spread time, and no further', () => {
    expect(ringFront(0, 110, cfg)).toBe(0);
    expect(ringFront(cfg.spread, 110, cfg)).toBe(110);
    expect(ringFront(cfg.spread * 3, 110, cfg)).toBe(110);
    let last = 0;
    for (let i = 1; i < Math.round(cfg.spread / STEP); i++) {
      const front = ringFront(i * STEP, 110, cfg);
      expect(front).toBeGreaterThan(last);
      expect(front).toBeLessThan(110);
      last = front;
    }
  });

  it('slows as it nears its radius', () => {
    const early = ringFront(0.1, 170, cfg) - ringFront(0, 170, cfg);
    const late = ringFront(cfg.spread, 170, cfg) - ringFront(cfg.spread - 0.1, 170, cfg);
    expect(early).toBeGreaterThan(late * 3);
  });

  it('is flattened on the ground: it reaches as far ahead as across, three quarters as far up and down', () => {
    expect(groundDistance(100, 0, FLATTEN)).toBe(100);
    expect(groundDistance(0, 75, FLATTEN)).toBeCloseTo(100, 9);
    expect(groundDistance(0, -75, FLATTEN)).toBeCloseTo(100, 9);
  });

  it('wounds everyone inside its radius exactly once, and no one outside', () => {
    const inside = [body(10, 0), body(-60, 20), body(0, -80), body(109, 0), body(0, 82)];
    const outside = [body(111, 0), body(0, 83), body(-90, 60), body(300, 0)];
    toll(110, [...inside, ...outside]);
    for (const b of inside) expect(b.hits).toHaveLength(1);
    for (const b of outside) expect(b.hits).toHaveLength(0);
  });

  it('reaches the near before the far, as its front passes them', () => {
    const near = body(20, 0);
    const middle = body(0, -60);
    const far = body(-100, 0);
    toll(110, [near, middle, far]);
    expect(near.hits[0]).toBeLessThan(middle.hits[0]);
    expect(middle.hits[0]).toBeLessThan(far.hits[0]);
    expect(far.hits[0]).toBeLessThanOrEqual(cfg.spread + 1e-9);
  });

  it('misses no one on a slow frame, nor one walking in towards the hero as it passes', () => {
    const bodies = Array.from({ length: 40 }, (_, i) => body(5 + i * 4, (i % 3) * 10));
    toll(170, bodies, 0.05, (b, dt) => {
      // The fastest navia, straight at the hero.
      const d = Math.hypot(b.x, b.y) || 1;
      b.x -= (b.x / d) * 70 * dt;
      b.y -= (b.y / d) * 70 * dt;
    });
    for (const b of bodies) expect(b.hits).toHaveLength(1);
  });

  it('does not wound one who steps inside behind its front', () => {
    // Outside the ring until its front has gone well past where it steps in.
    const late = body(150, 0);
    let clock = 0;
    toll(140, [late], STEP, (b, dt) => {
      clock += dt;
      if (clock >= 0.2) b.x = 60;
    });
    expect(ringFront(0.2, 140, cfg)).toBeGreaterThan(60 + cfg.slack);
    expect(late.hits).toHaveLength(0);
  });

  it('thins as it spreads', () => {
    expect(bandWidth(0, cfg)).toBe(cfg.band[0]);
    expect(bandWidth(1, cfg)).toBe(cfg.band[1]);
    expect(bandWidth(0.5, cfg)).toBeLessThan(cfg.band[0]);
    expect(bandWidth(0.5, cfg)).toBeGreaterThan(cfg.band[1]);
  });

  it('is forgotten once it has run out and lingered', () => {
    const ring = newRing(0, 0, 110);
    let steps = 0;
    while (!ringDone(ring, cfg)) {
      stepRing(ring, STEP, cfg);
      steps++;
    }
    expect(steps * STEP).toBeCloseTo(cfg.spread + cfg.linger, 1);
  });
});

describe('the funeral bell ladder', () => {
  it('lays a navia to rest from level 1, and an upyr at level 5', () => {
    const ladder = CFG.items.bell;
    for (const level of ladder) expect(level.damage).toBeGreaterThanOrEqual(CFG.navia.hp);
    expect(ladder[3].damage).toBeLessThan(CFG.upyr.hp);
    expect(ladder[4].damage).toBeGreaterThanOrEqual(CFG.upyr.hp);
  });
});

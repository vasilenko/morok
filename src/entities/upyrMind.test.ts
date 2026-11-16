import { describe, expect, it } from 'vitest';
import type { UpyrConfig } from '../config';
import { wound } from './enemy';
import { isCommitted, newUpyrMind, stepUpyr, type UpyrMind, type UpyrState } from './upyrMind';

const cfg: UpyrConfig = {
  hp: 30,
  speed: 60,
  radius: 12,
  damage: 12,
  attackRange: 170,
  windUp: 0.6,
  lungeDistance: 260,
  lungeSpeed: 520,
  lungeDamage: 18,
  recover: 0.5,
  cooldown: 2.5,
  appearsAt: 45,
  share: 1 / 8,
  xp: 5,
};

const STEP = 1 / 60;
const HERO_RADIUS = 10;

function setup(heroX: number, heroY = 0) {
  const mind = newUpyrMind();
  const body = { x: 0, y: 0, hp: cfg.hp, radius: cfg.radius, speed: cfg.speed, dead: false };
  const hero = { x: heroX, y: heroY, radius: HERO_RADIUS };
  const strikes: number[] = [];
  let landsHits = true;
  const strike = (damage: number) => {
    if (!landsHits) return false;
    strikes.push(damage);
    return true;
  };
  /** Steps for `seconds`. */
  const run = (seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += STEP) stepUpyr(mind, body, hero, STEP, cfg, strike);
  };
  /** Steps while the mind is in `state`, for `limit` seconds at most. */
  const runWhile = (state: UpyrState, limit = 10) => {
    let steps = 0;
    while (mind.state === state && steps++ < limit / STEP) stepUpyr(mind, body, hero, STEP, cfg, strike);
  };
  return {
    mind,
    body,
    hero,
    strikes,
    run,
    runWhile,
    refuseHits: () => (landsHits = false),
  };
}

/** Drives a fresh upyr into the given state with the hero `heroX` away. */
function inState(state: UpyrState, heroX = 150) {
  const s = setup(heroX);
  const order: UpyrState[] = ['prowl', 'windUp', 'lunge', 'recover'];
  for (const next of order.slice(0, order.indexOf(state))) s.runWhile(next);
  expect(s.mind.state).toBe(state);
  return s;
}

describe('upyr mind', () => {
  it('prowls towards a hero out of range without attacking', () => {
    const { mind, body, run } = setup(400);
    run(1);
    expect(mind.state).toBe('prowl');
    expect(body.x).toBeCloseTo(60, 0);
    expect(body.y).toBe(0);
  });

  it('starts the wind-up once in range', () => {
    const { mind, body, runWhile } = setup(400);
    runWhile('prowl');
    expect(mind.state).toBe('windUp');
    expect(400 - body.x).toBeLessThanOrEqual(cfg.attackRange);
    expect(400 - body.x).toBeGreaterThan(cfg.attackRange - 2);
  });

  it('does not attack in range while on cooldown', () => {
    const { mind, run } = setup(100);
    mind.cooldown = 1;
    run(0.5);
    expect(mind.state).toBe('prowl');
    run(0.55);
    expect(mind.state).toBe('windUp');
  });

  it('holds still for the wind-up, then lunges', () => {
    const { mind, body, run } = setup(150);
    run(STEP);
    expect(mind.state).toBe('windUp');
    const x = body.x;
    run(cfg.windUp - 2 * STEP);
    expect(mind.state).toBe('windUp');
    expect(body.x).toBe(x);
    // A step of slack for the rounding of summed frame times.
    run(3 * STEP);
    expect(mind.state).toBe('lunge');
  });

  it('fixes the lunge direction at its start and covers the distance in a straight line', () => {
    const { mind, body, hero, runWhile } = inState('lunge', 150);
    // The hero steps aside as the lunge begins; the upyr does not follow.
    hero.y = 80;
    const points: { x: number; y: number }[] = [];
    while (mind.state === 'lunge') {
      runWhile('lunge', STEP);
      points.push({ x: body.x, y: body.y });
    }
    expect(mind.state).toBe('recover');
    for (const p of points) expect(p.y).toBe(0);
    expect(body.x).toBeCloseTo(cfg.lungeDistance);
    // At 520 units per second, 260 units take half a second.
    expect(points.length).toBeGreaterThanOrEqual(30);
    expect(points.length).toBeLessThanOrEqual(31);
  });

  it('misses a hero who sidesteps during the wind-up', () => {
    const { hero, strikes, runWhile } = setup(150);
    runWhile('prowl');
    runWhile('windUp', 0.3);
    hero.y = 60;
    runWhile('windUp');
    // The lunge aims at the hero's new spot, so he must step again.
    hero.y = -40;
    runWhile('lunge');
    expect(strikes).toEqual([]);
  });

  it('strikes a standing hero once per lunge and heals to full', () => {
    const { mind, body, strikes, runWhile } = inState('lunge', 150);
    body.hp = 10;
    runWhile('lunge');
    expect(strikes).toEqual([cfg.lungeDamage]);
    expect(mind.struck).toBe(true);
    expect(body.hp).toBe(cfg.hp);
  });

  it('cannot skip over the hero in a long step', () => {
    const { mind, body, hero, strikes } = inState('lunge', 150);
    stepUpyr(mind, body, hero, 0.5, cfg, (damage) => strikes.push(damage) > 0);
    expect(body.x).toBeGreaterThan(hero.x + 30);
    expect(strikes).toEqual([cfg.lungeDamage]);
  });

  it('neither strikes nor heals when the hero shrugs the hit off', () => {
    const { body, strikes, runWhile, refuseHits } = inState('lunge', 150);
    body.hp = 10;
    refuseHits();
    runWhile('lunge');
    expect(strikes).toEqual([]);
    expect(body.hp).toBe(10);
  });

  it('recovers motionless, then waits out the cooldown before attacking again', () => {
    const { mind, body, hero, run, runWhile } = inState('recover', 150);
    // Put the hero in range for the whole test, behind the upyr.
    hero.x = body.x - 100;
    const x = body.x;
    run(cfg.recover - 2 * STEP);
    expect(mind.state).toBe('recover');
    expect(body.x).toBe(x);
    // A step of slack for the rounding of summed frame times.
    run(3 * STEP);
    expect(mind.state).toBe('prowl');
    expect(mind.cooldown).toBeCloseTo(cfg.cooldown, 1);
    run(cfg.cooldown - 0.1);
    expect(mind.state).toBe('prowl');
    runWhile('prowl', 0.2);
    expect(mind.state).toBe('windUp');
  });

  it('commits during wind-up, lunge and recovery only', () => {
    const states: UpyrState[] = ['prowl', 'windUp', 'lunge', 'recover'];
    const committed = states.map((state) => isCommitted({ ...newUpyrMind(), state } as UpyrMind));
    expect(committed).toEqual([false, true, true, true]);
  });

  it('is not interrupted by a stake hit in the wind-up', () => {
    const { mind, body, run } = inState('windUp', 150);
    const before = { ...mind };
    expect(wound(body, 10)).toBe(false);
    expect(mind).toEqual(before);
    run(cfg.windUp);
    expect(mind.state).toBe('lunge');
  });

  it('is not interrupted by a stake hit in the lunge', () => {
    const { mind, body, run, runWhile } = inState('lunge', 150);
    run(0.1);
    const dir = { x: mind.dirX, y: mind.dirY };
    expect(wound(body, 10)).toBe(false);
    expect(mind.state).toBe('lunge');
    runWhile('lunge');
    expect({ x: mind.dirX, y: mind.dirY }).toEqual(dir);
    expect(mind.travelled).toBeCloseTo(cfg.lungeDistance);
  });

  it.each<UpyrState>(['prowl', 'windUp', 'lunge', 'recover'])('dies to three stake hits while in %s', (state) => {
    const { mind, body, hero, strikes } = inState(state, 150);
    expect(wound(body, 10)).toBe(false);
    expect(wound(body, 10)).toBe(false);
    expect(wound(body, 10)).toBe(true);
    expect(body.dead).toBe(true);
    // The dead neither move nor strike.
    const at = { x: body.x, y: body.y, struck: strikes.length };
    stepUpyr(mind, body, hero, 0.5, cfg, (damage) => strikes.push(damage) > 0);
    expect({ x: body.x, y: body.y, struck: strikes.length }).toEqual(at);
  });
});

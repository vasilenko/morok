import { describe, expect, it } from 'vitest';
import type { UtopetsConfig } from '../config';
import {
  isCommitted,
  newUtopetsMind,
  riseStage,
  stepUtopets,
  touchHurts,
  walkIn,
  type UtopetsState,
} from './utopetsMind';

const cfg: UtopetsConfig = {
  hp: 60,
  speed: 30,
  radius: 14,
  damage: 12,
  knockback: 0.35,
  rise: 0.9,
  riseNear: 180,
  riseFar: 420,
  riseHold: 1.5,
  graspRange: 46,
  windUp: 0.55,
  graspDistance: 34,
  graspTime: 0.18,
  graspDamage: 20,
  recover: 0.6,
  cooldown: 2.0,
  appearsAt: 90,
  share: 1 / 10,
  xp: 15,
};

const STEP = 1 / 60;
const HERO_RADIUS = 10;

function setup(heroX: number, heroY = 0) {
  const mind = newUtopetsMind();
  const body = { x: 0, y: 0, radius: cfg.radius, speed: cfg.speed, dead: false };
  const hero = { x: heroX, y: heroY, radius: HERO_RADIUS };
  const strikes: number[] = [];
  let landsHits = true;
  const strike = (damage: number) => {
    if (!landsHits) return false;
    strikes.push(damage);
    return true;
  };
  const step = () => stepUtopets(mind, body, hero, STEP, cfg, strike);
  /** Steps for `seconds`. */
  const run = (seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += STEP) step();
  };
  /** Steps while the mind is in `state`, for `limit` seconds at most; returns the seconds it stayed. */
  const runWhile = (state: UtopetsState, limit = 10) => {
    let steps = 0;
    while (mind.state === state && steps < limit / STEP) {
      step();
      steps++;
    }
    return steps * STEP;
  };
  return { mind, body, hero, strikes, run, runWhile, refuseHits: () => (landsHits = false) };
}

/** Drives a fresh utopets into the given state with the hero `heroX` away. */
function inState(state: UtopetsState, heroX = 40) {
  const s = setup(heroX);
  const order: UtopetsState[] = ['rise', 'walk', 'windUp', 'grasp', 'recover'];
  for (const next of order.slice(0, order.indexOf(state))) s.runWhile(next);
  expect(s.mind.state).toBe(state);
  return s;
}

describe('utopets mind', () => {
  it('rises in place for the rise time, through two poses, harmless and held still', () => {
    const { mind, body, runWhile } = setup(30);
    expect(mind.state).toBe('rise');
    expect(touchHurts(mind)).toBe(false);
    expect(isCommitted(mind)).toBe(true);
    expect(riseStage(mind, cfg)).toBe(1);
    const s = setup(30);
    s.run(cfg.rise * 0.6);
    expect(riseStage(s.mind, cfg)).toBe(2);
    expect(runWhile('rise')).toBeCloseTo(cfg.rise, 1);
    expect(body.x).toBe(0);
    expect(mind.state).toBe('walk');
    expect(touchHurts(mind)).toBe(true);
    expect(isCommitted(mind)).toBe(false);
  });

  it('walks in already standing when there is no water to rise out of', () => {
    const { mind, body, run } = setup(400);
    walkIn(mind);
    expect(mind.state).toBe('walk');
    expect(touchHurts(mind)).toBe(true);
    expect(isCommitted(mind)).toBe(false);
    run(1);
    expect(body.x).toBeCloseTo(cfg.speed, 0);
  });

  it('does not grasp while rising, even with the hero beside him', () => {
    const { strikes, runWhile } = setup(20);
    runWhile('rise');
    expect(strikes).toEqual([]);
  });

  it('walks towards a hero out of reach at his walking speed', () => {
    const { mind, body, run, runWhile } = setup(400);
    runWhile('rise');
    run(1);
    expect(mind.state).toBe('walk');
    expect(body.x).toBeCloseTo(cfg.speed, 0);
  });

  it('winds up once within the grasp range, aimed at where the hero stands then', () => {
    const { mind, body, hero, runWhile } = setup(200, 50);
    runWhile('rise');
    runWhile('walk', 20);
    expect(mind.state).toBe('windUp');
    const distance = Math.hypot(hero.x - body.x, hero.y - body.y);
    expect(distance).toBeLessThanOrEqual(cfg.graspRange);
    expect(distance).toBeGreaterThan(cfg.graspRange - 1);
    expect(mind.dirX).toBeCloseTo((hero.x - body.x) / distance);
    expect(mind.dirY).toBeCloseTo((hero.y - body.y) / distance);
  });

  it('stands still through the wind-up for the tell', () => {
    const s = inState('windUp');
    const { x, y } = s.body;
    expect(s.runWhile('windUp')).toBeCloseTo(cfg.windUp, 1);
    expect(s.body).toMatchObject({ x, y });
    expect(s.mind.state).toBe('grasp');
    expect(touchHurts(s.mind)).toBe(false);
  });

  it('lunges the grasp distance in the grasp time and strikes a hero standing still once', () => {
    const s = inState('grasp', 46);
    const start = s.body.x;
    expect(s.runWhile('grasp')).toBeCloseTo(cfg.graspTime, 1);
    expect(s.body.x - start).toBeCloseTo(cfg.graspDistance);
    expect(s.strikes).toEqual([cfg.graspDamage]);
    expect(s.mind.state).toBe('recover');
  });

  it('misses a hero who steps aside during the wind-up', () => {
    const s = inState('windUp', 46);
    // He walks off up the screen as the arm goes up.
    s.hero.y = -100;
    s.runWhile('windUp');
    s.runWhile('grasp');
    expect(s.strikes).toEqual([]);
    expect(s.body.y).toBe(0);
  });

  it('strikes later in the grasp when the hero was still invulnerable as it began', () => {
    const s = inState('grasp', 30);
    s.refuseHits();
    s.run(STEP);
    expect(s.strikes).toEqual([]);
    const strike = (damage: number) => (s.strikes.push(damage), true);
    while (s.mind.state === 'grasp') stepUtopets(s.mind, s.body, s.hero, STEP, cfg, strike);
    expect(s.strikes).toEqual([cfg.graspDamage]);
  });

  it('holds still to recover, then may not grasp again until the cooldown is over', () => {
    const s = inState('recover', 46);
    const { x } = s.body;
    expect(s.runWhile('recover')).toBeCloseTo(cfg.recover, 1);
    expect(s.body.x).toBe(x);
    expect(s.mind.state).toBe('walk');
    // The hero is well within reach, yet he only walks for the cooldown.
    expect(s.runWhile('walk')).toBeCloseTo(cfg.cooldown, 1);
    expect(s.mind.state).toBe('windUp');
  });

  it('is held in place while rising and to his course from the wind-up to the end of the recovery', () => {
    const s = setup(40);
    const seen = new Map<UtopetsState, boolean>();
    for (let i = 0; i < 300; i++) {
      stepUtopets(s.mind, s.body, s.hero, STEP, cfg, () => true);
      seen.set(s.mind.state, isCommitted(s.mind));
    }
    expect(Object.fromEntries(seen)).toEqual({ rise: true, walk: false, windUp: true, grasp: true, recover: true });
  });

  it('does nothing once dead', () => {
    const { mind, body, run } = setup(40);
    body.dead = true;
    run(2);
    expect(mind.state).toBe('rise');
    expect(mind.time).toBe(0);
  });
});

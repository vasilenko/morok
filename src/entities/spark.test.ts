import { describe, expect, it } from 'vitest';
import type { SparkConfig } from '../config';
import { addSpark, dropSpark, dropWorth, sparkGrade, stepSpark, sweepSparks, type Point, type Spark } from './spark';

const cfg: SparkConfig = {
  cap: 600,
  grades: [1, 5, 15, 40],
  randomGrade: false,
  pickupRadius: 60,
  pickupDelay: 0.25,
  popDistance: 14,
  popHeight: 8,
  settle: 0.35,
  hover: 4,
  pull: {
    startSpeed: 15,
    acceleration: 200,
    maxSpeed: 600,
    curve: 40,
    waver: 18,
    waverRate: 2.5,
    steer: 6000,
    brake: 0.5,
    turnDelay: 0.1,
    restless: 0.4,
    arrive: 4,
    widenAfter: 1,
    widen: 40,
  },
};

const STEP = 1 / 60;
/** The hero's walking speed. */
const HERO_SPEED = 175;
/** Where the skull's eye is relative to the hero's position. */
const EYE = { x: 24, y: -21 };

const eyeOf = (hero: Point): Point => ({ x: hero.x + EYE.x, y: hero.y + EYE.y });

/** A spark dropped at (x, y) popping to the right, already settled. */
function lyingSpark(x: number, y: number, worth = 1): Spark {
  const spark = dropSpark(x, y, 18, worth, 0, 1, 0, cfg);
  const far = { x: x + 1e6, y };
  while (spark.state === 'settling') stepSpark(spark, far, eyeOf(far), STEP, cfg);
  return spark;
}

/** Steps for `seconds` with the hero standing still; returns the worth credited. */
function run(spark: Spark, hero: Point, seconds: number): number {
  let credited = 0;
  for (let t = 0; t < seconds - 1e-9; t += STEP) {
    credited += stepSpark(spark, hero, eyeOf(hero), STEP, cfg);
  }
  return credited;
}

describe('a dropped spark', () => {
  it('pops a short way out from the corpse and comes down to the ground', () => {
    const spark = dropSpark(100, 50, 18, 1, Math.PI / 2, 1, 0, cfg);
    expect(spark.lift).toBe(18);
    run(spark, { x: 1e6, y: 0 }, 1);
    expect(spark.state).toBe('lying');
    expect(spark.lift).toBe(0);
    expect(spark.x).toBeCloseTo(100);
    expect(spark.y).toBeCloseTo(50 + cfg.popDistance);
  });

  it('lies still while the hero stays outside the pickup radius', () => {
    const spark = lyingSpark(0, 0);
    const hero = { x: spark.x + cfg.pickupRadius + 1, y: 0 };
    expect(run(spark, hero, 10)).toBe(0);
    expect(spark.state).toBe('lying');
    expect(spark.x).toBe(cfg.popDistance);
    expect(spark.y).toBe(0);
  });

  it('starts being pulled once the hero is inside the radius', () => {
    const spark = lyingSpark(0, 0);
    stepSpark(spark, { x: spark.x + cfg.pickupRadius - 1, y: 0 }, { x: 200, y: 0 }, STEP, cfg);
    expect(spark.state).toBe('pulled');
  });

  it('cannot be pulled during the first moment, even right under the hero', () => {
    const spark = dropSpark(0, 0, 18, 1, 0, 1, 0, cfg);
    const hero = { x: 0, y: 0 };
    let t = 0;
    while (t + STEP < cfg.pickupDelay - 1e-9) {
      stepSpark(spark, hero, eyeOf(hero), STEP, cfg);
      t += STEP;
      expect(spark.state).toBe('settling');
    }
    run(spark, hero, 2 * STEP);
    expect(spark.state).toBe('pulled');
  });

  it('leaves the ground from where it is drawn', () => {
    const spark = lyingSpark(0, 0);
    stepSpark(spark, { x: 0, y: 0 }, { x: spark.x, y: -1000 }, 0, cfg);
    expect(spark.state).toBe('pulled');
    expect(spark.y).toBe(-cfg.hover);
  });
});

/** Where the skull's eye is relative to the hero, facing right; mirrored when he faces left. */
const SKULL = { x: 23.6, y: -21 };
/** How far the eye bobs as the hero walks, and every how many steps it moves. */
const BOB = { height: 1.5, steps: 5 };

/** Which way the hero walks on a step of a scripted motion: components in -1..1, as from the keys. */
type Motion = (step: number) => readonly [number, number];

const KEYS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/**
 * Hero motions as a player makes them with the keys, one direction per step:
 * the hero faces the way he last walked sideways, so his eye swaps sides of
 * him when he turns, and it bobs while he walks. Each starts facing right.
 */
const motions: Record<string, Motion> = {
  standing: () => [0, 0],
  'running away': () => [-1, 0],
  'running towards': () => [1, 0],
  'running past': () => [0, 1],
  'doubling back': (step) => (step < 15 ? [-1, 0] : [1, 0]),
  'turning every 6 steps': (step) => (Math.floor(step / 6) % 2 ? [1, 0] : [-1, 0]),
  'turning every 3 steps': (step) => (Math.floor(step / 3) % 2 ? [1, 0] : [-1, 0]),
  'turning every 20 steps': (step) => (Math.floor(step / 20) % 2 ? [1, 0] : [-1, 0]),
  'zig-zagging': (step) => (Math.floor(step / 10) % 2 ? [-1, 1] : [-1, -1]),
  'circling on the keys': (step) => KEYS[Math.floor(step / 6) % 8],
  'circling wide': (step) => {
    const angle = (HERO_SPEED / 40) * step * STEP;
    return [-Math.sin(angle), Math.cos(angle)];
  },
};

interface Flight {
  /** Seconds from being drawn in to being drunk in, or Infinity. */
  time: number;
  credited: number;
  /** Where it was at the end of every step it flew. */
  path: Point[];
  /** Distance to the eye at the end of every step it flew. */
  gaps: number[];
  /** Where the eye was at the end of every step it flew. */
  eyes: Point[];
  /** The last step on which the eye swapped sides of the hero, -1 if it never did. */
  lastTurn: number;
}

/**
 * Flies a spark that lies just inside the pickup radius from the hero
 * towards `angle` (radians), drawn in as he starts on `motion` facing
 * `facing`, for at most three seconds.
 */
function fly(motion: Motion, angle: number, curl: number, phase: number, facing = 1): Flight {
  const distance = cfg.pickupRadius - 1;
  const hero = { x: 0, y: 0 };
  let bob = 0;
  const eye = () => ({ x: hero.x + facing * SKULL.x, y: hero.y + SKULL.y + bob });
  const lying = dropSpark(Math.cos(angle) * distance, Math.sin(angle) * distance, 18, 3, 0, curl, phase, cfg);
  const spark: Spark = { ...lying, state: 'lying', age: 1, lift: 0 };
  let credited = stepSpark(spark, hero, eye(), 0, cfg);
  expect(spark.state).toBe('pulled');
  const path: Point[] = [];
  const gaps: number[] = [];
  const eyes: Point[] = [];
  let lastTurn = -1;
  let step = 0;
  while (spark.state === 'pulled' && step < 3 / STEP) {
    const [dx, dy] = motion(step);
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      hero.x += (dx / length) * HERO_SPEED * STEP;
      hero.y += (dy / length) * HERO_SPEED * STEP;
    }
    if (Math.abs(dx) > 1e-9 && Math.sign(dx) !== facing) {
      facing = Math.sign(dx);
      lastTurn = step;
    }
    bob = length > 0 && Math.floor(step / BOB.steps) % 2 ? BOB.height : 0;
    credited += stepSpark(spark, hero, eye(), STEP, cfg);
    step++;
    path.push({ x: spark.x, y: spark.y });
    eyes.push(eye());
    gaps.push(Math.hypot(eye().x - spark.x, eye().y - spark.y));
  }
  return { time: spark.state === 'absorbed' ? step * STEP : Infinity, credited, path, gaps, eyes, lastTurn };
}

/** Every start the flights are tried from: round the hero, curving either way, wavering out of step. */
const starts: [number, number, number][] = [];
for (let degrees = 0; degrees < 360; degrees += 30) {
  for (const curl of [1, -1]) for (const phase of [0, 2, 4]) starts.push([(degrees * Math.PI) / 180, curl, phase]);
}

describe('a pulled spark', () => {
  for (const [name, motion] of Object.entries(motions)) {
    describe(`with the hero ${name}`, () => {
      const flights = starts.map(([angle, curl, phase]) => fly(motion, angle, curl, phase));

      it('is drunk in, and credited once', () => {
        for (const flight of flights) {
          expect(flight.time).toBeLessThan(Infinity);
          expect(flight.credited).toBe(3);
        }
      });

      it(name === 'standing' ? 'takes about 0.7 s' : 'takes well under 1.2 s', () => {
        for (const flight of flights) {
          if (name === 'standing') expect(flight.time).toBeGreaterThan(0.6);
          expect(flight.time).toBeLessThan(name === 'standing' ? 0.9 : 1.2);
        }
      });

      it('never changes its velocity by more than 100 units a second in a step', () => {
        // `steer` (6000 units a second, each second) over a 60th of a second.
        const bound = cfg.pull.steer * STEP;
        for (const { path } of flights) {
          // The velocity of each step from where it was before and after;
          // the last step is the one into the socket.
          for (let i = 2; i < path.length - 1; i++) {
            const dvx = (path[i].x - 2 * path[i - 1].x + path[i - 2].x) / STEP;
            const dvy = (path[i].y - 2 * path[i - 1].y + path[i - 2].y) / STEP;
            expect(Math.hypot(dvx, dvy)).toBeLessThanOrEqual(bound + 1e-6);
          }
        }
      });

      it('never circles the eye', () => {
        for (const { path, eyes, gaps, lastTurn } of flights) {
          // Once the hero has stopped turning and it has had time to follow
          // the eye, it closes in on it every tenth of a second; going round
          // the eye would open the gap again.
          const settled = lastTurn + 1 + Math.ceil(cfg.pull.restless / STEP);
          const window = Math.round(0.1 / STEP);
          for (let i = settled; i + window < gaps.length; i++) expect(gaps[i + window]).toBeLessThan(gaps[i]);
          // Seen from the eye, it comes round by well under half a turn.
          let winding = 0;
          for (let i = Math.max(1, settled); i < path.length - 1 && gaps[i] > 2 * cfg.pull.arrive; i++) {
            const before = Math.atan2(path[i - 1].y - eyes[i - 1].y, path[i - 1].x - eyes[i - 1].x);
            const after = Math.atan2(path[i].y - eyes[i].y, path[i].x - eyes[i].x);
            winding += Math.atan2(Math.sin(after - before), Math.cos(after - before));
          }
          expect(Math.abs(winding)).toBeLessThan(Math.PI / 2);
        }
      });
    });
  }

  it('keeps up with a hero running straight away from it, taking about as long as when he stands', () => {
    for (const [angle, curl, phase] of starts) {
      const away = [-Math.cos(angle), -Math.sin(angle)] as const;
      // Already facing the way he runs, so his eye stays where it is on him.
      const facing = away[0] < -1e-9 ? -1 : 1;
      const standing = fly(motions.standing, angle, curl, phase, facing).time;
      const running = fly(() => away, angle, curl, phase, facing).time;
      expect(Math.abs(running - standing)).toBeLessThan(0.1);
    }
  });

  it('swings round in an arc when the hero turns, without a jump', () => {
    // The hero faces right and turns left as the spark is half way.
    const { path } = fly((step) => (step < 20 ? [0, 0] : [-1, 0]), Math.PI / 2, 1, 0);
    for (let i = 1; i < path.length - 1; i++) {
      expect(Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)).toBeLessThan(8);
    }
  });

  it('wavers to and fro on its way', () => {
    const spark = lyingSpark(0, 0);
    const hero = { x: spark.x, y: 0 };
    const eye = { x: spark.x, y: -60 };
    // The sideways step, against the straight line to the eye, swings back and forth.
    const sideways: number[] = [];
    while (spark.state !== 'absorbed') {
      const [x, y] = [spark.x, spark.y];
      stepSpark(spark, hero, eye, STEP, cfg);
      const [ux, uy] = [(eye.x - x) / Math.hypot(eye.x - x, eye.y - y), (eye.y - y) / Math.hypot(eye.x - x, eye.y - y)];
      sideways.push(((spark.x - x) * -uy + (spark.y - y) * ux) / Math.hypot(spark.x - x, spark.y - y));
    }
    const swings = sideways.slice(1).filter((s, i) => Math.sign(s - sideways[i]) !== Math.sign(sideways[i + 1] - s));
    expect(swings.length).toBeGreaterThanOrEqual(2);
  });

  it('curves rather than flying straight', () => {
    const spark = lyingSpark(0, 0);
    const hero = { x: spark.x, y: 0 };
    const eye = { x: spark.x, y: -50 };
    let widest = 0;
    while (spark.state !== 'absorbed') {
      stepSpark(spark, hero, eye, STEP, cfg);
      widest = Math.max(widest, Math.abs(spark.x - eye.x));
    }
    expect(widest).toBeGreaterThan(2);
  });

  it('is credited exactly once', () => {
    const spark = lyingSpark(0, 0, 5);
    const credited = run(spark, { x: 0, y: 0 }, 5);
    expect(credited).toBe(5);
    expect(spark.state).toBe('absorbed');
    expect(stepSpark(spark, { x: 0, y: 0 }, { x: 0, y: 0 }, STEP, cfg)).toBe(0);
  });
});

describe('the field of sparks', () => {
  it('pours the oldest lying spark into the newest at the cap, losing no worth', () => {
    const field: Spark[] = [];
    const cap = 600;
    let dropped = 0;
    let merges = 0;
    for (let i = 0; i < 700; i++) {
      const worth = i % 8 === 0 ? 5 : 1;
      dropped += worth;
      if (addSpark(field, lyingSpark(i * 3, 0, worth), cap)) merges++;
    }
    expect(field.length).toBe(cap);
    expect(merges).toBe(100);
    expect(field.reduce((sum, s) => sum + s.worth, 0)).toBe(dropped);
    // The oldest went, and the newest carries their worth.
    expect(field[0].x).toBe(100 * 3 + cfg.popDistance);
    expect(field[field.length - 1].worth).toBeGreaterThan(1);
  });

  it('keeps a spark in flight and merges the oldest one on the ground', () => {
    const field: Spark[] = [lyingSpark(0, 0, 2), lyingSpark(10, 0, 3)];
    field[0].state = 'pulled';
    const merged = addSpark(field, lyingSpark(20, 0, 1), 2);
    expect(merged?.worth).toBe(3);
    expect(field.map((s) => s.worth)).toEqual([2, 4]);
  });

  it('sweeps the absorbed sparks, keeping the order of the rest', () => {
    const field = [lyingSpark(0, 0, 1), lyingSpark(10, 0, 2), lyingSpark(20, 0, 3)];
    field[1].state = 'absorbed';
    const gone: Spark[] = [];
    sweepSparks(field, (s) => gone.push(s));
    expect(field.map((s) => s.worth)).toEqual([1, 3]);
    expect(gone.map((s) => s.worth)).toEqual([2]);
  });
});

describe('the grade of a spark', () => {
  it('is the highest threshold its worth reaches', () => {
    const grades = (worths: number[]) => worths.map((w) => sparkGrade(w, cfg.grades));
    expect(grades([1, 4, 5, 14, 15, 39, 40, 1000])).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('is the lowest for a worth below every threshold', () => {
    expect(sparkGrade(0.5, cfg.grades)).toBe(0);
  });

  it('climbs as merges pour worth into a spark', () => {
    const field: Spark[] = [];
    const seen: number[] = [];
    for (let i = 0; i < 60; i++) {
      addSpark(field, lyingSpark(i, 0, 1), 1);
      const grade = sparkGrade(field[0].worth, cfg.grades);
      if (grade !== seen[seen.length - 1]) seen.push(grade);
    }
    expect(field[0].worth).toBe(60);
    expect(seen).toEqual([0, 1, 2, 3]);
  });
});

describe('the worth of a dropped spark', () => {
  it("is the kind's xp while grades are not random", () => {
    expect([0, 0.5, 0.99].map((roll) => dropWorth(false, 5, roll, cfg.grades))).toEqual([5, 5, 5]);
  });

  it('is the threshold of a grade picked by the roll while they are', () => {
    const rolls = [0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 0.999, 1];
    expect(rolls.map((roll) => dropWorth(true, 5, roll, cfg.grades))).toEqual([1, 1, 5, 5, 15, 15, 40, 40, 40]);
  });
});

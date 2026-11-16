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
  pull: { startSpeed: 15, acceleration: 200, maxSpeed: 600, curve: 40, waver: 18, waverRate: 2.5, arrive: 2 },
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

describe('a pulled spark', () => {
  /** Hero paths at walking speed, as functions of time, all starting at the origin. */
  const paths: Record<string, (t: number) => Point> = {
    standing: () => ({ x: 0, y: 0 }),
    'running away': (t) => ({ x: -HERO_SPEED * t, y: 0 }),
    'running past': (t) => ({ x: 0, y: HERO_SPEED * t }),
    circling: (t) => ({ x: 40 * Math.cos((HERO_SPEED / 40) * t) - 40, y: 40 * Math.sin((HERO_SPEED / 40) * t) }),
  };

  for (const [name, path] of Object.entries(paths)) {
    for (const curl of [1, -1]) {
      it(`reaches the moving eye within a second, the hero ${name}, curving ${curl > 0 ? 'one' : 'the other'} way`, () => {
        const dropped = dropSpark(cfg.pickupRadius - 5, 10, 18, 3, 0, curl, 0, cfg);
        const spark: Spark = { ...dropped, state: 'lying', age: 1, lift: 0 };
        let credited = 0;
        let t = 0;
        let gaps: number[] = [];
        while (spark.state !== 'absorbed' && t < 1) {
          const hero = path(t);
          credited += stepSpark(spark, hero, eyeOf(hero), STEP, cfg);
          if (spark.state === 'pulled') gaps.push(spark.gap);
          t += STEP;
        }
        expect(spark.state).toBe('absorbed');
        expect(credited).toBe(3);
        // Once it is fast, every step closes in on the eye.
        gaps = gaps.slice(Math.ceil(0.3 / STEP));
        for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThan(gaps[i - 1]);
      });
    }
  }

  it('takes long enough to be seen from anywhere on the edge of the radius, as long when the hero runs away', () => {
    for (let degrees = 0; degrees < 360; degrees += 30) {
      const angle = (degrees * Math.PI) / 180;
      const [x, y] = [Math.cos(angle) * (cfg.pickupRadius - 0.1), Math.sin(angle) * (cfg.pickupRadius - 0.1)];
      const times = [0, HERO_SPEED].map((speed) => {
        const spark: Spark = { ...dropSpark(x, y, 18, 1, 0, 1, 0, cfg), state: 'lying', age: 1, lift: 0 };
        let t = 0;
        while (spark.state !== 'absorbed') {
          const hero = { x: -Math.cos(angle) * speed * t, y: -Math.sin(angle) * speed * t };
          stepSpark(spark, hero, eyeOf(hero), STEP, cfg);
          t += STEP;
        }
        return t;
      });
      expect(times[0]).toBeGreaterThan(0.6);
      expect(times[0]).toBeLessThan(0.9);
      expect(times[1]).toBeCloseTo(times[0], 1);
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

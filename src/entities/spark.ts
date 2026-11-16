import type { SparkConfig } from '../config';

/**
 * A spark left by a creature laid to rest, as pure logic: it pops out of the
 * corpse and settles on the ground, lies there until the hero comes near,
 * is drawn into the skull's eye socket on a curving, quickening flight and
 * is absorbed on arrival.
 */
export type SparkState = 'settling' | 'lying' | 'pulled' | 'absorbed';

export interface Spark {
  state: SparkState;
  /**
   * The ground point it lies on, or is settling towards, while on the
   * ground; once pulled, the point in the air where it is drawn.
   */
  x: number;
  y: number;
  /** Height above the ground point during the pop, 0 once settled. */
  lift: number;
  /** Experience it is worth. */
  worth: number;
  /** Seconds since it was dropped. */
  age: number;
  /** Seconds since it was pulled. */
  flight: number;
  /** Which way its flight curves: 1 or -1. */
  curl: number;
  /** Distance to the eye at the last step of its flight. */
  gap: number;
  /** Where the eye was at the last step of its flight. */
  eyeX: number;
  eyeY: number;
  /** Distance to the eye when it was drawn in. */
  reach: number;
  /** Per-spark offset for its glow, its wings and the waver of its flight, so the sparks do not move in step. */
  phase: number;
  /** Where the pop started and how far it goes, along the ground. */
  fromX: number;
  fromY: number;
  popX: number;
  popY: number;
  /** Height above the ground where the pop started: the middle of the corpse's body. */
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A new spark worth `worth`, dropped from a corpse standing on the ground
 * point (x, y) with its body `height` above it. It pops towards `angle`
 * (radians), and `curl` (1 or -1) picks the side its flight curves to.
 */
export function dropSpark(
  x: number,
  y: number,
  height: number,
  worth: number,
  angle: number,
  curl: number,
  phase: number,
  cfg: SparkConfig,
): Spark {
  return {
    state: 'settling',
    x,
    y,
    lift: height,
    worth,
    age: 0,
    flight: 0,
    curl: curl < 0 ? -1 : 1,
    gap: Infinity,
    eyeX: 0,
    eyeY: 0,
    reach: 0,
    phase,
    fromX: x,
    fromY: y,
    popX: Math.cos(angle) * cfg.popDistance,
    popY: Math.sin(angle) * cfg.popDistance,
    height,
  };
}

/**
 * Advances the spark by `dt` seconds. `hero` is the hero's position, which
 * decides when it is pulled; `eye` is the skull's eye socket it flies to.
 * Returns the worth to credit: the spark's worth on the step it is absorbed,
 * 0 on every other step, so it is credited exactly once.
 */
export function stepSpark(spark: Spark, hero: Point, eye: Point, dt: number, cfg: SparkConfig): number {
  if (spark.state === 'absorbed') return 0;
  spark.age += dt;
  if (spark.state === 'settling') settle(spark, cfg);
  if (spark.state !== 'pulled' && canBePulled(spark, hero, cfg)) startPull(spark, eye, cfg);
  if (spark.state === 'pulled') return fly(spark, eye, dt, cfg);
  return 0;
}

/**
 * The grade of fire a spark worth `worth` burns with: the index of the
 * highest threshold in `grades` (ascending) that the worth reaches, 0 if it
 * reaches none.
 */
export function sparkGrade(worth: number, grades: readonly number[]): number {
  let grade = 0;
  for (let i = 1; i < grades.length; i++) if (worth >= grades[i]) grade = i;
  return grade;
}

/**
 * The worth of the spark an enemy whose kind is worth `xp` leaves. With
 * `randomGrade` on (CFG.spark.randomGrade) it ignores the kind: it is the
 * threshold of a grade picked by `roll` (0..1, uniform) from `grades`.
 */
export function dropWorth(randomGrade: boolean, xp: number, roll: number, grades: readonly number[]): number {
  if (!randomGrade || grades.length === 0) return xp;
  return grades[Math.min(grades.length - 1, Math.floor(roll * grades.length))];
}

/**
 * Adds a new spark to the field. At the cap, the oldest spark still on the
 * ground is taken off the field and its worth poured into the new one (the
 * oldest in flight if every spark is flying), so worth is never lost.
 * Returns the spark taken off, if any. The field is kept in drop order.
 */
export function addSpark<T extends Spark>(field: T[], spark: T, cap: number): T | null {
  let merged: T | null = null;
  if (field.length >= Math.max(1, cap)) {
    let oldest = field.findIndex((s) => s.state === 'settling' || s.state === 'lying');
    if (oldest < 0) oldest = 0;
    merged = field.splice(oldest, 1)[0];
    spark.worth += merged.worth;
  }
  field.push(spark);
  return merged;
}

/** Drops the absorbed sparks from the field, keeping its order, and hands each to `gone`. */
export function sweepSparks<T extends Spark>(field: T[], gone: (spark: T) => void): void {
  let kept = 0;
  for (const spark of field) {
    if (spark.state === 'absorbed') gone(spark);
    else field[kept++] = spark;
  }
  field.length = kept;
}

/** The pop: out along the ground, easing to a stop, and down from the body with a hop. */
function settle(spark: Spark, cfg: SparkConfig): void {
  const s = cfg.settle > 0 ? Math.min(1, spark.age / cfg.settle) : 1;
  const along = 1 - (1 - s) * (1 - s);
  spark.x = spark.fromX + spark.popX * along;
  spark.y = spark.fromY + spark.popY * along;
  spark.lift = (1 - s) * spark.height + 4 * cfg.popHeight * s * (1 - s);
  if (s >= 1) {
    spark.state = 'lying';
    spark.lift = 0;
  }
}

function canBePulled(spark: Spark, hero: Point, cfg: SparkConfig): boolean {
  if (spark.age < cfg.pickupDelay) return false;
  const dx = hero.x - spark.x;
  const dy = hero.y - spark.y;
  return dx * dx + dy * dy <= cfg.pickupRadius * cfg.pickupRadius;
}

/**
 * A spark drawn in from nearer the eye than the pickup radius flies slower,
 * so every flight takes about as long; this is the slowest, as a share of
 * the pull's speeds.
 */
const MIN_PACE = 0.25;

/** Leaves the ground from where it is drawn, so the flight starts without a jump. */
function startPull(spark: Spark, eye: Point, cfg: SparkConfig): void {
  spark.state = 'pulled';
  spark.y -= cfg.hover + spark.lift;
  spark.lift = 0;
  spark.flight = 0;
  spark.eyeX = eye.x;
  spark.eyeY = eye.y;
  spark.reach = Math.hypot(eye.x - spark.x, eye.y - spark.y);
}

/**
 * One step of the flight. The eye carries the spark along with it, but for
 * the part of its move that comes towards the spark, so however the hero
 * runs, he never gets further from it, and running at it brings it in
 * sooner. On top of that it flies at the eye, at a pace set by how far it
 * had to go when it was drawn in, turned aside by an angle that
 * shrinks with the distance left, so the path is a curve that straightens
 * as it arrives, and that wavers to and fro like a moth's. The turn is
 * always well short of square, so with no momentum to carry it past, and
 * its speed always rising, every step brings it closer: it can neither
 * overshoot nor circle the eye.
 */
function fly(spark: Spark, eye: Point, dt: number, cfg: SparkConfig): number {
  const pull = cfg.pull;
  spark.flight += dt;

  let dx = eye.x - spark.x;
  let dy = eye.y - spark.y;
  let distance = Math.hypot(dx, dy);
  if (distance > 0) {
    const mx = eye.x - spark.eyeX;
    const my = eye.y - spark.eyeY;
    const towards = Math.min(0, (mx * dx + my * dy) / distance);
    spark.x += mx - (towards * dx) / distance;
    spark.y += my - (towards * dy) / distance;
    dx = eye.x - spark.x;
    dy = eye.y - spark.y;
    distance = Math.hypot(dx, dy);
  }
  spark.eyeX = eye.x;
  spark.eyeY = eye.y;

  const pace = Math.max(MIN_PACE, spark.reach / cfg.pickupRadius);
  const speed = pace * Math.min(pull.maxSpeed, pull.startSpeed + pull.acceleration * spark.flight);
  const step = speed * dt;
  spark.gap = distance;

  if (distance <= step + pull.arrive) {
    spark.x = eye.x;
    spark.y = eye.y;
    spark.gap = 0;
    spark.state = 'absorbed';
    return spark.worth;
  }

  const waver = pull.waver * Math.sin(Math.PI * 2 * pull.waverRate * spark.flight + spark.phase);
  const turn = (spark.curl * pull.curve + waver) * (Math.PI / 180) * Math.min(1, distance / cfg.pickupRadius);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const ux = dx / distance;
  const uy = dy / distance;
  spark.x += (ux * cos - uy * sin) * step;
  spark.y += (ux * sin + uy * cos) * step;
  return 0;
}

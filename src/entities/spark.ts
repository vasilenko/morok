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
  /** Its velocity in flight, in world units per second. */
  vx: number;
  vy: number;
  /** Where the hero was at the last step of its flight. */
  heroX: number;
  heroY: number;
  /**
   * Where it flies to, relative to the hero: the eye's place on him, but on
   * the side of him it has settled on, which may lag behind his turns.
   */
  aimX: number;
  aimY: number;
  /** The side of the hero the eye was on at the last step of its flight: 1 or -1. */
  eyeSide: number;
  /** Seconds the eye has been on that side, and stayed on the side before it. */
  held: number;
  heldBefore: number;
  /** The farthest it has been from where it flies to since it was drawn in, which sets its pace. */
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
    vx: 0,
    vy: 0,
    heroX: 0,
    heroY: 0,
    aimX: 0,
    aimY: 0,
    eyeSide: 1,
    held: 0,
    heldBefore: 0,
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
 * decides when it is pulled: once he is within `reach` of it, which is
 * `cfg.pickupRadius` unless something draws sparks from further. The flight
 * keeps its pace by `cfg.pickupRadius` whatever the reach, so one drawn
 * from further flies faster and takes about as long. `eye` is the skull's
 * eye socket it flies to. Returns the worth to credit: the spark's worth on
 * the step it is absorbed, 0 on every other step, so it is credited exactly
 * once.
 */
export function stepSpark(
  spark: Spark,
  hero: Point,
  eye: Point,
  dt: number,
  cfg: SparkConfig,
  reach = cfg.pickupRadius,
): number {
  if (spark.state === 'absorbed') return 0;
  spark.age += dt;
  if (spark.state === 'settling') settle(spark, cfg);
  if (spark.state !== 'pulled' && canBePulled(spark, hero, reach, cfg)) startPull(spark, hero, eye, cfg);
  if (spark.state === 'pulled') return fly(spark, hero, eye, dt, cfg);
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

function canBePulled(spark: Spark, hero: Point, reach: number, cfg: SparkConfig): boolean {
  if (spark.age < cfg.pickupDelay) return false;
  const dx = hero.x - spark.x;
  const dy = hero.y - spark.y;
  return dx * dx + dy * dy <= reach * reach;
}

/**
 * A spark drawn in from nearer the eye than the pickup radius flies slower,
 * so every flight takes about as long; this is the slowest, as a share of
 * the pull's speeds.
 */
const MIN_PACE = 0.25;

/**
 * Leaves the ground from where it is drawn, at rest, so the flight starts
 * without a jump, aiming at the eye on whichever side of the hero it is.
 */
function startPull(spark: Spark, hero: Point, eye: Point, cfg: SparkConfig): void {
  spark.state = 'pulled';
  spark.y -= cfg.hover + spark.lift;
  spark.lift = 0;
  spark.flight = 0;
  spark.vx = 0;
  spark.vy = 0;
  spark.heroX = hero.x;
  spark.heroY = hero.y;
  spark.aimX = eye.x - hero.x;
  spark.aimY = eye.y - hero.y;
  spark.eyeSide = spark.aimX < 0 ? -1 : 1;
  spark.held = Infinity;
  spark.heldBefore = Infinity;
  spark.reach = Math.hypot(eye.x - spark.x, eye.y - spark.y);
}

/**
 * One step of the flight. The spark has a velocity of its own and steers
 * it towards the velocity it wants, changing it by at most `pull.steer` a
 * second, so whatever the hero does it never jumps and never changes speed
 * or heading at once: when he doubles back, or the eye swings to his other
 * side as he turns, it swings round after him in an arc.
 *
 * The velocity it wants is the hero's, but for the part of it that comes
 * towards the spark, so running away never leaves it behind and running at
 * it brings it in sooner; plus a flight at the eye at a pace set by how far
 * it has had to go, turned aside by an angle that shrinks with the distance
 * left, so the path is a curve that straightens as it arrives, and that
 * wavers to and fro like a moth's. The flight speeds up as it goes, but
 * never so fast that it could not stop in the distance left, so it closes in
 * rather than circling the eye. A hero standing still asks for less than the
 * steering can give, so then it flies just that curve.
 *
 * It flies to the eye's place on the hero, on the side the eye is on, but
 * after he turns it keeps to the side it was going to for `pull.turnDelay`,
 * or for `pull.restless` if the eye had only just come to that side, so a
 * hero turning to and fro does not toss it from side to side: it waits on
 * one for the eye to come back. It is drunk in once its step, as seen from
 * the eye, passes within `pull.arrive` of it, and from further the longer
 * it has been flying past `pull.widenAfter`, so it always arrives.
 */
function fly(spark: Spark, hero: Point, eye: Point, dt: number, cfg: SparkConfig): number {
  const pull = cfg.pull;
  spark.flight += dt;

  const eyeX = eye.x - hero.x;
  const eyeSide = eyeX < 0 ? -1 : 1;
  if (eyeSide !== spark.eyeSide) {
    spark.eyeSide = eyeSide;
    spark.heldBefore = spark.held;
    spark.held = 0;
  }
  spark.held += dt;
  const delay = spark.heldBefore >= pull.restless ? pull.turnDelay : pull.restless;
  if (eyeX * spark.aimX >= 0 || spark.held >= delay) spark.aimX = eyeX;
  spark.aimY = eye.y - hero.y;

  spark.gap = Math.hypot(eye.x - spark.x, eye.y - spark.y);
  const dx = hero.x + spark.aimX - spark.x;
  const dy = hero.y + spark.aimY - spark.y;
  const distance = Math.hypot(dx, dy);
  const ux = distance > 0 ? dx / distance : 0;
  const uy = distance > 0 ? dy / distance : 0;

  const heroVx = dt > 0 ? (hero.x - spark.heroX) / dt : 0;
  const heroVy = dt > 0 ? (hero.y - spark.heroY) / dt : 0;
  spark.heroX = hero.x;
  spark.heroY = hero.y;
  const towards = Math.min(0, heroVx * ux + heroVy * uy);

  spark.reach = Math.max(spark.reach, distance);
  const pace = Math.max(MIN_PACE, spark.reach / cfg.pickupRadius);
  const speed = Math.min(
    pace * Math.min(pull.maxSpeed, pull.startSpeed + pull.acceleration * spark.flight),
    Math.sqrt(pull.brake * pull.steer * distance),
  );
  const waver = pull.waver * Math.sin(Math.PI * 2 * pull.waverRate * spark.flight + spark.phase);
  const turn = (spark.curl * pull.curve + waver) * (Math.PI / 180) * Math.min(1, distance / cfg.pickupRadius);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const wantX = heroVx - towards * ux + (ux * cos - uy * sin) * speed;
  const wantY = heroVy - towards * uy + (ux * sin + uy * cos) * speed;

  const ax = wantX - spark.vx;
  const ay = wantY - spark.vy;
  const change = Math.hypot(ax, ay);
  const share = change > 0 ? Math.min(1, (pull.steer * dt) / change) : 0;
  spark.vx += ax * share;
  spark.vy += ay * share;

  // Its step as seen from the eye, which moves with the hero, and how near
  // that step passes to the eye.
  const ex = spark.x - eye.x;
  const ey = spark.y - eye.y;
  const sx = (spark.vx - heroVx) * dt;
  const sy = (spark.vy - heroVy) * dt;
  const length = sx * sx + sy * sy;
  const along = length > 0 ? Math.min(1, Math.max(0, -(ex * sx + ey * sy) / length)) : 0;
  const reach = pull.arrive + pull.widen * Math.max(0, spark.flight - pull.widenAfter);
  if (Math.hypot(ex + sx * along, ey + sy * along) <= reach) {
    spark.x = eye.x;
    spark.y = eye.y;
    spark.gap = 0;
    spark.state = 'absorbed';
    return spark.worth;
  }

  spark.x += spark.vx * dt;
  spark.y += spark.vy * dt;
  return 0;
}

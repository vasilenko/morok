import type { ItemLadders, SickleConfig } from '../config';

/**
 * The sickle as pure logic: the hero reaps before him the way he last
 * walked up or down the screen, as a reaper mows what is in front of him;
 * the stake works to the sides. The blade sweeps a fan centred straight
 * down the screen or straight up, from one side to the other, and cuts each
 * enemy once as it passes over. The fan lies on the ground, so seen from
 * above at three-quarters it is flattened, `flatten` times as tall as it
 * is wide (CFG.ground), in what it reaches as in how it is drawn: a fan
 * pointing down or up is shallower than it is wide. It never seeks an
 * enemy: whoever is not in the fan when the blade passes is not cut.
 *
 * A swing has three beats, like a drawn slash: the raise, held at the edge
 * the blade starts from; the sweep across, when it cuts; and the rest at
 * the far edge, fading. Angles are on the ground, in radians, measured
 * from the fan's middle: negative to the left of the screen, positive to
 * the right, for a fan pointing down as for one pointing up.
 */
export type SickleStats = ItemLadders['sickle'][number];

export interface Swing {
  /** Seconds since the raise began. */
  age: number;
  /** The way the fan points: 1 down the screen, -1 up it. */
  heading: number;
  /** True when the blade sweeps from left to right, false from right to left. */
  rightward: boolean;
  reach: number;
  /** The whole fan, in radians. */
  arc: number;
  /** Seconds of each beat: held at the start edge, sweeping across, resting at the far edge. */
  raise: number;
  sweep: number;
  rest: number;
  /** How far the blade draws back behind the start edge as it is raised, in radians. */
  drawBack: number;
}

/** The part of the fan the blade swept in one step, from `from` to `to`, angles as for a Swing. */
export interface Sweep {
  from: number;
  to: number;
}

/**
 * The swings of one stroke by a hero who last walked `heading` (1 down,
 * -1 up), sweeping rightward or leftward: one before him, and with `ways`
 * 2 one behind as well, both sweeping the same way across the screen.
 */
export function swingSickles(heading: number, rightward: boolean, stats: SickleStats, cfg: SickleConfig): Swing[] {
  const headings = stats.ways >= 2 ? [heading, -heading] : [heading];
  const arc = (stats.arc * Math.PI) / 180;
  const { raise, sweep, rest } = cfg;
  const drawBack = (cfg.drawBack * Math.PI) / 180;
  return headings.map((way) => ({
    age: 0,
    heading: way,
    rightward,
    reach: stats.reach,
    arc,
    raise,
    sweep,
    rest,
    drawBack,
  }));
}

/** The edge of the fan the blade starts from. */
export function startEdge(swing: Swing): number {
  return swing.rightward ? -swing.arc / 2 : swing.arc / 2;
}

/**
 * Where the blade is `age` seconds into the swing: raised at the start
 * edge, drawing back a little behind it; then across the fan, fastest in
 * the middle and easing into the far edge; then still at the far edge.
 */
export function bladeAngle(swing: Swing, age: number): number {
  const way = swing.rightward ? 1 : -1;
  const start = startEdge(swing);
  if (age < swing.raise) return start - way * swing.drawBack * Math.sin((Math.PI / 2) * (age / swing.raise));
  const t = Math.min(1, (age - swing.raise) / swing.sweep);
  const share = 0.5 - 0.5 * Math.cos(Math.PI * t);
  return start - way * swing.drawBack + way * (swing.arc + swing.drawBack) * share;
}

/** Whether the sweep is over: the blade rests at the far edge, or is gone. */
export function swingOver(swing: Swing): boolean {
  return swing.age >= swing.raise + swing.sweep;
}

/**
 * Seconds from the start of the raise until the sickle, and the trail it
 * leaves, which lingers `linger` seconds after the sweep, are gone.
 */
export function swingLife(swing: Swing, linger: number): number {
  return swing.raise + swing.sweep + Math.max(swing.rest, linger);
}

/**
 * Ages the swing by `dt` and returns the part of the fan the blade swept in
 * that step, or null when the step falls wholly in the raise or the rest,
 * when nothing is cut.
 */
export function stepSwing(swing: Swing, dt: number): Sweep | null {
  const begin = Math.max(swing.age, swing.raise);
  swing.age += dt;
  const end = Math.min(swing.age, swing.raise + swing.sweep);
  if (end <= begin) return null;
  return { from: bladeAngle(swing, begin), to: bladeAngle(swing, end) };
}

/**
 * Where a ground point (dx, dy) from the hero's feet lies for the swing:
 * its distance on the ground, the flattening undone, and its angle from
 * the fan's middle.
 */
export function inFan(swing: Swing, dx: number, dy: number, flatten: number): { distance: number; angle: number } {
  const along = (dy / flatten) * swing.heading;
  return { distance: Math.hypot(dx, along), angle: Math.atan2(dx, along) };
}

/**
 * Whether the blade passed over a ground point (dx, dy) from the hero's
 * feet in `sweep`: the point is within the fan's reach and arc, and the
 * blade came over it in this step, or it lies up to `cfg.margin` along the
 * arc behind where the blade was before. The caller cuts each enemy at
 * most once a swing.
 */
export function cuts(swing: Swing, sweep: Sweep, dx: number, dy: number, flatten: number, cfg: SickleConfig): boolean {
  const { distance, angle } = inFan(swing, dx, dy, flatten);
  if (distance > swing.reach || Math.abs(angle) > swing.arc / 2) return false;
  const slack = cfg.margin / Math.max(distance, 1);
  // In the direction of the stroke, the angle runs from the step's start to its end.
  const way = swing.rightward ? 1 : -1;
  const across = way * angle;
  return across <= way * sweep.to && across > way * sweep.from - slack;
}

/** The ground point at `radius` from the hero's feet, at `angle` in the fan of a swing pointing `heading`, flattened. */
export function fanPoint(heading: number, angle: number, radius: number, flatten: number): { x: number; y: number } {
  return { x: radius * Math.sin(angle), y: heading * radius * Math.cos(angle) * flatten };
}

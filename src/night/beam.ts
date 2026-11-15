/**
 * Where the skull lantern on the hero's staff points. Angles are in
 * radians on the ground plane, 0 pointing right and growing clockwise on
 * screen (positive y is down), like Math.atan2 in screen space.
 */

/**
 * The direction the beam wants to point: along the facing, tilted towards
 * the vertical movement by up to `maxTilt` radians, level when standing.
 *
 * @param facing 1 when facing right, -1 when facing left.
 * @param moveY Vertical movement, -1 (up) to 1 (down); 0 when not moving.
 */
export function beamTarget(facing: number, moveY: number, maxTilt: number): number {
  const tilt = Math.max(-1, Math.min(1, moveY)) * maxTilt;
  return facing < 0 ? Math.PI - tilt : tilt;
}

/**
 * Within this many radians of a half turn, both ways round are about as
 * short, so the swing goes the way that passes below the hero. Wide enough
 * that a beam coming to rest a hair off level still turns the same way.
 */
const HALF_TURN_BAND = 0.25;

/**
 * Eases `current` towards `target` along the shorter arc, closing the
 * remaining gap by the share an exponential with time constant `tau`
 * seconds closes in `dt`. Turning around (a gap of about half a circle)
 * swings through the lower half, towards the viewer, whichever way the
 * hero turns. The result is wrapped to (-PI, PI].
 */
export function easeAngle(current: number, target: number, dt: number, tau: number): number {
  let gap = wrapAngle(target - current);
  if (Math.abs(gap) > Math.PI - HALF_TURN_BAND) {
    // The other way round; keep whichever has its midpoint below (sin > 0).
    const other = gap - Math.sign(gap) * 2 * Math.PI;
    if (Math.sin(current + other / 2) > Math.sin(current + gap / 2)) gap = other;
  }
  const share = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
  return wrapAngle(current + gap * share);
}

/** The same angle, in (-PI, PI]. */
export function wrapAngle(angle: number): number {
  const turn = 2 * Math.PI;
  const wrapped = angle - turn * Math.floor(angle / turn);
  return wrapped > Math.PI ? wrapped - turn : wrapped;
}

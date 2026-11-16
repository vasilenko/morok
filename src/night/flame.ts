/**
 * The waver of the fire in the skull lantern: a pure function of time, so
 * it runs the same at any frame rate and on any screen that draws the night.
 */

/**
 * Slow swells of the flame as [angular speed in radians per second, phase,
 * weight]. The speeds have no common period, so the sum never repeats; the
 * weights add up to 1.
 */
const SWELLS: readonly [number, number, number][] = [
  [4.1, 0.0, 0.45],
  [6.7, 2.1, 0.33],
  [10.3, 4.4, 0.22],
];

/** The quick shiver on top, in the same form; the weights add up to 1. */
const SHIVERS: readonly [number, number, number][] = [
  [23.9, 1.3, 0.55],
  [31.7, 5.2, 0.45],
];

function sum(waves: readonly [number, number, number][], t: number): number {
  let total = 0;
  for (const [speed, phase, weight] of waves) total += weight * Math.sin(speed * t + phase);
  return total;
}

/**
 * How far the flame is from its mean brightness at time `t` seconds, in
 * -1..1: mostly slow, irregular swells with a share `shiver` (0..1) of
 * quick trembling on top. `speed` scales how fast it all moves.
 */
export function flameWaver(t: number, speed = 1, shiver = 0.2): number {
  const s = Math.max(0, Math.min(1, shiver));
  const time = t * speed;
  return (1 - s) * sum(SWELLS, time) + s * sum(SHIVERS, time);
}

/** The tunables of the fire in the eye socket that the waver moves. */
export interface EyeFlame {
  halo: number;
  intensity: number;
  haloColor: readonly [number, number, number];
  emberColor: readonly [number, number, number];
  flicker: number;
  breathe: number;
  shade: number;
  flare: { intensity: number; halo: number };
}

/**
 * The fire in the eye socket at a moment of the flame (`waver`, -1..1):
 * its strength and halo radius swing by `flicker` and `breathe` around
 * their rest values, and the halo's colour runs from `emberColor` when the
 * flame sinks to `haloColor` when it flares. A spark's flare (`flare`,
 * 0..1) adds to the strength and the radius on top of the swing, so the
 * flicker does not grow with it, and turns the fire to its hottest.
 */
export function eyeFire(eye: EyeFlame, waver: number, flare = 0) {
  const w = Math.max(-1, Math.min(1, waver));
  const f = Math.max(0, Math.min(1, flare));
  const heat = 1 - (0.5 - 0.5 * w) * (1 - f);
  return {
    intensity: Math.max(0, eye.intensity * (1 + eye.flicker * w + eye.flare.intensity * f)),
    halo: Math.max(0, eye.halo * (1 + eye.breathe * w + eye.flare.halo * f)),
    shade: Math.max(0, 1 - eye.shade * (1 - heat)),
    haloColor: eye.emberColor.map((ember, i) => ember + (eye.haloColor[i] - ember) * heat) as [number, number, number],
  };
}

/** The heat stored from sparks, `heat` in worth, after `seconds` of draining with time constant `fade`. */
export function drainFlare(heat: number, seconds: number, fade: number): number {
  if (fade <= 0) return 0;
  // A clock that jumped back (a stepped loop in tests) must not grow it.
  return heat * Math.exp(-Math.max(0, seconds) / fade);
}

/** The flare's strength (0..1) for the stored heat: rises with it and saturates. */
export function flareStrength(heat: number, knee: number): number {
  if (knee <= 0) return heat > 0 ? 1 : 0;
  return 1 - Math.exp(-Math.max(0, heat) / knee);
}

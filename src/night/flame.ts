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
}

/**
 * The fire in the eye socket at a moment of the flame (`waver`, -1..1):
 * its strength and halo radius swing by `flicker` and `breathe` around
 * their rest values, and the halo's colour runs from `emberColor` when the
 * flame sinks to `haloColor` when it flares.
 */
export function eyeFire(eye: EyeFlame, waver: number) {
  const w = Math.max(-1, Math.min(1, waver));
  const heat = 0.5 + 0.5 * w;
  return {
    intensity: Math.max(0, eye.intensity * (1 + eye.flicker * w)),
    halo: Math.max(0, eye.halo * (1 + eye.breathe * w)),
    shade: Math.max(0, 1 - eye.shade * (1 - heat)),
    haloColor: eye.emberColor.map((ember, i) => ember + (eye.haloColor[i] - ember) * heat) as [number, number, number],
  };
}

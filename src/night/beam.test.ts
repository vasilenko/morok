import { describe, expect, it } from 'vitest';
import { beamTarget, easeAngle, wrapAngle } from './beam';

const TILT = (40 * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** Steps the easing at 60 fps for `seconds`, recording every angle. */
function swing(from: number, to: number, seconds: number, tau = 0.12): number[] {
  const path = [from];
  let angle = from;
  for (let t = 0; t < seconds; t += 1 / 60) {
    angle = easeAngle(angle, to, 1 / 60, tau);
    path.push(angle);
  }
  return path;
}

describe('beamTarget', () => {
  it('points level along the facing when standing', () => {
    expect(beamTarget(1, 0, TILT)).toBe(0);
    expect(beamTarget(-1, 0, TILT)).toBeCloseTo(Math.PI);
  });

  it('tilts towards vertical movement, mirrored when facing left', () => {
    // Down is positive y, so down-right is a positive angle.
    expect(deg(beamTarget(1, 1, TILT))).toBeCloseTo(40);
    expect(deg(beamTarget(1, -1, TILT))).toBeCloseTo(-40);
    expect(deg(beamTarget(-1, 1, TILT))).toBeCloseTo(140);
    expect(deg(beamTarget(-1, -1, TILT))).toBeCloseTo(180 + 40);
  });

  it('never tilts beyond the limit', () => {
    expect(deg(beamTarget(1, 3, TILT))).toBeCloseTo(40);
    expect(deg(beamTarget(1, -3, TILT))).toBeCloseTo(-40);
  });
});

describe('easeAngle', () => {
  it('converges on the target and stays there', () => {
    const path = swing(0, TILT, 1);
    expect(path.at(-1)).toBeCloseTo(TILT, 3);
    // Monotonic: no overshoot.
    for (let i = 1; i < path.length; i++) expect(path[i]).toBeGreaterThanOrEqual(path[i - 1]);
    expect(easeAngle(TILT, TILT, 1 / 60, 0.12)).toBeCloseTo(TILT);
  });

  it('takes the shorter way across the left-hand seam', () => {
    // From 170 to -170 degrees is 20 degrees through 180, not 340 back.
    const from = (170 * Math.PI) / 180;
    const to = (-170 * Math.PI) / 180;
    const next = easeAngle(from, to, 1 / 60, 0.12);
    expect(Math.abs(wrapAngle(next - from))).toBeLessThan((20 * Math.PI) / 180);
    expect(swing(from, to, 1).at(-1)).toBeCloseTo(to, 3);
  });

  it('swings through the lower half when turning around, both ways', () => {
    for (const [from, to] of [
      [0, Math.PI],
      [Math.PI, 0],
      // Coming to rest a hair above level must not change the way round.
      [-0.01, Math.PI],
    ]) {
      const path = swing(from, to, 1.5);
      const steps = path.slice(1).map((angle, i) => Math.abs(wrapAngle(angle - path[i])));
      // Never jumps: no single frame turns more than a fraction of the way.
      expect(Math.max(...steps)).toBeLessThan(Math.PI / 4);
      // Halfway round it points down the screen.
      const middle = path.reduce((best, angle) => (Math.abs(Math.cos(angle)) < Math.abs(Math.cos(best)) ? angle : best));
      expect(Math.sin(middle)).toBeGreaterThan(0.99);
      expect(Math.cos(path.at(-1)!)).toBeCloseTo(Math.cos(to), 4);
    }
  });

  it('snaps when the time constant is zero', () => {
    expect(easeAngle(0, 1, 1 / 60, 0)).toBe(1);
  });
});

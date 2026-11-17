import { describe, expect, it } from 'vitest';
import { CFG } from '../config';
import { itemStats } from '../progression/progression';
import { throwAngles, throwShots } from './stake';

const cfg = CFG.stake;
const deg = (radians: number) => Math.round((((radians * 180) / Math.PI) % 360) + 360) % 360;
const ladder = CFG.items.stake;

describe('the aspen stake', () => {
  it('is thrown one way: straight ahead, exactly right or left', () => {
    expect(throwAngles(1, 1).map(deg)).toEqual([0]);
    expect(throwAngles(-1, 1).map(deg)).toEqual([180]);
  });

  it('is thrown two ways: ahead and straight behind', () => {
    expect(throwAngles(1, 2).map(deg)).toEqual([0, 180]);
    expect(throwAngles(-1, 2).map(deg)).toEqual([180, 0]);
  });

  it('works only to the sides: never up or down, and never tilted', () => {
    // The throw takes the facing and nothing of the movement, so a hero
    // walking up or down throws as one standing.
    for (const facing of [1, -1]) {
      for (const stats of ladder) for (const shot of throwShots(facing, stats, cfg)) expect(deg(shot.angle) % 180).toBe(0);
    }
  });

  it('throws one stake each way, on the line of the hero and at once, up to level 4', () => {
    for (const stats of ladder.slice(0, 4)) {
      const shots = throwShots(1, stats, cfg);
      expect(shots).toHaveLength(stats.ways);
      for (const shot of shots) expect(shot).toMatchObject({ lane: 0, delay: 0 });
    }
  });

  it('throws a staggered pair each way at level 5, one above the line and one below', () => {
    for (const facing of [1, -1]) {
      const shots = throwShots(facing, ladder[4], cfg).map((s) => ({ ...s, angle: deg(s.angle) }));
      const ahead = facing > 0 ? 0 : 180;
      const behind = 180 - ahead;
      expect(shots).toHaveLength(4);
      expect(shots).toEqual(
        expect.arrayContaining([
          { angle: ahead, lane: -cfg.spread / 2, delay: 0 },
          { angle: behind, lane: -cfg.spread / 2, delay: 0 },
          { angle: ahead, lane: cfg.spread / 2, delay: cfg.stagger },
          { angle: behind, lane: cfg.spread / 2, delay: cfg.stagger },
        ]),
      );
    }
  });

  it('keeps its cooldown with a volley: the last stake leaves well before the next throw', () => {
    const [l4, l5] = [ladder[3], ladder[4]];
    expect(l5.cooldown).toBeLessThanOrEqual(l4.cooldown);
    const last = Math.max(...throwShots(1, l5, cfg).map((s) => s.delay));
    expect(last).toBeLessThan(l5.cooldown);
  });

  it('flies further, behind as well and two at a time with its level', () => {
    const levels = [1, 2, 3, 4, 5].map((level) => itemStats(CFG.items, 'stake', level));
    expect(levels.map((row) => row?.range)).toEqual([120, 170, 170, 240, 240]);
    expect(levels.map((row) => row?.ways)).toEqual([1, 1, 2, 2, 2]);
    expect(levels.map((row) => row?.volley)).toEqual([1, 1, 1, 1, 2]);
  });
});

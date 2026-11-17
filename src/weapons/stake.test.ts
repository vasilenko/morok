import { describe, expect, it } from 'vitest';
import { CFG } from '../config';
import { itemStats } from '../progression/progression';
import { throwAngles } from './stake';

const deg = (radians: number) => Math.round((((radians * 180) / Math.PI) % 360) + 360) % 360;

describe('the aspen stake', () => {
  it('is thrown one way: straight ahead, exactly right or left', () => {
    expect(throwAngles(1, 1).map(deg)).toEqual([0]);
    expect(throwAngles(-1, 1).map(deg)).toEqual([180]);
  });

  it('is thrown two ways: ahead and straight behind', () => {
    expect(throwAngles(1, 2).map(deg)).toEqual([0, 180]);
    expect(throwAngles(-1, 2).map(deg)).toEqual([180, 0]);
  });

  it('is thrown four ways: left, right, straight up and straight down', () => {
    expect(throwAngles(1, 4).map(deg)).toEqual([0, 90, 180, 270]);
    expect(throwAngles(-1, 4).map(deg)).toEqual([180, 270, 0, 90]);
  });

  it('does not tilt with vertical movement: the facing alone sets its ways', () => {
    // The throw takes the facing and nothing of the movement, so a hero
    // walking up or down throws as one standing: only along the axes.
    for (const facing of [1, -1]) {
      for (const ways of [1, 2, 4]) for (const angle of throwAngles(facing, ways)) expect(deg(angle) % 90).toBe(0);
    }
  });

  it('flies further and more ways with its level', () => {
    const levels = [1, 2, 3, 4, 5].map((level) => itemStats(CFG.items, 'stake', level));
    expect(levels.map((row) => row?.range)).toEqual([120, 170, 170, 240, 240]);
    expect(levels.map((row) => row?.ways)).toEqual([1, 1, 2, 2, 4]);
  });
});

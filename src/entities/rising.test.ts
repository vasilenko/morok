import { describe, expect, it } from 'vitest';
import { claimWater, freeWaters, pickWater, pruneClaims, type RisingClaim } from './rising';

const rules = { rise: 0.9, hold: 1.5 };
const pond = { x: -176, y: 140 };
const puddle = { x: 250, y: -60 };

/** What the scene does for an utopets due now: the water he rises out of, taken, or null. */
function due(waters: { x: number; y: number }[], claims: RisingClaim[], now: number, roll = 0) {
  const water = pickWater(waters, claims, now, roll);
  if (water) claimWater(claims, water, now, rules);
  return water;
}

describe('utopets rising', () => {
  it('raises one at a time from a water; the next due at that moment walks in instead', () => {
    const claims: RisingClaim[] = [];
    expect(due([pond], claims, 92)).toEqual(pond);
    expect(due([pond], claims, 92)).toBeNull();
  });

  it('sends a whole wave due in one frame to different waters, the rest walking in', () => {
    const claims: RisingClaim[] = [];
    const picked = Array.from({ length: 8 }, () => due([pond, puddle], claims, 128));
    expect(picked.filter(Boolean)).toEqual([pond, puddle]);
    expect(picked.slice(2).every((water) => water === null)).toBe(true);
  });

  it('holds the water while he rises and for the hold after he stands, then frees it', () => {
    const claims: RisingClaim[] = [];
    due([pond], claims, 100);
    const freeAt = 100 + rules.rise + rules.hold;
    expect(due([pond], claims, freeAt - 0.01)).toBeNull();
    expect(freeWaters([pond], claims, freeAt)).toEqual([pond]);
    expect(due([pond], claims, freeAt)).toEqual(pond);
  });

  it('picks among the free waters by the roll', () => {
    const waters = [pond, puddle, { x: 0, y: 300 }];
    expect(pickWater(waters, [], 0, 0.99)).toEqual(waters[2]);
    expect(pickWater(waters, [], 0, 0.4)).toEqual(waters[1]);
  });

  it('has nothing to rise out of with no water in reach', () => {
    expect(pickWater([], [], 0, 0.5)).toBeNull();
  });

  it('forgets claims that have run out', () => {
    const claims = [
      { x: 0, y: 0, until: 5 },
      { x: 50, y: 0, until: 9 },
    ];
    pruneClaims(claims, 6);
    expect(claims).toEqual([{ x: 50, y: 0, until: 9 }]);
  });
});

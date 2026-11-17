import type { ItemLadders, StakeConfig } from '../config';

/**
 * The aspen stake as pure logic: which ways one throw sends its stakes,
 * and when. It never seeks an enemy and never tilts: it is thrown along the
 * hero's facing, exactly left or right, however he moves. It works to the
 * sides; above and below him is the sickle's.
 */
export type StakeStats = ItemLadders['stake'][number];

/** One stake of a throw. */
export interface Shot {
  /** Its direction on screen, in radians: 0 right, PI left. */
  angle: number;
  /** How far its line lies below the hero's, across its flight: negative above. */
  lane: number;
  /** Seconds after the throw that it leaves the hero's hand. */
  delay: number;
}

/**
 * The directions of the stakes of one throw by a hero facing `facing` (1
 * right, -1 left), in radians on screen: straight ahead, and with `ways` 2
 * straight behind as well.
 */
export function throwAngles(facing: number, ways: number): number[] {
  const ahead = facing < 0 ? Math.PI : 0;
  return ways >= 2 ? [ahead, ahead + Math.PI] : [ahead];
}

/**
 * The stakes of one throw: for every way, a volley of `volley` stakes on
 * parallel lines `cfg.spread` apart, centred on the hero's line and
 * running from above it to below it, each `cfg.stagger` seconds after the
 * one before. A single stake flies on the hero's line at once.
 */
export function throwShots(facing: number, stats: StakeStats, cfg: StakeConfig): Shot[] {
  const shots: Shot[] = [];
  for (let i = 0; i < stats.volley; i++) {
    const lane = (i - (stats.volley - 1) / 2) * cfg.spread;
    for (const angle of throwAngles(facing, stats.ways)) shots.push({ angle, lane, delay: i * cfg.stagger });
  }
  return shots;
}

/**
 * Balance and tuning values. Distances are in world units, times in seconds.
 * Tweak here; nothing else hard-codes these numbers.
 */
export const CFG = {
  /** World-to-screen magnification. */
  zoom: 1.4,

  player: {
    speed: 175,
    hp: 100,
    radius: 10,
    /** Invulnerability window after taking a hit. */
    invulnerability: 0.6,
  },

  navia: {
    speedMin: 46,
    speedMax: 70,
    hp: 10,
    radius: 11,
    damage: 12,
  },

  stake: {
    cooldown: 0.45,
    speed: 640,
    damage: 10,
    /** How many enemies a single stake can hit. */
    pierce: 3,
    range: 430,
    lifetime: 0.8,
    knockback: 160,
  },

  spawn: {
    /** Enemies per second at the start of the night. */
    trickle: 1.4,
    /** Added to the trickle for every minute survived. */
    trickleGrowth: 1.0,
    /** Seconds before the first wave. */
    firstWave: 3,
    /** Seconds between waves. */
    waveEvery: 12,
    /** Size of the first wave. */
    waveBase: 12,
    /** Added to every following wave. */
    waveGrowth: 5,
    /** Every Nth wave surrounds the player instead of coming from one side. */
    ringEvery: 4,
    maxEnemies: 700,
  },
};

export type SpawnConfig = typeof CFG.spawn;

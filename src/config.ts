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

  /**
   * A risen corpse that prowls, crouches and lunges. It commits to its
   * direction when the lunge begins, so stepping aside dodges it, and a
   * miss leaves it helpless for a moment.
   */
  upyr: {
    /** Three stake hits. */
    hp: 30,
    /** Walking speed while prowling. */
    speed: 60,
    radius: 12,
    /** Contact damage outside a lunge, as for a navia. */
    damage: 12,
    /** Starts an attack when the hero is this close and the attack is off cooldown. */
    attackRange: 170,
    /** Seconds standing still in the wind-up pose before the lunge: the tell. */
    windUp: 0.5,
    /** The lunge runs this far in a straight line... */
    lungeDistance: 260,
    /** ...at this speed. */
    lungeSpeed: 520,
    /** Dealt once per lunge that passes through the hero; landing it heals the upyr to full. */
    lungeDamage: 18,
    /** Seconds motionless in the landing pose after a lunge. */
    recover: 0.5,
    /** Seconds after recovering before it may attack again. */
    cooldown: 2.5,
    /** Seconds into the run before the first upyr rises. */
    appearsAt: 45,
    /** From then on, the chance that a spawned enemy is an upyr. */
    share: 1 / 8,
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
export type UpyrConfig = typeof CFG.upyr;

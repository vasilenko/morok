/**
 * Balance and tuning values. Distances are in world units, times in seconds.
 * Tweak here; nothing else hard-codes these numbers.
 */
export const CFG = {
  /** World-to-screen magnification. */
  zoom: 1.4,

  /**
   * The ground as the camera sees it, from above at three-quarters: a
   * circle lying on it is an ellipse whose height is `flatten` of its
   * width. Whatever circles, spreads or strikes round a point on the
   * ground (the teeth, the bell's ring, the book's signs) is flattened
   * alike, in what it reaches as in how it is drawn.
   */
  ground: {
    flatten: 0.75,
  },

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
    /** Worth of the spark she leaves when laid to rest. */
    xp: 1,
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
    /** Worth of the spark it leaves when laid to rest. */
    xp: 5,
  },

  /** The stake's flight; what grows with its level is in `items.stake`. */
  stake: {
    speed: 640,
    knockback: 160,
  },

  /**
   * Fangs that circle the hero on the ground and wound whatever they pass
   * through; how many, how hard, how wide and how fast is in `items.teeth`.
   */
  teeth: {
    /** Seconds an enemy wounded by the teeth is spared by every fang. */
    rehit: 0.3,
    /** A light push away from the hero. */
    knockback: 90,
    /** Reach of a fang's point on the ground, added to an enemy's radius. */
    hitRadius: 6,
    /** Height of the fangs above the ground: about the hero's middle. */
    lift: 26,
    /**
     * How quickly the fangs settle into new places, per second: a fang that
     * is gained grows out from the hero, the others spread to make room, and
     * the circle widens, all easing in rather than jumping.
     */
    settle: 5,
  },

  /**
   * Levels: the experience the skull drinks in fills a level, and each
   * level asks for more than the last.
   */
  levels: {
    /**
     * Experience from level 1 to level 2: a few kills, so the first choice
     * comes within the quiet opening, while the stake is all the hero has.
     */
    first: 45,
    /** Added to the cost of every level after that. */
    step: 90,
    /** Most items offered at a level-up. */
    choices: 3,
  },

  /**
   * What every item does at each of its levels, from level 1: a row of
   * numbers per level. The hero starts with the stake at level 1.
   */
  items: {
    /**
     * Thrown every `cooldown` seconds, whether or not anyone is there, the
     * way the hero faces (exactly left or right, never tilted), and `ways`
     * ways at once: 1 ahead, 2 ahead and behind, 4 adds straight up and
     * down. Each stake flies straight for `range` and goes through `pierce`
     * enemies; it never seeks one.
     */
    stake: [
      { ways: 1, damage: 10, cooldown: 0.6, range: 120, pierce: 1 },
      { ways: 1, damage: 10, cooldown: 0.6, range: 170, pierce: 2 },
      { ways: 2, damage: 15, cooldown: 0.5, range: 170, pierce: 2 },
      { ways: 2, damage: 15, cooldown: 0.5, range: 240, pierce: 3 },
      { ways: 4, damage: 30, cooldown: 0.4, range: 240, pierce: 3 },
    ],
    /** `count` fangs, `radius` from the hero, one turn every `period` seconds. */
    teeth: [
      { count: 2, damage: 10, radius: 85, period: 1.6 },
      { count: 3, damage: 10, radius: 85, period: 1.6 },
      { count: 3, damage: 15, radius: 100, period: 1.6 },
      { count: 4, damage: 15, radius: 100, period: 1.6 },
      { count: 5, damage: 15, radius: 115, period: 1.6 },
    ],
    /** Sparks are drawn in from `pickupRadius` instead of `spark.pickupRadius`. */
    hagStone: [
      { pickupRadius: 85 },
      { pickupRadius: 110 },
      { pickupRadius: 140 },
      { pickupRadius: 170 },
      { pickupRadius: 210 },
    ],
  },

  spawn: {
    /** Enemies per second at the start of the night: dusk, with the dead coming one by one. */
    trickle: 0.7,
    /** Added to the trickle for every minute survived. */
    trickleGrowth: 1.0,
    /** Seconds before the first wave: time to meet the first of them and take a first level. */
    firstWave: 20,
    /** Seconds between waves. */
    waveEvery: 12,
    /** Size of the first wave. */
    waveBase: 6,
    /** Added to every following wave. */
    waveGrowth: 5,
    /** Every Nth wave surrounds the player instead of coming from one side. */
    ringEvery: 4,
    maxEnemies: 700,
  },

  /**
   * The spark a creature leaves when it is laid to rest: experience that the
   * skull on the hero's staff drinks in. It pops out of the corpse, lies
   * where it settles until the hero comes near, then is drawn into the
   * skull's eye socket. Sparks never fade.
   */
  spark: {
    /**
     * Most sparks lying on the plane at once. Dropping one more pours the
     * oldest lying spark's worth into the new one, so no worth is lost.
     */
    cap: 600,
    /**
     * The grades of fire a spark burns with, by the experience it holds: a
     * spark is of the highest grade whose threshold its worth reaches (and
     * of the lowest if it reaches none). The look depends on the grade
     * alone, never on who left the spark, so a merged spark climbs the
     * grades as its worth grows.
     */
    grades: [1, 5, 15, 40],
    /**
     * Temporary, so that every grade can be seen in play before there are
     * enemies strong enough to leave the higher ones: while on, a slain
     * enemy's spark ignores its kind's `xp` and is worth the threshold of a
     * grade picked uniformly at random. Off restores the real rule.
     */
    randomGrade: true,
    /** The hero draws in sparks within this distance of his position, until the hag stone draws them from further. */
    pickupRadius: 60,
    /** Seconds after the drop before a spark can be drawn in, so every drop is seen. */
    pickupDelay: 0.25,
    /** How far along the ground a spark pops out of the corpse. */
    popDistance: 14,
    /** Height of the hop on its way down from the corpse's body to the ground. */
    popHeight: 8,
    /** Seconds the pop takes before the spark lies still. */
    settle: 0.35,
    /** Height above the ground of a lying spark's heart: the middle of its coal, the point that flies into the skull. */
    hover: 4,
    /**
     * The flight into the skull, like a moth's to a lantern: it speeds up
     * from `startSpeed` by `acceleration` per second up to `maxSpeed`,
     * each in proportion to how far from the eye it starts, against
     * `pickupRadius`, so every flight takes about as long. It is aimed at
     * the eye but turned aside by up to `curve` degrees, a turn
     * that eases off as it closes in, and wavers by up to `waver` degrees
     * either way `waverRate` times a second. It keeps up with the hero as
     * he moves, so the flight takes about as long when he runs away as
     * when he stands, but it has a velocity of its own that turns and
     * changes speed smoothly, so his turns and reversals swing it round in
     * an arc instead of jerking it after him.
     */
    pull: {
      startSpeed: 15,
      acceleration: 200,
      maxSpeed: 600,
      curve: 40,
      waver: 18,
      waverRate: 2.5,
      /**
       * The most its velocity changes by in a second, in world units per
       * second: about 100 a frame at 60 frames a second. Well above what a
       * flight to a hero standing still asks for, so that flight keeps its
       * curve, and above what a hero circling on the keys asks for.
       */
      steer: 6000,
      /**
       * It never flies at the eye faster than it could stop in the distance
       * left using this share of `steer`, so it slows into the socket
       * instead of shooting past it or circling it.
       */
      brake: 0.5,
      /**
       * Seconds it keeps flying to the side of the hero the eye was on
       * after he turns, before it swings round after the eye.
       */
      turnDelay: 0.1,
      /**
       * If the eye had stayed on its side for less than this many seconds
       * before he turned, the hero is turning to and fro: it keeps to its
       * side until the eye has stayed this long on the other, waiting for
       * it to come back rather than being tossed from side to side.
       */
      restless: 0.4,
      /** It is drunk in once its step passes this close to the eye... */
      arrive: 4,
      /**
       * ...and, once it has flown `widenAfter` seconds, from `widen` world
       * units further for every second more, so it arrives however the hero
       * moves.
       */
      widenAfter: 1,
      widen: 40,
    },
  },
};

export type SpawnConfig = typeof CFG.spawn;
export type UpyrConfig = typeof CFG.upyr;
export type SparkConfig = typeof CFG.spark;
export type LevelConfig = typeof CFG.levels;
export type ItemLadders = typeof CFG.items;
export type TeethConfig = typeof CFG.teeth;

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

  /**
   * The utopets, a drowned man: slow, heavy and hard to kill. He rises
   * out of a puddle or pond near the hero, or with none free walks in
   * from beyond the edge of the view, grasps at him from close by,
   * and where he is laid to rest he leaves drowned water that slows the
   * hero's feet (see `drowned`).
   */
  utopets: {
    hp: 60,
    /** Walking speed. */
    speed: 30,
    radius: 14,
    /** Contact damage outside a grasp, as for a navia. */
    damage: 12,
    /** The share of a blow's knock-back that moves him: he is heavy. */
    knockback: 0.35,
    /**
     * Seconds he takes to rise, in two poses of half this each, before he
     * stands; he can be wounded while rising but does no harm.
     */
    rise: 0.9,
    /**
     * He rises at the middle of a puddle or pond picked at random among
     * those between these distances from the hero's feet that are free;
     * with none free, he walks in from the spawn ring like a navia, already
     * standing.
     */
    riseNear: 180,
    riseFar: 420,
    /**
     * A water one rises out of is taken while he rises and for this many
     * seconds after he stands, so that no two come up on top of each other
     * (see entities/rising.ts).
     */
    riseHold: 1.5,
    /** Starts a grasp when the hero is this close and the grasp is off cooldown. */
    graspRange: 46,
    /** Seconds standing still with an arm raised before the grasp: the tell. */
    windUp: 0.55,
    /** The grasp lunges this far towards where the hero stood when the wind-up began... */
    graspDistance: 34,
    /** ...in this many seconds. */
    graspTime: 0.18,
    /** Dealt once per grasp that reaches the hero. */
    graspDamage: 20,
    /** Seconds motionless in the grasping pose after a grasp. */
    recover: 0.6,
    /** Seconds after recovering before he may grasp again. */
    cooldown: 2.0,
    /** Seconds into the run before the first utopets rises. */
    appearsAt: 90,
    /**
     * From then on, the chance that a spawned enemy is an utopets. The
     * chances of the kinds are taken from one roll, side by side (see
     * spawnedKind), so the upyr keeps its share.
     */
    share: 1 / 10,
    /** Worth of the spark he leaves when laid to rest. */
    xp: 15,
  },

  /**
   * The drowned water an utopets leaves where he is laid to rest: a
   * dark puddle that spreads, stays a while and dries away. While the
   * hero's feet are in it he wades at `slow` of his speed; enemies are not
   * slowed. It lies flat like everything on the ground (CFG.ground), so it
   * is `width` across and `flatten` of that from top to bottom.
   */
  drowned: {
    /** Seconds it takes to spread to its full size. */
    spread: 0.4,
    /** Seconds from when it was left until it starts to dry... */
    last: 14,
    /** ...and seconds it takes to dry away, shrinking to nothing. */
    dry: 2,
    /** The share of his speed the hero keeps while his feet are in it. */
    slow: 0.55,
    width: 44,
    /** Most puddles not yet drying at once; a new one makes the oldest start to dry early. */
    cap: 12,
  },

  /** The stake's flight; what grows with its level is in `items.stake`. */
  stake: {
    speed: 640,
    knockback: 160,
    /**
     * A volley of two flies side by side on parallel lines, one a little
     * above the hero's line and one a little below, this far apart; never
     * tilted.
     */
    spread: 14,
    /** Seconds after the first stake of a volley that the next one leaves. */
    stagger: 0.09,
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
   * The funeral bell: every so often it tolls over the hero and a ring runs
   * out along the ground from his feet, wounding once and throwing back
   * every enemy its front passes. How hard, how far and how often is in
   * `items.bell`.
   */
  bell: {
    /** Seconds the ring takes to run out to its radius. */
    spread: 0.4,
    /**
     * The front wounds an enemy it reaches in a step, or one up to this far
     * inside where it was at the step before, so that an enemy stepping
     * towards the hero as the front goes by is not missed.
     */
    slack: 8,
    /** Width of the ring's pale band as it leaves the hero, and as it reaches its radius. */
    band: [22, 5] as [number, number],
    /** Seconds the ring lingers at its radius, fading out. */
    linger: 0.15,
    /** Seconds the bell shows over the hero at a toll: it swings once and fades. */
    show: 0.9,
  },

  /**
   * The sickle: the hero reaps before him, up or down the screen the way he
   * last walked, sweeping a fan on the ground and cutting all the blade
   * passes over. How many ways, how hard, how far, how wide and how often
   * is in `items.sickle`.
   */
  sickle: {
    /**
     * A swing has three beats, like a drawn slash. The raise: the sickle
     * appears at the starting edge of the fan and is held there, drawing
     * back `drawBack` degrees, for `raise` seconds. The sweep: it crosses
     * the fan in `sweep` seconds, fastest in the middle and easing into the
     * far edge, cutting as it passes; nothing is cut before or after. The
     * rest: it stays at the far edge and fades out over `rest` seconds.
     */
    raise: 0.1,
    drawBack: 12,
    sweep: 0.26,
    rest: 0.18,
    /** A light push away from the hero. */
    knockback: 90,
    /**
     * The blade cuts what it passed over in a step, or an enemy up to this
     * far, in world units along the arc, behind where it was at the step
     * before, so that one stepping against the swing is not missed.
     */
    margin: 6,
    /** Height of the sickle above the ground it sweeps: about the hero's middle. */
    lift: 26,
    /** Where the middle of the sprite travels, as a share of the reach: the blade's tip reaches about the edge. */
    blade: 0.7,
    /**
     * The trail the blade leaves in the air: a crescent along the whole arc
     * swept so far, its outer edge on the reach, `width` of the reach wide
     * and brightest at the blade, tapering to nothing at the starting edge.
     * It is light added to the night, `alpha` at its brightest, and lingers
     * `linger` seconds after the sweep, fading. Its colour is TRAIL's.
     */
    trail: { width: 0.42, alpha: 0.9, linger: 0.2 },
  },

  /**
   * The black book: every so often it cuts signs into the ground under
   * enemies near the hero, which strike a moment later wherever they lie.
   * How many, how hard, how wide, how often and how soon is in
   * `items.book`.
   */
  book: {
    /** Signs are cut only under enemies whose ground point is within this distance of the hero's feet. */
    reach: 230,
    /** Seconds before it tries again when no enemy is within reach. */
    retry: 0.5,
    /** How bright a sign's light is when it is cut, as a share of its light just before it strikes. */
    faint: 0.12,
    /** Seconds the surge of light at the strike takes to die down. */
    surge: 0.15,
    /** Seconds the sign takes to fade out after it strikes. */
    fade: 0.5,
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
     * ways at once: 1 ahead, 2 ahead and behind. It works to the sides;
     * what is above and below him is the sickle's. Each way gets a volley
     * of `volley` stakes, side by side and a moment apart (see
     * CFG.stake.spread and stagger). Each stake flies straight for `range`,
     * wounds on its own and goes through `pierce` enemies; it never seeks
     * one.
     */
    stake: [
      { ways: 1, volley: 1, damage: 10, cooldown: 0.6, range: 120, pierce: 1 },
      { ways: 1, volley: 1, damage: 10, cooldown: 0.6, range: 170, pierce: 2 },
      { ways: 2, volley: 1, damage: 15, cooldown: 0.5, range: 170, pierce: 2 },
      { ways: 2, volley: 1, damage: 15, cooldown: 0.5, range: 240, pierce: 3 },
      { ways: 2, volley: 2, damage: 30, cooldown: 0.4, range: 240, pierce: 3 },
    ],
    /** `count` fangs, `radius` from the hero, one turn every `period` seconds. */
    teeth: [
      { count: 2, damage: 10, radius: 85, period: 1.6 },
      { count: 3, damage: 10, radius: 85, period: 1.6 },
      { count: 3, damage: 15, radius: 100, period: 1.6 },
      { count: 4, damage: 15, radius: 100, period: 1.6 },
      { count: 5, damage: 15, radius: 115, period: 1.6 },
    ],
    /**
     * Tolls every `cooldown` seconds; its ring runs out to `radius` (on the
     * ground, so flattened like CFG.ground) and wounds every enemy it passes
     * for `damage`, throwing it back away from where the bell tolled with
     * `knockback`. From level 1 it lays a navia to rest and throws back
     * what survives, an upyr above all, well clear of the hero.
     */
    bell: [
      { damage: 10, radius: 110, cooldown: 5.0, knockback: 600 },
      { damage: 10, radius: 140, cooldown: 5.0, knockback: 600 },
      { damage: 15, radius: 140, cooldown: 4.2, knockback: 600 },
      { damage: 15, radius: 170, cooldown: 4.2, knockback: 600 },
      { damage: 30, radius: 170, cooldown: 3.5, knockback: 600 },
    ],
    /**
     * Swung every `cooldown` seconds, whether or not anyone is there, before
     * the hero the way he last walked up or down the screen, never to the
     * sides: the blade sweeps a fan of `arc` degrees centred straight down
     * or straight up, out to `reach` from his feet on the ground (so
     * flattened like CFG.ground, shallower than it is wide), and cuts every
     * enemy it passes over for `damage`. With `ways` 2 he reaps up and down
     * at the same moment. It never seeks an enemy.
     */
    sickle: [
      { ways: 1, damage: 10, reach: 90, arc: 100, cooldown: 1.2 },
      { ways: 1, damage: 10, reach: 110, arc: 100, cooldown: 1.2 },
      { ways: 1, damage: 15, reach: 110, arc: 140, cooldown: 1.2 },
      { ways: 2, damage: 15, reach: 110, arc: 140, cooldown: 1.2 },
      { ways: 2, damage: 30, reach: 130, arc: 140, cooldown: 1.0 },
    ],
    /**
     * Every `cooldown` seconds cuts `count` signs into the ground, each under
     * a different enemy picked at random among those within `book.reach` of
     * the hero (fewer if there are fewer). A sign stays where it was cut and
     * strikes `delay` seconds later, wounding every enemy within `radius` of
     * it for `damage`; one that has walked off is missed. It never follows
     * anyone.
     */
    book: [
      { count: 1, damage: 15, radius: 45, cooldown: 4.0, delay: 0.9 },
      { count: 2, damage: 15, radius: 45, cooldown: 4.0, delay: 0.9 },
      { count: 2, damage: 25, radius: 55, cooldown: 4.0, delay: 0.9 },
      { count: 3, damage: 25, radius: 55, cooldown: 4.0, delay: 0.9 },
      { count: 4, damage: 25, radius: 55, cooldown: 3.0, delay: 0.9 },
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
export type UtopetsConfig = typeof CFG.utopets;
export type DrownedConfig = typeof CFG.drowned;
export type SparkConfig = typeof CFG.spark;
export type LevelConfig = typeof CFG.levels;
export type ItemLadders = typeof CFG.items;
export type StakeConfig = typeof CFG.stake;
export type TeethConfig = typeof CFG.teeth;
export type BellConfig = typeof CFG.bell;
export type SickleConfig = typeof CFG.sickle;
export type BookConfig = typeof CFG.book;

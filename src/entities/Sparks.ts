import Phaser from 'phaser';
import { COAL, colorAlong, colorHex, GRADE_COLORS, restingWing, smoulder, unfurl, WING } from '../art/coals';
import { ART_SCALE, coalFrame, greyTint, TEX, WING_FRAME } from '../art/textures';
import { CFG } from '../config';
import { NIGHT } from '../night/config';
import type { FireStamp } from '../night/FireHeat';
import { addSpark, dropSpark, sparkGrade, stepSpark, sweepSparks, type Point, type Spark } from './spark';

interface ShownSpark extends Spark {
  sprite: Phaser.GameObjects.Image;
  /** The wings it shows now, pooled: none, the one it rests with, or the two it flies on. */
  wings: Phaser.GameObjects.Image[];
  /** Whether it rests with a single wing, fixed at the drop. */
  winged: boolean;
  /** Where it was drawn last frame, to lay its trail in flight. */
  lastX: number;
  lastY: number;
}

/** A tiny spark rising from a coal on the ground. */
interface Speck {
  sprite: Phaser.GameObjects.Image;
  /** Its speed in world units per second, its age and its lifespan in seconds. */
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** The colours it fades through, from birth to death. */
  colors: readonly number[];
}

/**
 * The heat a gathered or merged spark leaves where it lay, dying away over
 * NIGHT.fire.fadeOut, so the fog closes in on its place instead of popping.
 */
interface Afterglow {
  x: number;
  y: number;
  grade: number;
  /** Its strength (0..1) when the spark left, and the clock then. */
  strength: number;
  at: number;
}

/** The dullest a coal smoulders, as a share of its full brightness. */
const SMOULDER_LOW = 0.72;
/** How much a coal's glow swells as it brightens, as a share of its size. */
const SWELL = 0.06;
/**
 * About one coal in five rests with a single wing, a hint of what it is: it
 * stands out to the coal's side at `angle` radians above level and stirs
 * slowly and weakly, `stir` radians either way `rate` times a second; it is
 * `size` of a full wing and `alpha` opaque.
 */
const REST_WING = { share: 0.2, angle: 0.4, stir: 0.12, rate: 0.35, size: 0.85, alpha: 0.6 };
/**
 * The wings a spark flies on, like a moth's: they unfurl from folded up
 * against the coal in `unfurl` seconds and beat `rate` times a second,
 * swinging `swing` radians either way about `elevation` above level and
 * foreshortening as they swing; `alpha` is their opacity. Folded, they
 * stand `folded` radians above level, `foldedSize` of a full wing.
 */
const FLIGHT_WINGS = {
  unfurl: 0.18,
  rate: 11,
  elevation: 0.35,
  swing: 0.75,
  alpha: 0.85,
  folded: 1.4,
  foldedSize: 0.3,
};
/** A wing is pale, lightly tinted by its coal's colour: this share of the way to white. */
const WING_TINTS = GRADE_COLORS.map((color) => colorHex(color, 0.7));

/** Within this distance of the eye a flying spark shrinks into the socket. */
const SHRINK_DISTANCE = 16;
/** The smallest it gets before it is gone, as a share of its size. */
const SHRINK_MIN = 0.3;
/**
 * A spark in flight is drawn over everyone in the layer: it is no longer on
 * the ground, and it ends in the skull, which burns over the hero.
 */
const FLIGHT_DEPTH = 1e9;

/**
 * The tiny sparks that keep breaking off a coal on the ground and drifting
 * up, fading from pale through its colour to dark as they rise: `rate`
 * per second from each coal on average, rising at `speed` world units per
 * second, wandering sideways by up to `drift`, gone in `life` seconds;
 * `size` is a spark's radius at birth in world units, shrinking to `shrink`
 * of it, and `alpha` its opacity at birth, fading to nothing.
 */
const RISE = {
  rate: 1.6,
  speed: { min: 9, max: 17 },
  drift: 4,
  life: { min: 0.6, max: 1.2 },
  size: 0.55,
  shrink: 0.3,
  alpha: 0.95,
};
/** Rising sparks are only shed by coals within this margin of the view, in world units. */
const RISE_MARGIN = 24;
/** The colours a rising spark of each grade fades through: pale, its own and dark. */
const RISE_COLORS = GRADE_COLORS.map((color) => [colorHex(color, 0.6), colorHex(color), colorHex(color, 0, 0.35)]);
/**
 * How far in front of its coal a rising spark is sorted: just enough to
 * show over the coal's glow, so whatever stands in front of the coal
 * covers its sparks as well.
 */
const RISE_DEPTH = 0.01;

/**
 * The short trail of sparks a spark leaves in flight: laid along its path
 * every `spacing` world units, they scatter a little at up to `speed`,
 * fade from pale through the coal's colour to dark and are gone in `life`
 * seconds; `size` is a spark's radius at birth in world units.
 */
const TRAIL = {
  spacing: 1.5,
  speed: 6,
  life: { min: 0.18, max: 0.38 },
  size: 0.7,
  alpha: 0.9,
};
/** Radius of the particle dot texture, in world units at scale 1. */
const DOT_RADIUS = 16;

/**
 * The sparks on the plane and in flight: drops them, moves them by the pure
 * logic in spark.ts and shows them. Lying sparks share the entity layer and
 * sort by their ground point, so a spark behind a standing stone is hidden
 * by it. Sprites are pooled.
 */
export class Sparks {
  private readonly field: ShownSpark[] = [];
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private readonly wingPool: Phaser.GameObjects.Image[] = [];
  private readonly specks: Speck[] = [];
  private readonly speckPool: Phaser.GameObjects.Image[] = [];
  private readonly afterglows: Afterglow[] = [];
  /** Every sprite that shows a spark's own light: the coals, their wings and the sparks they shed. */
  private readonly lights = new WeakSet<Phaser.GameObjects.GameObject>();
  /** The scene clock as of the last update, in seconds. */
  private clock = 0;

  /** One shared emitter per grade lays every flying spark's trail. */
  private readonly trails: Phaser.GameObjects.Particles.ParticleEmitter[];

  /**
   * `layer` is the depth-sorted entity layer the coals lie in, with the
   * sparks rising from them, which sort with their coal so that whatever
   * stands in front of it covers them too; `lights` is a layer of its own
   * over it for the additive trails of the sparks in flight, which are
   * drawn over everyone, so they never break the entities' batches.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    lights: Phaser.GameObjects.Layer,
  ) {
    this.trails = GRADE_COLORS.map((color) => {
      const emitter = scene.add.particles(0, 0, TEX.dot, {
        emitting: false,
        speed: { min: 0, max: TRAIL.speed },
        lifespan: { min: TRAIL.life.min * 1000, max: TRAIL.life.max * 1000 },
        scale: { start: TRAIL.size / DOT_RADIUS, end: (0.3 * TRAIL.size) / DOT_RADIUS },
        alpha: { start: TRAIL.alpha, end: 0 },
        color: [colorHex(color, 0.6), colorHex(color), colorHex(color, 0, 0.3)],
        blendMode: Phaser.BlendModes.ADD,
      });
      lights.add(emitter);
      return emitter;
    });
  }

  get size(): number {
    return this.field.length;
  }

  /** Whether `object` shows a spark's own light: a coal, a wing or a spark a coal sheds. */
  readonly glows = (object: Phaser.GameObjects.GameObject): boolean => this.lights.has(object);

  /**
   * A spark worth `worth` falls from a corpse standing on the ground point
   * (x, groundY), its body `height` above that.
   */
  drop(x: number, groundY: number, height: number, worth: number): void {
    const cfg = CFG.spark;
    const angle = Math.random() * Math.PI * 2;
    const curl = Math.random() < 0.5 ? -1 : 1;
    const phase = Math.random() * Math.PI * 2;
    const spark: ShownSpark = {
      ...dropSpark(x, groundY, height, worth, angle, curl, phase, cfg),
      sprite: this.pool.pop()?.setVisible(true) ?? this.addSprite(),
      wings: [],
      winged: restingWing(phase, REST_WING.share),
      lastX: x,
      lastY: groundY,
    };
    const merged = addSpark(this.field, spark, cfg.cap);
    if (merged) {
      if (onGround(merged)) this.leaveAfterglow(merged);
      this.release(merged);
    }
  }

  /**
   * Moves every spark: those within `reach` of the hero fly to the skull's
   * `eye`. Returns the worth absorbed this step.
   */
  update(dt: number, clock: number, hero: Point, eye: Point, reach = CFG.spark.pickupRadius): number {
    const cfg = CFG.spark;
    this.clock = clock;
    let absorbed = 0;
    const view = this.scene.cameras.main.worldView;
    const shed = RISE.rate * dt;
    this.riseSpecks(dt);
    for (const spark of this.field) {
      const wasOnGround = onGround(spark);
      const [x, y] = [spark.x, spark.y];
      absorbed += stepSpark(spark, hero, eye, dt, cfg, reach);
      // Drawn in: its heat stays behind on the ground and dies away.
      if (wasOnGround && spark.state === 'pulled') this.leaveAfterglow({ ...spark, x, y });
      this.place(spark, clock);
      if (onGround(spark) && Math.random() < shed && inView(view, spark.x, spark.y)) this.shed(spark);
    }
    sweepSparks(this.field, (spark) => this.release(spark));
    const fadeOut = NIGHT.fire.fadeOut;
    let kept = 0;
    for (const glow of this.afterglows) if (clock - glow.at < fadeOut) this.afterglows[kept++] = glow;
    this.afterglows.length = kept;
    return absorbed;
  }

  /**
   * Hands every fire's heat on the ground to `stamp`: the lying sparks,
   * growing in after the drop, and the afterglows of those gone.
   */
  fires(stamp: FireStamp): void {
    const { fadeIn, fadeOut } = NIGHT.fire;
    for (const spark of this.field) {
      if (!onGround(spark)) continue;
      const grade = sparkGrade(spark.worth, CFG.spark.grades);
      stamp.heat(spark.x, spark.y, grade, this.strength(spark, fadeIn));
    }
    for (const glow of this.afterglows) {
      const left = fadeOut > 0 ? 1 - (this.clock - glow.at) / fadeOut : 0;
      stamp.heat(glow.x, glow.y, glow.grade, glow.strength * Math.max(0, left));
    }
  }

  /** How far a spark on the ground has grown into its heat (0..1). */
  private strength(spark: Spark, fadeIn: number): number {
    return fadeIn > 0 ? Math.min(1, spark.age / fadeIn) : 1;
  }

  private leaveAfterglow(spark: Spark): void {
    this.afterglows.push({
      x: spark.x,
      y: spark.y,
      grade: sparkGrade(spark.worth, CFG.spark.grades),
      strength: this.strength(spark, NIGHT.fire.fadeIn),
      at: this.clock,
    });
  }

  /**
   * Syncs the sprites to the spark: a coal of its grade hovering over its
   * ground point and smouldering out of step with its neighbours, some with
   * a wing at rest; in flight it shrinks into the socket as it arrives.
   */
  private place(spark: ShownSpark, clock: number): void {
    const sprite = spark.sprite;
    // A merged spark can climb the grades, so the look is chosen every frame.
    const grade = sparkGrade(spark.worth, CFG.spark.grades);
    const glow = smoulder(clock, spark.phase, SMOULDER_LOW);
    // Its light on the soil shows once it lies on the ground, and stays there when it rises.
    sprite.setFrame(coalFrame(grade, spark.state === 'lying')).setTint(greyTint(glow));
    let scale = (1 - SWELL * (1 - glow)) / ART_SCALE;

    if (spark.state === 'pulled' || spark.state === 'absorbed') {
      const shrink = Phaser.Math.Clamp(spark.gap / SHRINK_DISTANCE, SHRINK_MIN, 1);
      scale *= shrink;
      this.layTrail(spark, grade);
      sprite.setPosition(spark.x, spark.y).setDepth(FLIGHT_DEPTH);
      this.showWings(spark, 2);
      this.beatWings(spark, grade, shrink);
    } else {
      const heartY = spark.y - CFG.spark.hover - spark.lift;
      sprite.setPosition(spark.x, heartY).setDepth(spark.y);
      this.showWings(spark, spark.winged ? 1 : 0);
      if (spark.winged) {
        const rest = REST_WING;
        const stir = rest.stir * Math.sin(Math.PI * 2 * rest.rate * clock + spark.phase);
        // Just behind its coal, so the coal covers the root.
        poseWing(spark.wings[0], spark.x, heartY, spark.curl, rest.angle + stir, rest.size, rest.size, rest.alpha)
          .setTint(WING_TINTS[grade])
          .setDepth(spark.y - 0.01);
      }
    }
    spark.lastX = spark.x;
    spark.lastY = spark.y;
    sprite.setScale(scale);
  }

  /**
   * Unfurls the wings of a spark in flight and beats them, the first on the
   * side it rests its wing on, if it has one, so that wing rises from where
   * it lay. They shrink with the coal into the socket.
   */
  private beatWings(spark: ShownSpark, grade: number, shrink: number): void {
    const fly = FLIGHT_WINGS;
    const rest = REST_WING;
    const u = unfurl(spark.flight, fly.unfurl);
    const beat = Math.PI * 2 * fly.rate * spark.flight + spark.phase;
    const elevation = fly.elevation + fly.swing * Math.sin(beat);
    // Seen end-on at the top and bottom of the stroke, a wing looks shorter.
    const length = 0.85 + 0.15 * Math.cos(2 * beat);
    spark.wings.forEach((wing, i) => {
      const resting = i === 0 && spark.winged;
      const from = resting
        ? { elevation: rest.angle, size: rest.size, alpha: rest.alpha }
        : { elevation: fly.folded, size: fly.foldedSize, alpha: 0 };
      const size = shrink * Phaser.Math.Linear(from.size, 1, u);
      poseWing(
        wing,
        spark.x,
        spark.y,
        i === 0 ? spark.curl : -spark.curl,
        Phaser.Math.Linear(from.elevation, elevation, u),
        size * Phaser.Math.Linear(1, length, u),
        size,
        Phaser.Math.Linear(from.alpha, fly.alpha, u),
      )
        .setTint(WING_TINTS[grade])
        .setDepth(FLIGHT_DEPTH - 0.5);
    });
  }

  /**
   * A tiny spark breaks off the coal's heart and starts to rise. It is drawn
   * as light added to what is under it (TEX.speck), like the trails.
   */
  private shed(spark: ShownSpark): void {
    const grade = sparkGrade(spark.worth, CFG.spark.grades);
    const x = spark.x + (Math.random() - 0.5) * 2 * COAL.core;
    const y = spark.y - CFG.spark.hover - spark.lift - 0.5 * COAL.core;
    const between = (range: { min: number; max: number }) => Phaser.Math.FloatBetween(range.min, range.max);
    const colors = RISE_COLORS[grade];
    const sprite = (this.speckPool.pop()?.setVisible(true) ?? this.addSpeck())
      .setPosition(x, y)
      .setDepth(spark.y + RISE_DEPTH)
      .setScale(RISE.size / DOT_RADIUS)
      .setAlpha(RISE.alpha)
      .setTint(colors[0]);
    this.specks.push({
      sprite,
      vx: Phaser.Math.FloatBetween(-RISE.drift, RISE.drift),
      vy: -between(RISE.speed),
      age: 0,
      life: between(RISE.life),
      colors,
    });
  }

  /** Moves the rising sparks on by `dt` seconds, shrinking and fading them, and puts away those gone. */
  private riseSpecks(dt: number): void {
    let kept = 0;
    for (const speck of this.specks) {
      speck.age += dt;
      if (speck.age >= speck.life) {
        this.speckPool.push(speck.sprite.setVisible(false));
        continue;
      }
      const t = speck.age / speck.life;
      const sprite = speck.sprite;
      sprite
        .setPosition(sprite.x + speck.vx * dt, sprite.y + speck.vy * dt)
        .setScale((RISE.size * Phaser.Math.Linear(1, RISE.shrink, t)) / DOT_RADIUS)
        .setAlpha(RISE.alpha * (1 - t))
        .setTint(colorAlong(speck.colors, t));
      this.specks[kept++] = speck;
    }
    this.specks.length = kept;
  }

  /**
   * Lays the trail along the step the spark just made. The steps are short
   * and turn a little each frame, so the specks follow the curve.
   */
  private layTrail(spark: ShownSpark, grade: number): void {
    const emitter = this.trails[grade];
    const dx = spark.x - spark.lastX;
    const dy = spark.y - spark.lastY;
    const count = Math.ceil(Math.hypot(dx, dy) / TRAIL.spacing);
    for (let i = 1; i <= count; i++) emitter.emitParticleAt(spark.lastX + (dx * i) / count, spark.lastY + (dy * i) / count);
  }

  /** Gives the spark `count` wings, taking them from the pool or returning them to it. */
  private showWings(spark: ShownSpark, count: number): void {
    const wings = spark.wings;
    while (wings.length > count) this.wingPool.push(wings.pop()!.setVisible(false));
    while (wings.length < count) wings.push(this.wingPool.pop()?.setVisible(true) ?? this.addWing());
  }

  private release(spark: ShownSpark): void {
    this.showWings(spark, 0);
    this.pool.push(spark.sprite.setVisible(false));
  }

  private addWing(): Phaser.GameObjects.Image {
    // The origin is the wing's root, where it grows from the coal.
    const frame = WING.frame;
    const wing = this.scene.add.image(0, 0, TEX.coal, WING_FRAME).setOrigin(-frame.left / frame.width, -frame.top / frame.height);
    this.layer.add(wing);
    this.lights.add(wing);
    return wing;
  }

  private addSpeck(): Phaser.GameObjects.Image {
    const speck = this.scene.add.image(0, 0, TEX.speck);
    this.layer.add(speck);
    this.lights.add(speck);
    return speck;
  }

  private addSprite(): Phaser.GameObjects.Image {
    // The origin is the coal's heart: the point where the spark is.
    const frame = COAL.frame;
    const sprite = this.scene.add.image(0, 0, TEX.coal, 0).setOrigin(-frame.left / frame.width, -frame.top / frame.height);
    this.layer.add(sprite);
    this.lights.add(sprite);
    return sprite;
  }
}

/**
 * Sets a wing growing from (x, y) out to the right (`side` 1) or the left
 * (-1), raised `elevation` radians above level, `length` and `width` of a
 * full wing and `alpha` opaque.
 */
function poseWing(
  wing: Phaser.GameObjects.Image,
  x: number,
  y: number,
  side: number,
  elevation: number,
  length: number,
  width: number,
  alpha: number,
): Phaser.GameObjects.Image {
  // Mirrored for the left wing; the leading edge stays on top either way.
  return wing
    .setPosition(x, y)
    .setRotation(-side * elevation)
    .setScale((side * length) / ART_SCALE, width / ART_SCALE)
    .setAlpha(alpha);
}

function inView(view: Phaser.Geom.Rectangle, x: number, y: number): boolean {
  return (
    x > view.x - RISE_MARGIN &&
    x < view.right + RISE_MARGIN &&
    y > view.y - RISE_MARGIN &&
    y < view.bottom + RISE_MARGIN
  );
}

function onGround(spark: Spark): boolean {
  return spark.state === 'settling' || spark.state === 'lying';
}

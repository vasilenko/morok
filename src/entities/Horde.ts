import Phaser from 'phaser';
import { ANIM, ART_SCALE, TEX } from '../art/textures';
import { CFG } from '../config';
import { SpatialGrid } from '../systems/SpatialGrid';

/** A navia: one of the restless dead that swarm the hero. */
export interface Navia {
  x: number;
  y: number;
  hp: number;
  radius: number;
  speed: number;
  /** Knockback velocity, decays quickly. */
  kx: number;
  ky: number;
  /** Seconds of hit flash left. */
  flash: number;
  /** Per-enemy offset so the crowd does not bob in unison. */
  phase: number;
  /** Facing left, towards a hero on that side. */
  flipped: boolean;
  dead: boolean;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
}

interface Target {
  x: number;
  y: number;
}

/** Cold multiply tint that sets the pale dead apart from the warm-toned hero. */
const COLD_TINT = 0xd6f2ff;
/** Where the shadow falls below a navia's position; she floats above it. */
const SHADOW_Y = 18;
/** How far the figure is lifted above its position, before the bob. */
const LIFT = 4;
/** Shadow width in world units; small and faint, as she floats. */
const SHADOW_WIDTH = 24;
/**
 * The art flies forward and up at about this angle (negative is up the
 * screen), so a sprite rotated by `elevation - ART_LEAN` heads along
 * `elevation`.
 */
const ART_LEAN = Phaser.Math.DegToRad(-30);
/** Tilt limits, so steep approaches lean the figure without standing it on end. */
const TILT_MIN = Phaser.Math.DegToRad(-35);
const TILT_MAX = Phaser.Math.DegToRad(50);
/**
 * Amplitude of the idle rotation wobble. Kept small: the baked shroud ripple
 * already carries the motion, and a wider sway rocks the still head with it.
 */
const WOBBLE = Phaser.Math.DegToRad(2);
/** Per-enemy ripple speed varies by up to this fraction either way, so the crowd falls out of step. */
const RIPPLE_SPEED_SPREAD = 0.15;
/** How far the hero must be to one side before a navia turns, to avoid flicker. */
const TURN_DEADZONE = 2;

/** All living enemies: spawning, movement, crowding and their sprites. */
export class Horde {
  list: Navia[] = [];
  /** Rebuilt at the start of every update; weapons query it for hits. */
  readonly grid = new SpatialGrid<Navia>(40);

  private readonly spritePool: Phaser.GameObjects.Sprite[] = [];
  private readonly shadowPool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly entityLayer: Phaser.GameObjects.Layer,
    private readonly shadowLayer: Phaser.GameObjects.Layer,
  ) {}

  get size(): number {
    return this.list.length;
  }

  /** `elapsed` is the time survived so far; later arrivals are a little faster. */
  spawn(x: number, y: number, elapsed: number): void {
    if (this.list.length >= CFG.spawn.maxEnemies) return;
    const cfg = CFG.navia;
    const sprite = this.takeSprite();
    this.list.push({
      x,
      y,
      hp: cfg.hp,
      radius: cfg.radius,
      speed: (cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin)) * (1 + elapsed / 600),
      kx: 0,
      ky: 0,
      flash: 0,
      phase: Math.random() * 4,
      flipped: false,
      dead: false,
      sprite,
      shadow: this.takeShadow(),
    });
  }

  /**
   * Moves everyone towards the target. Stragglers further than `farLimit`
   * are brought back to `respawnRadius`. Returns whether anyone is touching
   * the target this frame.
   */
  update(dt: number, clock: number, target: Target, respawnRadius: number, farLimit: number): boolean {
    this.grid.rebuild(this.list);
    const damping = Math.exp(-9 * dt);
    const reach = CFG.player.radius;
    let touching = false;

    for (const navia of this.list) {
      let dx = target.x - navia.x;
      let dy = target.y - navia.y;
      let distance = Math.hypot(dx, dy) || 1;

      if (distance > farLimit) {
        const angle = Math.random() * Math.PI * 2;
        navia.x = target.x + Math.cos(angle) * respawnRadius;
        navia.y = target.y + Math.sin(angle) * respawnRadius;
        this.place(navia, clock, target);
        continue;
      }

      navia.x += ((dx / distance) * navia.speed + navia.kx) * dt;
      navia.y += ((dy / distance) * navia.speed + navia.ky) * dt;
      navia.kx *= damping;
      navia.ky *= damping;

      // keep the crowd from collapsing into a single point
      this.grid.forEachNear(navia.x, navia.y, (other) => {
        if (other === navia) return;
        const ox = navia.x - other.x;
        const oy = navia.y - other.y;
        const min = navia.radius + other.radius;
        const d2 = ox * ox + oy * oy;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.25;
          navia.x += (ox / d) * push;
          navia.y += (oy / d) * push;
        }
      });

      // stop at the target's edge instead of walking through it
      dx = target.x - navia.x;
      dy = target.y - navia.y;
      distance = Math.hypot(dx, dy) || 1;
      const contact = navia.radius + reach;
      if (distance < contact) {
        navia.x -= (dx / distance) * (contact - distance);
        navia.y -= (dy / distance) * (contact - distance);
        touching = true;
      }

      if (navia.flash > 0) {
        navia.flash -= dt;
        if (navia.flash <= 0) navia.sprite.setTint(COLD_TINT).setTintMode(Phaser.TintModes.MULTIPLY);
      }
      this.place(navia, clock, target);
    }
    return touching;
  }

  /** Applies damage and knockback. Returns whether the navia died. */
  damage(navia: Navia, amount: number, knockX: number, knockY: number): boolean {
    navia.hp -= amount;
    navia.kx += knockX;
    navia.ky += knockY;
    navia.flash = 0.09;
    navia.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    if (navia.hp > 0) return false;
    navia.dead = true;
    return true;
  }

  /** Drops the dead from the list and returns their sprites to the pools. */
  removeDead(): void {
    let alive = 0;
    for (const navia of this.list) {
      if (!navia.dead) {
        this.list[alive++] = navia;
        continue;
      }
      // Hidden sprites still tick their animation, so stop it until reuse.
      navia.sprite.stop().setVisible(false);
      navia.shadow.setVisible(false);
      this.spritePool.push(navia.sprite);
      this.shadowPool.push(navia.shadow);
    }
    this.list.length = alive;
  }

  /** Turns the navia towards the target and tilts her along her approach. */
  private place(navia: Navia, clock: number, target: Target): void {
    const dx = target.x - navia.x;
    const dy = target.y - navia.y;
    if (Math.abs(dx) > TURN_DEADZONE) navia.flipped = dx < 0;

    // Elevation of the approach above or below horizontal, positive heading
    // down the screen. The art already leans up, so tilt by the difference.
    const elevation = Math.atan2(dy, Math.abs(dx));
    const tilt = Phaser.Math.Clamp(elevation - ART_LEAN, TILT_MIN, TILT_MAX);
    const wobble = Math.sin(clock * 2.6 + navia.phase * 2.3) * WOBBLE;
    const bob = Math.sin(clock * 4 + navia.phase * 1.7) * 1.5;

    navia.sprite
      .setPosition(navia.x, navia.y - LIFT + bob)
      // A flipped sprite is mirrored, so the same tilt must turn the other way.
      .setRotation((navia.flipped ? -tilt : tilt) + wobble)
      .setFlipX(navia.flipped)
      // Sorted by the point under her, where her shadow falls.
      .setDepth(navia.y + SHADOW_Y);
    navia.shadow.setPosition(navia.x, navia.y + SHADOW_Y);
  }

  /**
   * A sprite from the pool or a new one, with the resting tint and the
   * ripple restarted (on a random frame, see createAnimations) at a slightly
   * random speed.
   */
  private takeSprite(): Phaser.GameObjects.Sprite {
    const sprite = this.spritePool.pop()?.setVisible(true) ?? this.addSprite();
    return sprite
      .setTint(COLD_TINT)
      .setTintMode(Phaser.TintModes.MULTIPLY)
      .play({
        key: ANIM.naviaFly,
        timeScale: 1 + Phaser.Math.FloatBetween(-RIPPLE_SPEED_SPREAD, RIPPLE_SPEED_SPREAD),
      });
  }

  private addSprite(): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(0, 0, TEX.navia).setScale(1 / ART_SCALE);
    this.entityLayer.add(sprite);
    return sprite;
  }

  private takeShadow(): Phaser.GameObjects.Image {
    const pooled = this.shadowPool.pop();
    if (pooled) return pooled.setVisible(true);
    const shadow = this.scene.add.image(0, 0, TEX.shadow).setScale(SHADOW_WIDTH / 28 / ART_SCALE).setAlpha(0.3);
    this.shadowLayer.add(shadow);
    return shadow;
  }
}

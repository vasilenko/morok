import Phaser from 'phaser';
import { ANIM, ART_SCALE, TEX, VOLHV_FRAMES } from '../art/textures';
import { CFG } from '../config';

export interface PlayerLayers {
  shadows: Phaser.GameObjects.Layer;
  entities: Phaser.GameObjects.Layer;
  overhead: Phaser.GameObjects.Layer;
}

const HP_BAR_WIDTH = 34;
/** Where the feet touch the ground, below the hero's position. */
const FEET_Y = 20;
/**
 * The ground point between the boots of the standing frame of the volhv
 * sheet, as a fraction of the frame size. The figure is not centred over
 * its feet (the cape trails behind, the staff leads), so the sprite pivots
 * here; flipping mirrors the texture within its frame, so the x is mirrored
 * too when facing left.
 */
const FEET_ORIGIN = { x: 0.39, y: 0.975 };
/**
 * How far the body sinks between the "up" and the "down" frames of the
 * walk, in world units. The drawn frames move only the legs; this gives
 * the step its weight.
 */
const WALK_BOB = 1.25;
/**
 * The visible eye socket of the bird skull on the staff, where the lantern
 * burns, relative to the feet pivot in world units for the right-facing
 * art. Measured on the volhv sheet, where staff and skull hold still in all
 * eight frames: the socket is the dark 4x4 pixel blot centred at (123, 43.5)
 * in the 134x172 frame; the pivot is FEET_ORIGIN of it, (52.3, 167.7), and
 * the art holds ART_SCALE pixels per unit. Mirrored in x when facing left.
 */
const SKULL_EYE = { x: 23.6, y: -41.4 };
/** Shadow width in world units; wide enough for the stance and the staff. */
const SHADOW_WIDTH = 32;

/** The hero: position, health and the sprites that show them. */
export class Player {
  x = 0;
  y = 0;
  hp = CFG.player.hp;
  /** Seconds of invulnerability left after a hit. */
  invulnerable = 0;
  /** 1 when facing right, -1 when facing left. */
  facing = 1;
  /**
   * The way he last walked up or down the screen: 1 down, towards the
   * viewer, -1 up. Kept when he stops or walks only to the sides; he starts
   * turned down.
   */
  facingY = 1;
  moving = false;
  /** Vertical offset of the drawn figure for the current walk frame. */
  private bob = 0;

  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly hpBack: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, layers: PlayerLayers) {
    // The shadow texture is 28 units wide.
    this.shadow = scene.add.image(0, 0, TEX.shadow).setScale(SHADOW_WIDTH / 28 / ART_SCALE).setAlpha(0.45);
    layers.shadows.add(this.shadow);

    this.sprite = scene.add.sprite(0, 0, TEX.volhv, VOLHV_FRAMES.stand).setScale(1 / ART_SCALE);
    layers.entities.add(this.sprite);

    this.hpBack = scene.add.rectangle(0, 0, HP_BAR_WIDTH + 2, 5, 0x07090b).setVisible(false);
    this.hpFill = scene.add.rectangle(0, 0, HP_BAR_WIDTH, 3, 0xb3262b).setOrigin(0, 0.5).setVisible(false);
    layers.overhead.add([this.hpBack, this.hpFill]);
  }

  get dead(): boolean {
    return this.hp <= 0;
  }

  /**
   * Moves along the given direction (components in -1..1) at `pace` of his
   * speed, and ticks timers.
   */
  update(dt: number, dirX: number, dirY: number, pace = 1): void {
    this.moving = dirX !== 0 || dirY !== 0;
    if (this.moving) {
      const length = Math.hypot(dirX, dirY);
      const speed = CFG.player.speed * pace;
      this.x += (dirX / length) * speed * dt;
      this.y += (dirY / length) * speed * dt;
      if (dirX !== 0) this.facing = dirX;
      if (dirY !== 0) this.facingY = Math.sign(dirY);
    }
    if (this.invulnerable > 0) this.invulnerable -= dt;
  }

  /** Where the feet touch the ground: the point that collides with scenery. */
  get feetY(): number {
    return this.y + FEET_Y;
  }

  /** The burning eye of the skull on the staff, as last drawn, in world coordinates. */
  get skullEye(): { x: number; y: number } {
    return { x: this.x + this.facing * SKULL_EYE.x, y: this.feetY + this.bob + SKULL_EYE.y };
  }

  /** Moves the hero so that his feet stand at the given ground point. */
  placeFeet(x: number, feetY: number): void {
    this.x = x;
    this.y = feetY - FEET_Y;
  }

  /** Applies a hit unless still invulnerable. Returns whether it landed. */
  hurt(damage: number): boolean {
    if (this.invulnerable > 0 || this.dead) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.invulnerable = CFG.player.invulnerability;
    return true;
  }

  /** Syncs sprites to the current state. */
  draw(): void {
    this.animate();
    this.bob = this.moving ? this.walkBob() : 0;
    const blink = this.invulnerable > 0 && Math.floor(this.invulnerable * 14) % 2 === 0;

    const flipped = this.facing < 0;
    this.shadow.setPosition(this.x, this.y + FEET_Y);
    this.sprite
      .setOrigin(flipped ? 1 - FEET_ORIGIN.x : FEET_ORIGIN.x, FEET_ORIGIN.y)
      .setPosition(this.x, this.y + FEET_Y + this.bob)
      .setFlipX(flipped)
      .setAlpha(blink ? 0.45 : 1)
      // Sorted by where the feet meet the ground, like scenery by its base.
      .setDepth(this.y + FEET_Y);

    // Just below the shadow, clear of the figure.
    const hurt = this.hp < CFG.player.hp;
    this.hpBack.setVisible(hurt).setPosition(this.x, this.y + 30);
    this.hpFill.setVisible(hurt).setPosition(this.x - HP_BAR_WIDTH / 2, this.y + 30);
    this.hpFill.width = HP_BAR_WIDTH * (this.hp / CFG.player.hp);
  }

  /**
   * Walks while moving and holds the standing frame otherwise. The cycle
   * starts on the frame after the standing one, so the first step follows
   * on from the pose the hero stood in.
   */
  private animate(): void {
    const walking = this.sprite.anims.isPlaying;
    if (this.moving && !walking) {
      this.sprite.play({ key: ANIM.volhvWalk, startFrame: (VOLHV_FRAMES.stand + 1) % VOLHV_FRAMES.count });
    } else if (!this.moving && walking) {
      this.sprite.stop().setFrame(VOLHV_FRAMES.stand);
    }
  }

  /**
   * Vertical offset for the current walk frame, positive downwards: lowest
   * on the two "down" frames, highest on the two "up" frames two frames
   * later, level on contact and passing.
   */
  private walkBob(): number {
    const step = Number(this.sprite.frame.name) - VOLHV_FRAMES.firstDown;
    return (WALK_BOB / 2) * Math.cos((step / VOLHV_FRAMES.count) * 4 * Math.PI);
  }
}

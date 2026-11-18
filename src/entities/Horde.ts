import Phaser from 'phaser';
import { ART_SCALE, TEX } from '../art/textures';
import { CFG } from '../config';
import { SpatialGrid } from '../systems/SpatialGrid';
import { wound, type Enemy, type EnemyKind, type Strike, type Target } from './enemy';
import { NAVIA } from './navia';

/** Width of the shadow texture in world units. */
const SHADOW_TEXTURE_WIDTH = 28;

/**
 * All living enemies, of every kind: spawning, movement, crowding and their
 * sprites. Each kind decides how its enemies move and look (see EnemyKind);
 * the crowd is one, so every enemy makes room for every other.
 */
export class Horde {
  list: Enemy[] = [];
  /** Rebuilt at the start of every update; weapons query it for hits. */
  readonly grid = new SpatialGrid<Enemy>(40);

  /** Sprites are pooled per kind, as each kind sets its own texture, origin and animation. */
  private readonly spritePools = new Map<EnemyKind, Phaser.GameObjects.Sprite[]>();
  private readonly shadowPool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly entityLayer: Phaser.GameObjects.Layer,
    private readonly shadowLayer: Phaser.GameObjects.Layer,
  ) {}

  get size(): number {
    return this.list.length;
  }

  /** `elapsed` is the time survived so far. Returns the new enemy, or null when the horde is full. */
  spawn(x: number, y: number, elapsed: number, kind: EnemyKind = NAVIA): Enemy | null {
    if (this.list.length >= CFG.spawn.maxEnemies) return null;
    const sprite = this.takeSprite(kind);
    const { hp, radius, speed, state } = kind.create(elapsed);
    const enemy: Enemy = {
      kind,
      state,
      x,
      y,
      hp,
      radius,
      speed,
      kx: 0,
      ky: 0,
      flash: 0,
      phase: Math.random() * 4,
      flipped: false,
      dead: false,
      sprite,
      shadow: this.takeShadow(kind),
    };
    this.list.push(enemy);
    return enemy;
  }

  /**
   * Moves everyone towards the target. Stragglers further than `farLimit`
   * are brought back to `respawnRadius`. Attacks deal their damage through
   * `strike`. Returns the damage of the worst enemy touching the target
   * this frame, 0 if none is.
   */
  update(dt: number, clock: number, target: Target, respawnRadius: number, farLimit: number, strike: Strike): number {
    this.grid.rebuild(this.list);
    const damping = Math.exp(-9 * dt);
    const reach = CFG.player.radius;
    let contact = 0;

    for (const enemy of this.list) {
      let dx = target.x - enemy.x;
      let dy = target.y - enemy.y;
      let distance = Math.hypot(dx, dy) || 1;

      if (distance > farLimit) {
        const angle = Math.random() * Math.PI * 2;
        enemy.x = target.x + Math.cos(angle) * respawnRadius;
        enemy.y = target.y + Math.sin(angle) * respawnRadius;
        enemy.kind.place(enemy, clock, target);
        continue;
      }

      enemy.kind.steer(enemy, dt, target, strike);
      if (enemy.kind.anchored(enemy)) {
        enemy.kx = 0;
        enemy.ky = 0;
      } else {
        enemy.x += enemy.kx * dt;
        enemy.y += enemy.ky * dt;
        enemy.kx *= damping;
        enemy.ky *= damping;
        this.separate(enemy);
      }

      // stop at the target's edge instead of walking through it
      const damage = enemy.kind.contactDamage(enemy);
      if (damage > 0) {
        dx = target.x - enemy.x;
        dy = target.y - enemy.y;
        distance = Math.hypot(dx, dy) || 1;
        const touch = enemy.radius + reach;
        if (distance < touch) {
          enemy.x -= (dx / distance) * (touch - distance);
          enemy.y -= (dy / distance) * (touch - distance);
          contact = Math.max(contact, damage);
        }
      }

      if (enemy.flash > 0) {
        enemy.flash -= dt;
        if (enemy.flash <= 0) enemy.kind.rest(enemy.sprite);
      }
      enemy.kind.place(enemy, clock, target);
    }
    return contact;
  }

  /**
   * Applies damage and knockback, of which the enemy's kind takes its share
   * (see EnemyKind.knockback). Returns whether the enemy died.
   */
  damage(enemy: Enemy, amount: number, knockX: number, knockY: number): boolean {
    if (!enemy.kind.anchored(enemy)) {
      enemy.kx += knockX * enemy.kind.knockback;
      enemy.ky += knockY * enemy.kind.knockback;
    }
    enemy.flash = 0.09;
    enemy.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    return wound(enemy, amount);
  }

  /** Drops the dead from the list, hands each to `fallen` and returns their sprites to the pools. */
  removeDead(fallen: (enemy: Enemy) => void): void {
    let alive = 0;
    for (const enemy of this.list) {
      if (!enemy.dead) {
        this.list[alive++] = enemy;
        continue;
      }
      fallen(enemy);
      // Hidden sprites still tick their animation, so stop it until reuse.
      enemy.sprite.stop().setVisible(false);
      enemy.shadow.setVisible(false);
      this.poolOf(enemy.kind).push(enemy.sprite);
      this.shadowPool.push(enemy.shadow);
    }
    this.list.length = alive;
  }

  /** Keeps the crowd from collapsing into a single point. */
  private separate(enemy: Enemy): void {
    this.grid.forEachNear(enemy.x, enemy.y, (other) => {
      if (other === enemy) return;
      const ox = enemy.x - other.x;
      const oy = enemy.y - other.y;
      const min = enemy.radius + other.radius;
      const d2 = ox * ox + oy * oy;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.25;
        enemy.x += (ox / d) * push;
        enemy.y += (oy / d) * push;
      }
    });
  }

  private poolOf(kind: EnemyKind): Phaser.GameObjects.Sprite[] {
    let pool = this.spritePools.get(kind);
    if (!pool) {
      pool = [];
      this.spritePools.set(kind, pool);
    }
    return pool;
  }

  /** A sprite of the kind from the pool or a new one, dressed by the kind. */
  private takeSprite(kind: EnemyKind): Phaser.GameObjects.Sprite {
    const sprite = this.poolOf(kind).pop()?.setVisible(true) ?? this.addSprite(kind);
    kind.dress(sprite);
    return sprite;
  }

  private addSprite(kind: EnemyKind): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(0, 0, kind.texture).setScale(1 / ART_SCALE);
    this.entityLayer.add(sprite);
    return sprite;
  }

  /** A shadow from the pool or a new one, sized for the kind. */
  private takeShadow(kind: EnemyKind): Phaser.GameObjects.Image {
    const shadow = this.shadowPool.pop()?.setVisible(true) ?? this.addShadow();
    return shadow.setScale(kind.shadowWidth / SHADOW_TEXTURE_WIDTH / ART_SCALE).setAlpha(kind.shadowAlpha);
  }

  private addShadow(): Phaser.GameObjects.Image {
    const shadow = this.scene.add.image(0, 0, TEX.shadow);
    this.shadowLayer.add(shadow);
    return shadow;
  }
}

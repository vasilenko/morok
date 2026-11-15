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
  dead: boolean;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
}

interface Target {
  x: number;
  y: number;
}

const SWAY_FRAMES = 4;

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
    sprite.play({ key: ANIM.naviaSway, startFrame: Math.floor(Math.random() * SWAY_FRAMES) });
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
        this.place(navia, clock);
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
        if (navia.flash <= 0) navia.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
      }
      this.place(navia, clock);
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
      navia.sprite.stop().setVisible(false).setTintMode(Phaser.TintModes.MULTIPLY);
      navia.shadow.setVisible(false);
      this.spritePool.push(navia.sprite);
      this.shadowPool.push(navia.shadow);
    }
    this.list.length = alive;
  }

  private place(navia: Navia, clock: number): void {
    const bob = Math.sin(clock * 4 + navia.phase * 1.7) * 1.5;
    navia.sprite.setPosition(navia.x, navia.y - 2 + bob).setDepth(navia.y);
    navia.shadow.setPosition(navia.x, navia.y + 17);
  }

  private takeSprite(): Phaser.GameObjects.Sprite {
    const pooled = this.spritePool.pop();
    if (pooled) return pooled.setVisible(true);
    const sprite = this.scene.add.sprite(0, 0, TEX.navia, 0).setScale(1 / ART_SCALE);
    this.entityLayer.add(sprite);
    return sprite;
  }

  private takeShadow(): Phaser.GameObjects.Image {
    const pooled = this.shadowPool.pop();
    if (pooled) return pooled.setVisible(true);
    const shadow = this.scene.add.image(0, 0, TEX.shadow).setScale(20 / 28 / ART_SCALE).setAlpha(0.38);
    this.shadowLayer.add(shadow);
    return shadow;
  }
}

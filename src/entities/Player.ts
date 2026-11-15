import Phaser from 'phaser';
import { ART_SCALE, TEX } from '../art/textures';
import { CFG } from '../config';

export interface PlayerLayers {
  ground: Phaser.GameObjects.Layer;
  shadows: Phaser.GameObjects.Layer;
  entities: Phaser.GameObjects.Layer;
  overhead: Phaser.GameObjects.Layer;
}

const HP_BAR_WIDTH = 34;

/** The hero: position, health and the sprites that show them. */
export class Player {
  x = 0;
  y = 0;
  hp = CFG.player.hp;
  /** Seconds of invulnerability left after a hit. */
  invulnerable = 0;
  /** 1 when facing right, -1 when facing left. */
  facing = 1;
  moving = false;

  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly light: Phaser.GameObjects.Image;
  private readonly hpBack: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, layers: PlayerLayers) {
    this.light = scene.add.image(0, 0, TEX.light).setDisplaySize(380, 380);
    layers.ground.add(this.light);

    this.shadow = scene.add.image(0, 0, TEX.shadow).setScale(1 / ART_SCALE).setAlpha(0.45);
    layers.shadows.add(this.shadow);

    this.sprite = scene.add.image(0, 0, TEX.volhv).setScale(1 / ART_SCALE);
    layers.entities.add(this.sprite);

    this.hpBack = scene.add.rectangle(0, 0, HP_BAR_WIDTH + 2, 5, 0x07090b).setVisible(false);
    this.hpFill = scene.add.rectangle(0, 0, HP_BAR_WIDTH, 3, 0xb3262b).setOrigin(0, 0.5).setVisible(false);
    layers.overhead.add([this.hpBack, this.hpFill]);
  }

  get dead(): boolean {
    return this.hp <= 0;
  }

  /** Moves along the given direction (components in -1..1) and ticks timers. */
  update(dt: number, dirX: number, dirY: number): void {
    this.moving = dirX !== 0 || dirY !== 0;
    if (this.moving) {
      const length = Math.hypot(dirX, dirY);
      this.x += (dirX / length) * CFG.player.speed * dt;
      this.y += (dirY / length) * CFG.player.speed * dt;
      if (dirX !== 0) this.facing = dirX;
    }
    if (this.invulnerable > 0) this.invulnerable -= dt;
  }

  /** Applies a hit unless still invulnerable. Returns whether it landed. */
  hurt(damage: number): boolean {
    if (this.invulnerable > 0 || this.dead) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.invulnerable = CFG.player.invulnerability;
    return true;
  }

  /** Syncs sprites to the current state. `clock` is running time in seconds. */
  draw(clock: number): void {
    const bob = this.moving ? -Math.abs(Math.sin(clock * 11)) * 2 : 0;
    const blink = this.invulnerable > 0 && Math.floor(this.invulnerable * 14) % 2 === 0;

    this.light.setPosition(this.x, this.y);
    this.shadow.setPosition(this.x, this.y + 19);
    this.sprite
      .setPosition(this.x, this.y - 4 + bob)
      .setFlipX(this.facing < 0)
      .setAlpha(blink ? 0.45 : 1)
      .setDepth(this.y);

    const hurt = this.hp < CFG.player.hp;
    this.hpBack.setVisible(hurt).setPosition(this.x, this.y + 28.5);
    this.hpFill.setVisible(hurt).setPosition(this.x - HP_BAR_WIDTH / 2, this.y + 28.5);
    this.hpFill.width = HP_BAR_WIDTH * (this.hp / CFG.player.hp);
  }
}

import Phaser from 'phaser';
import { TEX } from '../art/textures';
import { EVENTS } from '../events';

/**
 * Screen-space effects drawn over the world: fog closing in from the edges
 * and a red flash when the hero is hurt. Runs alongside the game scene with
 * its own unzoomed camera, and keeps running while the game is paused.
 */
export class OverlayScene extends Phaser.Scene {
  private fog!: Phaser.GameObjects.Image;
  private hurt!: Phaser.GameObjects.Image;
  private hurtLevel = 0;

  constructor() {
    super('Overlay');
  }

  create(): void {
    this.fog = this.add.image(0, 0, TEX.fog);
    this.hurt = this.add.image(0, 0, TEX.hurt).setAlpha(0);
    this.layout();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.game.events.on(EVENTS.playerHurt, this.flash, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game.events.off(EVENTS.playerHurt, this.flash, this);
    });
  }

  update(_time: number, delta: number): void {
    if (this.hurtLevel <= 0) return;
    this.hurtLevel = Math.max(0, this.hurtLevel - (delta / 1000) * 2.2);
    this.hurt.setAlpha(Math.min(1, this.hurtLevel));
  }

  private flash(): void {
    this.hurtLevel = 0.6;
  }

  /** Centres the gradients and sizes them so they reach the screen corners. */
  private layout(): void {
    const { width, height } = this.scale;
    const diagonal = Math.hypot(width, height);
    for (const image of [this.fog, this.hurt]) {
      image.setPosition(width / 2, height / 2).setDisplaySize(diagonal, diagonal);
    }
  }
}

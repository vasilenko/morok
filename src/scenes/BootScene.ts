import Phaser from 'phaser';
import { createAnimations, createTextures, loadSprites } from '../art/textures';

/** Loads sprites, draws procedural textures and defines animations before anything is shown. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    loadSprites(this.load);
  }

  create(): void {
    createTextures(this.textures);
    createAnimations(this.anims);
    this.scene.start('Game');
  }
}

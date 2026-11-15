import Phaser from 'phaser';
import { createAnimations, createTextures } from '../art/textures';

/** Prepares textures and animations before anything is shown. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createTextures(this.textures);
    createAnimations(this.anims);
  }
}

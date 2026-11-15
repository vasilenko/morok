import Phaser from 'phaser';
import { DPR, canvasSize } from './display';
import { CFG } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { OverlayScene } from './scenes/OverlayScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#0b0a09',
  // Render at device resolution and scale the canvas back down with CSS,
  // so the picture stays sharp on high-density displays.
  scale: {
    mode: Phaser.Scale.NONE,
    ...canvasSize(),
    zoom: 1 / DPR,
  },
  // Later scenes render on top of earlier ones.
  scene: [BootScene, GameScene, OverlayScene],
});

window.addEventListener('resize', () => {
  const { width, height } = canvasSize();
  game.scale.resize(width, height);
});

if (import.meta.env.DEV) {
  // Console access for tuning: __morok.CFG.stake.cooldown = 0.2
  Object.assign(window, {
    __morok: {
      game,
      CFG,
      get state() {
        return (game.scene.getScene('Game') as GameScene).stats;
      },
    },
  });
}

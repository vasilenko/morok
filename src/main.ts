import Phaser from 'phaser';
import { DPR, canvasSize } from './display';
import { CFG } from './config';
import { debugFlags } from './debug/FootprintDebug';
import { NIGHT } from './night/config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

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
  scene: [BootScene, GameScene],
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
      // Overlays: __morok.debug.footprints = true outlines the scenery's
      // footprints and the hero's contact circle.
      debug: debugFlags,
      get state() {
        return (game.scene.getScene('Game') as GameScene).stats;
      },
      // The night filter: __morok.night.config.fog.cell = 120.
      night: {
        config: NIGHT,
        /** The filter itself; `.active = false` shows the bare scene. */
        get filter() {
          return (game.scene.getScene('Game') as GameScene).night;
        },
      },
    },
  });
}

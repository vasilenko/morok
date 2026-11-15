import Phaser from 'phaser';
import { DPR, canvasSize } from './display';

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
  scene: [],
});

window.addEventListener('resize', () => {
  const { width, height } = canvasSize();
  game.scale.resize(width, height);
});

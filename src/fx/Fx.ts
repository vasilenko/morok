import Phaser from 'phaser';
import { TEX } from '../art/textures';

/** Radius of the particle dot texture, in texture pixels. */
const DOT_RADIUS = 16;
const size = (radius: number) => radius / DOT_RADIUS;

/** One-shot particle bursts. */
export class Fx {
  private readonly splinterEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly wispEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly bloodEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.splinterEmitter = scene.add.particles(0, 0, TEX.dot, {
      emitting: false,
      speed: { min: 27, max: 90 },
      lifespan: { min: 150, max: 250 },
      scale: { min: size(1), max: size(1.9) },
      alpha: { start: 0.85, end: 0 },
      tint: 0xd8c9a3,
    });
    this.wispEmitter = scene.add.particles(0, 0, TEX.dot, {
      emitting: false,
      speed: { min: 14, max: 46 },
      lifespan: { min: 420, max: 700 },
      gravityY: -70,
      scale: { start: size(3.6), end: size(1.4) },
      alpha: { start: 0.85, end: 0 },
      tint: 0xcfe2ec,
    });
    this.bloodEmitter = scene.add.particles(0, 0, TEX.dot, {
      emitting: false,
      speed: { min: 36, max: 120 },
      lifespan: { min: 240, max: 400 },
      scale: { min: size(1.4), max: size(2.9) },
      alpha: { start: 0.85, end: 0 },
      tint: 0xb3262b,
    });
    layer.add([this.splinterEmitter, this.wispEmitter, this.bloodEmitter]);
  }

  /** Wood chips where a stake lands. */
  splinters(x: number, y: number): void {
    this.splinterEmitter.explode(3, x, y);
  }

  /** Pale wisps rising from a slain navia. */
  wisps(x: number, y: number): void {
    this.wispEmitter.explode(7, x, y);
  }

  /** The hero takes a hit. */
  blood(x: number, y: number): void {
    this.bloodEmitter.explode(8, x, y);
  }
}

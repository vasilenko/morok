import Phaser from 'phaser';
import { DROWNED_SHEEN, TEX } from '../art/textures';
import { CFG } from '../config';
import { addPool, agePools, inDrownedWater, poolSize, type DrownedPool } from './drowned';

/** The scenery's puddle that drowned water is drawn with, squashed to lie flat. */
const FRAME = 'puddle-round';
/**
 * A multiply tint that turns the muddy puddle into dark, greenish, stagnant
 * water, set apart from the brown puddles of the scenery.
 */
const TINT = 0x5f9a6a;
/**
 * Where the water's edge lies in the puddle's art, as a share of the way
 * out from its middle; the sheen's edge is laid on it.
 */
const WATER_EDGE = 0.66;

/**
 * The drowned water on the ground: the puddles the utoptsy leave where
 * they are laid to rest (see drowned.ts). The puddle lies in a layer of its
 * own between the scenery's puddles and the marks on the ground; over it a
 * faint witch-light sheen (DROWNED_SHEEN) lies among the entities, under
 * all that stands on it, so the night lets it be made out in the dark. The
 * hero wades through it at a share of his speed.
 */
export class DrownedWater {
  private readonly pools: DrownedPool[] = [];
  private readonly puddles: Phaser.GameObjects.Image[] = [];
  private readonly sheens: Phaser.GameObjects.Image[] = [];
  private readonly lights = new Set<Phaser.GameObjects.GameObject>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ground: Phaser.GameObjects.Layer,
    private readonly entities: Phaser.GameObjects.Layer,
  ) {}

  /** Whether `object` is a sheen, which gives its own light, for the night's mask of lights. */
  readonly glows = (object: Phaser.GameObjects.GameObject): boolean => this.lights.has(object);

  get size(): number {
    return this.pools.length;
  }

  /** Leaves a puddle with its middle at the ground point (x, y). */
  add(x: number, y: number): void {
    addPool(this.pools, x, y, CFG.drowned);
  }

  /** Ages the puddles by `dt` seconds and shows them as they are now. */
  update(dt: number): void {
    const cfg = CFG.drowned;
    agePools(this.pools, dt, cfg);
    const flatten = CFG.ground.flatten;
    // The sheen's texture is round, its edge DROWNED_SHEEN.edge of the way out.
    const sheenWidth = (cfg.width * WATER_EDGE) / DROWNED_SHEEN.edge;
    this.pools.forEach((pool, i) => {
      const size = poolSize(pool, cfg);
      const visible = size > 0;
      const puddle = this.puddles[i] ?? this.addPuddle();
      puddle
        .setPosition(pool.x, pool.y)
        .setDisplaySize(cfg.width * size, cfg.width * flatten * size)
        .setVisible(visible);
      this.sheens[i]
        .setPosition(pool.x, pool.y)
        .setDisplaySize(sheenWidth * size, sheenWidth * flatten * size)
        // Under everything standing on the puddle or behind it.
        .setDepth(pool.y - (cfg.width / 2) * flatten - 1)
        .setVisible(visible);
    });
    for (let i = this.pools.length; i < this.puddles.length; i++) {
      this.puddles[i].setVisible(false);
      this.sheens[i].setVisible(false);
    }
  }

  /** The share of his speed the hero keeps with his feet at the ground point (x, y). */
  speedAt(x: number, y: number): number {
    return inDrownedWater(this.pools, x, y, CFG.drowned, CFG.ground.flatten) ? CFG.drowned.slow : 1;
  }

  /** A puddle and its sheen, which share an index. */
  private addPuddle(): Phaser.GameObjects.Image {
    const puddle = this.scene.add
      .image(0, 0, TEX.scenery, FRAME)
      .setTint(TINT)
      .setTintMode(Phaser.TintModes.MULTIPLY);
    this.ground.add(puddle);
    this.puddles.push(puddle);
    const sheen = this.scene.add.image(0, 0, TEX.drownedSheen);
    this.entities.add(sheen);
    this.lights.add(sheen);
    this.sheens.push(sheen);
    return puddle;
  }
}

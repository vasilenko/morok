import Phaser from 'phaser';
import { ART_SCALE, TEX, greyTint } from '../art/textures';
import { pushOutAll, type Ellipse, type Point } from './footprint';
import { SCENERY_CELL, footprintOf, footprintsIn, sceneryInCell, watersAround } from './SceneryLayout';

/**
 * Puddles are darkened like the ground (see Ground), a little less, so
 * their mud rims sit on the soil instead of glowing against it.
 */
const PUDDLE_BRIGHTNESS = 0.8;
/**
 * Standing props are pale stone and bone, as bright as the hero untinted.
 * Darkened this far they sit between the soil and the hero in his light,
 * and in the dark the night's glow on pale things leaves them well below
 * the navii, so a stone is not mistaken for one of the dead.
 */
const STANDING_BRIGHTNESS = 0.6;

/**
 * Decoration scattered over the endless plane: standing stones, mounds,
 * bones and puddles laid out by sceneryInCell. Only the cells around the
 * view get images, drawn from two pools: puddles lie flat in a layer
 * between the soil and the hero's glow, and standing props share the entity
 * layer, sorted by where they stand so the hero and the navii pass in front
 * of and behind them. The standing ones block the hero's feet; the navii fly
 * through everything.
 */
export class Scenery {
  private readonly flat: Phaser.GameObjects.Image[] = [];
  private readonly standing: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly flatLayer: Phaser.GameObjects.Layer,
    private readonly standingLayer: Phaser.GameObjects.Layer,
    private readonly seed: number,
  ) {}

  /** Shows the scenery of every cell that touches the given world rectangle. */
  cover(left: number, top: number, width: number, height: number): void {
    const x0 = Math.floor(left / SCENERY_CELL);
    const y0 = Math.floor(top / SCENERY_CELL);
    const x1 = Math.floor((left + width) / SCENERY_CELL);
    const y1 = Math.floor((top + height) / SCENERY_CELL);

    let flat = 0;
    let standing = 0;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const item = sceneryInCell(cx, cy, this.seed);
        if (!item) continue;
        if (item.kind.flat) {
          const image = this.flat[flat++] ?? this.addFlat();
          image.setFrame(item.kind.name).setPosition(item.x, item.y).setVisible(true);
        } else {
          const image = this.standing[standing++] ?? this.addStanding();
          // A solid item sorts by the middle of its footprint rather than the
          // bottom of its image, which holds the grass in front of it: the
          // hero, who cannot enter the footprint, is drawn behind it exactly
          // when his feet are above it.
          const depth = footprintOf(item)?.y ?? item.y;
          image.setFrame(item.kind.name).setPosition(item.x, item.y).setDepth(depth).setVisible(true);
        }
      }
    }
    for (let i = flat; i < this.flat.length; i++) this.flat[i].setVisible(false);
    for (let i = standing; i < this.standing.length; i++) this.standing[i].setVisible(false);
  }

  /** Footprints of the solid scenery in every cell that touches the given world rectangle. */
  footprints(left: number, top: number, width: number, height: number): Ellipse[] {
    return footprintsIn(left, top, width, height, this.seed);
  }

  /** The middles of the puddles and ponds between `near` and `far` from the point (x, y). */
  waters(x: number, y: number, near: number, far: number): Point[] {
    return watersAround(x, y, near, far, this.seed);
  }

  /**
   * Where feet that stepped to (x, y), with a contact circle of the given
   * radius, end up once pushed out of the solid scenery around them.
   */
  blockFeet(x: number, y: number, radius: number): Point {
    return pushOutAll(x, y, radius, this.footprints(x - radius, y - radius, radius * 2, radius * 2));
  }

  private addFlat(): Phaser.GameObjects.Image {
    const image = this.addImage(this.flatLayer)
      .setTint(greyTint(PUDDLE_BRIGHTNESS))
      .setTintMode(Phaser.TintModes.MULTIPLY);
    this.flat.push(image);
    return image;
  }

  private addStanding(): Phaser.GameObjects.Image {
    const image = this.addImage(this.standingLayer)
      .setTint(greyTint(STANDING_BRIGHTNESS))
      .setTintMode(Phaser.TintModes.MULTIPLY);
    this.standing.push(image);
    return image;
  }

  /** An image of the scenery atlas, pivoted at the centre of its base. */
  private addImage(layer: Phaser.GameObjects.Layer): Phaser.GameObjects.Image {
    const image = this.scene.add.image(0, 0, TEX.scenery).setOrigin(0.5, 1).setScale(1 / ART_SCALE);
    layer.add(image);
    return image;
  }
}

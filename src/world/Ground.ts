import Phaser from 'phaser';
import { GROUND_ART_SCALE, GROUND_TILE, TEX, greyTint } from '../art/textures';

/**
 * The soil art is too light and busy for the sprites to read against, so
 * it is darkened by a multiply tint to this share of its brightness.
 */
const GROUND_BRIGHTNESS = 0.62;

/**
 * Endless ground made of one repeating tile. Keeps just enough tile images
 * to cover the visible area and moves them as the view travels.
 */
export class Ground {
  private readonly tiles: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
  ) {}

  /** Covers the given world rectangle with tiles. */
  cover(left: number, top: number, width: number, height: number): void {
    const x0 = Math.floor(left / GROUND_TILE);
    const y0 = Math.floor(top / GROUND_TILE);
    const x1 = Math.floor((left + width) / GROUND_TILE);
    const y1 = Math.floor((top + height) / GROUND_TILE);

    let used = 0;
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const tile = this.tiles[used] ?? this.addTile();
        tile.setPosition(gx * GROUND_TILE, gy * GROUND_TILE).setVisible(true);
        used++;
      }
    }
    for (let i = used; i < this.tiles.length; i++) this.tiles[i].setVisible(false);
  }

  private addTile(): Phaser.GameObjects.Image {
    const tile = this.scene.add
      .image(0, 0, TEX.ground)
      .setOrigin(0)
      .setScale(1 / GROUND_ART_SCALE)
      .setTint(greyTint(GROUND_BRIGHTNESS))
      .setTintMode(Phaser.TintModes.MULTIPLY);
    this.layer.add(tile);
    this.tiles.push(tile);
    return tile;
  }
}

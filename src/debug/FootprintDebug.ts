import Phaser from 'phaser';
import type { Ellipse } from '../world/footprint';

/**
 * Switches for dev-only overlays, set from the console:
 * `__morok.debug.footprints = true`. Only referenced behind
 * `import.meta.env.DEV`, so production builds leave this module out.
 */
export const debugFlags = { footprints: false };

const FOOTPRINT_COLOR = 0xff3df5;
const FEET_COLOR = 0x3dffb4;

/**
 * Outlines the footprints of the solid scenery and the hero's contact
 * circle, to tune the footprints against the art and check the collision.
 * Does nothing while the switch is off, after clearing what it drew.
 */
export class FootprintDebug {
  private graphics: Phaser.GameObjects.Graphics | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
  ) {}

  draw(footprints: () => readonly Ellipse[], feetX: number, feetY: number, radius: number): void {
    if (!debugFlags.footprints) {
      this.graphics?.destroy();
      this.graphics = null;
      return;
    }
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics();
      this.layer.add(this.graphics);
    }
    const g = this.graphics.clear().lineStyle(1, FOOTPRINT_COLOR, 1);
    for (const f of footprints()) g.strokeEllipse(f.x, f.y, f.rx * 2, f.ry * 2, 48);
    g.lineStyle(1, FEET_COLOR, 1).strokeCircle(feetX, feetY, radius);
  }
}

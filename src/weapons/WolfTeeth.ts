import Phaser from 'phaser';
import { ART_SCALE, FANG_FRAMES, TEX } from '../art/textures';
import { CFG } from '../config';
import type { Enemy } from '../entities/enemy';
import type { Horde } from '../entities/Horde';
import type { Fx } from '../fx/Fx';
import { itemStats } from '../progression/progression';
import { canBite, newTeeth, placeFang, stepTeeth, type TeethStats } from './teeth';

/**
 * How far below the line from a fang's root to its tip each drawing's tip
 * lies, in radians, measured on the atlas: the root's middle on the left
 * edge to the rightmost point. Turning a fang back by this points its tip
 * the way it travels.
 */
const TIP_ANGLE = [9.9, 19.4, 1.2, 6.2].map((degrees) => Phaser.Math.DegToRad(degrees));
/** Where the enemies are filed in the horde's grid: their position, about this far above their ground point. */
const GROUND_BELOW_POSITION = 19;

/**
 * Wolf teeth that circle the hero on the ground and wound every enemy they
 * pass through, sparing each for a moment after a bite. The fangs are
 * drawn lifted to the hero's middle and sorted among the entities by the
 * ground point under them, so they pass behind and in front of him and of
 * the dead; they bite on the ground, under where they are drawn. Not owned
 * at the start of a run: level 0 shows nothing and bites nothing.
 */
export class WolfTeeth {
  private stats: TeethStats | null = null;
  private readonly teeth = newTeeth();
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  /** When each enemy was last bitten, by `clock`. */
  private readonly bitten = new WeakMap<Enemy, number>();
  /** Seconds the teeth have been circling. */
  private clock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly horde: Horde,
    private readonly fx: Fx,
  ) {}

  /** Takes on the numbers of `level`, from 1; 0 for none. */
  setLevel(level: number): void {
    this.stats = itemStats(CFG.items, 'teeth', level);
  }

  /** Turns the fangs round a hero whose feet stand on (x, feetY) and bites. Returns the number of kills. */
  update(dt: number, x: number, feetY: number): number {
    const stats = this.stats;
    // Fangs beyond the level's count, and every fang without the teeth, are not shown.
    const count = stats?.count ?? 0;
    for (let i = count; i < this.sprites.length; i++) this.sprites[i].setVisible(false);
    if (!stats) return 0;
    const cfg = CFG.teeth;
    this.clock += dt;
    stepTeeth(this.teeth, stats, dt, cfg);

    let kills = 0;
    this.teeth.fangs.forEach((fang, i) => {
      const place = placeFang(this.teeth, fang, x, feetY, cfg);
      const frame = i % FANG_FRAMES.length;
      this.sprite(i)
        .setVisible(true)
        .setFrame(FANG_FRAMES[frame])
        .setPosition(place.x, place.y - cfg.lift)
        .setRotation(place.heading - TIP_ANGLE[frame])
        .setAlpha(fang.grow)
        .setDepth(place.y);
      kills += this.bite(place.x, place.y, x, feetY, stats);
    });
    return kills;
  }

  /** Wounds every enemy within reach of a fang's ground point that is not still spared. */
  private bite(fx: number, fy: number, heroX: number, heroY: number, stats: TeethStats): number {
    const cfg = CFG.teeth;
    let kills = 0;
    this.horde.grid.forEachNear(fx, fy - GROUND_BELOW_POSITION, (enemy) => {
      if (enemy.dead) return;
      const groundY = enemy.y + enemy.kind.groundY;
      const reach = enemy.radius + cfg.hitRadius;
      if ((enemy.x - fx) ** 2 + (groundY - fy) ** 2 > reach * reach) return;
      if (!canBite(this.bitten.get(enemy), this.clock, cfg)) return;
      this.bitten.set(enemy, this.clock);

      // Away from the hero.
      const ax = enemy.x - heroX;
      const ay = groundY - heroY;
      const away = Math.hypot(ax, ay) || 1;
      if (this.horde.damage(enemy, stats.damage, (ax / away) * cfg.knockback, (ay / away) * cfg.knockback)) {
        kills++;
        this.fx.wisps(enemy.x, enemy.y);
      }
    });
    return kills;
  }

  private sprite(i: number): Phaser.GameObjects.Image {
    let sprite = this.sprites[i];
    if (!sprite) {
      sprite = this.scene.add.image(0, 0, TEX.teeth, FANG_FRAMES[0]).setScale(1 / ART_SCALE);
      this.layer.add(sprite);
      this.sprites[i] = sprite;
    }
    return sprite;
  }
}

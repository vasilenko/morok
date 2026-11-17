import Phaser from 'phaser';
import { ART_SCALE, RELIC_FRAMES, TEX } from '../art/textures';
import { CFG } from '../config';
import type { Enemy } from '../entities/enemy';
import type { Horde } from '../entities/Horde';
import type { Fx } from '../fx/Fx';
import { itemStats } from '../progression/progression';
import {
  bladeAngle,
  cuts,
  fanPoint,
  startEdge,
  stepSwing,
  swingLife,
  swingSickles,
  type SickleStats,
  type Swing,
} from './sickle';

/**
 * The way from the handle to the blade in the sickle's drawing, on screen,
 * in radians: up and to the right. Turning the sprite by the way out from
 * the hero less this points the blade outward.
 */
const ART_OUTWARD = Phaser.Math.DegToRad(-50);
/** Segments of the trail's strip along the arc: enough that its curve shows no corners. */
const TRAIL_SEGMENTS = 40;
/** Share of the raise over which the sickle appears, and how small it starts. */
const APPEAR = 0.4;
const APPEAR_SCALE = 0.8;

interface Reaping {
  swing: Swing;
  /** Every enemy this swing has cut, so it cuts each once. */
  cut: WeakSet<Enemy>;
  sprite: Phaser.GameObjects.Image;
  trail: Phaser.GameObjects.Mesh2D;
}

/**
 * The sickle: on its cooldown the hero reaps before him, up or down the
 * screen the way he last walked, never to the sides, which are the stake's.
 * A swing is a drawn slash in three beats: the sickle is raised at one edge
 * of the fan and held there a moment; it sweeps across, left to right and
 * right to left by turns, cutting every enemy it passes over once with a
 * light push away from him; and it rests at the far edge, fading. From
 * level 4 he reaps up and down at once. The sickle is lifted to his middle,
 * blade outward, and sorted among the entities by the ground under it, so
 * it passes in front of him below and behind him above. Behind the blade
 * it leaves a pale crescent of light over all the arc it has swept, which
 * lingers a moment after the sweep. It cuts on the ground. Not owned at the
 * start of a run: level 0 reaps nothing.
 */
export class Sickles {
  private stats: SickleStats | null = null;
  /** Seconds until the next swing; it is swung as soon as it is gained. */
  private cooldown = 0;
  /** Whether the next swing sweeps from left to right. */
  private rightward = true;
  private reaping: Reaping[] = [];
  private readonly pool: Reaping[] = [];
  /** The trails, which the night keeps in their own light, like the coals. */
  private readonly lights = new Set<Phaser.GameObjects.GameObject>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly horde: Horde,
    private readonly fx: Fx,
  ) {}

  /** Whether `object` is a sickle's trail, which gives its own light. */
  readonly glows = (object: Phaser.GameObjects.GameObject): boolean => this.lights.has(object);

  /** Takes on the numbers of `level`, from 1; 0 for none. */
  setLevel(level: number): void {
    this.stats = itemStats(CFG.items, 'sickle', level);
  }

  /**
   * Swings when ready before a hero whose feet stand on (x, feetY) and who
   * last walked `heading` (1 down the screen, -1 up), sweeps the blades and
   * cuts. The fan goes with the hero as he moves. Returns the number of kills.
   */
  update(dt: number, x: number, feetY: number, heading: number): number {
    const cfg = CFG.sickle;
    const stats = this.stats;
    if (stats) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        for (const swing of swingSickles(heading, this.rightward, stats, cfg)) {
          const reaping = this.pool.pop() ?? this.addReaping();
          reaping.swing = swing;
          reaping.cut = new WeakSet();
          this.reaping.push(reaping);
        }
        this.rightward = !this.rightward;
        // Added rather than set, so the swings keep their time on average whatever the frame rate.
        this.cooldown = Math.max(0, this.cooldown + stats.cooldown);
      }
    }

    let kills = 0;
    let kept = 0;
    for (const reaping of this.reaping) {
      kills += this.reap(reaping, dt, x, feetY);
      if (reaping.swing.age >= swingLife(reaping.swing, cfg.trail.linger)) {
        reaping.sprite.setVisible(false);
        reaping.trail.setVisible(false);
        this.pool.push(reaping);
      } else {
        this.draw(reaping, x, feetY);
        this.reaping[kept++] = reaping;
      }
    }
    this.reaping.length = kept;
    return kills;
  }

  /** Sweeps the blade on by `dt` and cuts whoever it passes over. */
  private reap(reaping: Reaping, dt: number, x: number, feetY: number): number {
    const cfg = CFG.sickle;
    const flatten = CFG.ground.flatten;
    const { swing, cut } = reaping;
    const sweep = stepSwing(swing, dt);
    if (!sweep || !this.stats) return 0;
    const damage = this.stats.damage;
    let kills = 0;
    for (const enemy of this.horde.list) {
      if (enemy.dead || cut.has(enemy)) continue;
      const dx = enemy.x - x;
      const dy = enemy.y + enemy.kind.groundY - feetY;
      if (!cuts(swing, sweep, dx, dy, flatten, cfg)) continue;
      cut.add(enemy);
      // Away from the hero.
      const away = Math.hypot(dx, dy) || 1;
      if (this.horde.damage(enemy, damage, (dx / away) * cfg.knockback, (dy / away) * cfg.knockback)) {
        kills++;
        this.fx.wisps(enemy.x, enemy.y);
      }
    }
    return kills;
  }

  /** The sickle where the blade is, in the beat it is in, and the trail behind it. */
  private draw(reaping: Reaping, x: number, feetY: number): void {
    const cfg = CFG.sickle;
    const flatten = CFG.ground.flatten;
    const { swing, sprite } = reaping;
    const age = swing.age;
    const sweepEnd = swing.raise + swing.sweep;
    const angle = bladeAngle(swing, age);
    const blade = fanPoint(swing.heading, angle, swing.reach * cfg.blade, flatten);
    const outward = Math.atan2(blade.y, blade.x);
    // The blade's hollow edge leads the stroke: flipped across the way out
    // for a stroke turning anticlockwise on screen.
    const clockwise = (swing.heading > 0) !== swing.rightward;
    const appear = Math.min(1, age / (swing.raise * APPEAR));
    const fade = age <= sweepEnd ? 1 : Math.max(0, 1 - (age - sweepEnd) / swing.rest);
    const depth = feetY + blade.y;
    sprite
      .setVisible(fade > 0)
      .setPosition(x + blade.x, feetY + blade.y - cfg.lift)
      .setFlipY(!clockwise)
      .setRotation(outward - (clockwise ? ART_OUTWARD : -ART_OUTWARD))
      .setScale((APPEAR_SCALE + (1 - APPEAR_SCALE) * appear) / ART_SCALE)
      .setAlpha(appear * fade)
      .setDepth(depth);
    this.shapeTrail(reaping, x, feetY, depth);
  }

  /**
   * The trail: a crescent of light over the arc swept so far, from the
   * start edge to the blade, its outer edge on the reach, widening and
   * brightening towards the blade. It is one strip of triangles whose
   * texture fades along it and across it, so it has no seams.
   */
  private shapeTrail(reaping: Reaping, x: number, feetY: number, depth: number): void {
    const cfg = CFG.sickle;
    const flatten = CFG.ground.flatten;
    const { swing, trail } = reaping;
    const sweepEnd = swing.raise + swing.sweep;
    const from = startEdge(swing);
    const to = bladeAngle(swing, Math.max(swing.age, swing.raise));
    const way = swing.rightward ? 1 : -1;
    const swept = way * (to - from);
    if (swing.age <= swing.raise || swept <= 0) {
      trail.setVisible(false);
      return;
    }
    const linger = Math.max(0, 1 - Math.max(0, swing.age - sweepEnd) / cfg.trail.linger);
    const width = swing.reach * cfg.trail.width;
    const vertices = trail.vertices;
    for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
      // 0 at the start edge, 1 at the blade.
      const along = i / TRAIL_SEGMENTS;
      const at = from + way * swept * along;
      const thickness = width * along ** 0.6;
      const outer = fanPoint(swing.heading, at, swing.reach, flatten);
      const inner = fanPoint(swing.heading, at, swing.reach - thickness, flatten);
      vertices.splice(i * 8, 8, outer.x, outer.y, along, 0, inner.x, inner.y, along, 1);
    }
    trail
      .setVisible(linger > 0)
      .setPosition(x, feetY - cfg.lift)
      .setAlpha(cfg.trail.alpha * linger)
      .setDepth(depth - 0.01);
  }

  private addReaping(): Reaping {
    const scene = this.scene;
    const sprite = scene.add.image(0, 0, TEX.relics, RELIC_FRAMES.sickle);
    // Two triangles for every segment of the strip, between its outer and inner edges.
    const vertices = new Array<number>((TRAIL_SEGMENTS + 1) * 8).fill(0);
    const indices: number[] = [];
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const [a, b, c, d] = [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3];
      indices.push(a, b, c, 0, b, d, c, 0);
    }
    const trail = scene.add.mesh2d(0, 0, TEX.trail, vertices, indices).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.layer.add([trail, sprite]);
    this.lights.add(trail);
    return { swing: swingSickles(1, true, CFG.items.sickle[0], CFG.sickle)[0], cut: new WeakSet(), sprite, trail };
  }
}

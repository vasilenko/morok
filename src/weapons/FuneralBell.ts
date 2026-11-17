import Phaser from 'phaser';
import { ART_SCALE, RELIC_FRAMES, RING, ringFrame, TEX } from '../art/textures';
import { CFG } from '../config';
import type { Enemy } from '../entities/enemy';
import type { Horde } from '../entities/Horde';
import type { Fx } from '../fx/Fx';
import { itemStats } from '../progression/progression';
import { bandWidth, groundDistance, newRing, ringDone, ringFront, stepRing, swept, type BellStats, type Ring } from './bell';

/** How far above the hero's feet the bell hangs from its yoke: just clear of the antlers. */
const BELL_ABOVE_FEET = 76;
/** The point the bell swings from, as a fraction of its frame: the middle of the yoke. */
const BELL_PIVOT = { x: 0.5, y: 0.12 };
/** How far it swings to either side, in radians, and the share of `show` one swing takes. */
const SWING = { angle: 0.45, share: 0.6 };
/** Seconds it takes to appear, and the share of `show` at which it starts to fade. */
const APPEAR = 0.06;
const FADE_FROM = 0.6;
/** The ring's pale colour, added to the ground, and its brightness as it leaves the hero. */
const RING_TINT = 0xf2ead2;
const RING_ALPHA = 0.85;

interface Toll {
  ring: Ring;
  /** Every enemy its front has passed, so it wounds each once. */
  wounded: WeakSet<Enemy>;
  sprite: Phaser.GameObjects.Image;
}

/**
 * The funeral bell: every few seconds it tolls over the hero's head, and a
 * ring runs out along the ground from his feet, wounding every enemy its
 * front passes once and throwing it back. It does not follow anyone, nor
 * the hero once it is rung: the ring spreads from where he stood. The bell
 * itself is seen only at the toll, swinging once above him; the ring lies
 * on the ground under everyone. Not owned at the start of a run: level 0
 * tolls nothing.
 */
export class FuneralBell {
  private stats: BellStats | null = null;
  /** Seconds until the next toll; it tolls as soon as it is gained. */
  private cooldown = 0;
  private tolls: Toll[] = [];
  private readonly ringPool: Phaser.GameObjects.Image[] = [];
  private readonly bell: Phaser.GameObjects.Image;
  /** Seconds since the last toll, for the bell's swing; Infinity before the first. */
  private sinceToll = Infinity;

  /**
   * `ground` is the layer of marks on the ground under the entities, where
   * the ring lies; `overhead` is drawn over everything, where the bell hangs.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ground: Phaser.GameObjects.Layer,
    overhead: Phaser.GameObjects.Layer,
    private readonly horde: Horde,
    private readonly fx: Fx,
  ) {
    this.bell = scene.add
      .image(0, 0, TEX.relics, RELIC_FRAMES.bell)
      .setOrigin(BELL_PIVOT.x, BELL_PIVOT.y)
      .setScale(1 / ART_SCALE)
      .setVisible(false);
    overhead.add(this.bell);
  }

  /** Takes on the numbers of `level`, from 1; 0 for none. */
  setLevel(level: number): void {
    this.stats = itemStats(CFG.items, 'bell', level);
  }

  /**
   * Tolls when ready over a hero whose feet stand on (x, feetY), spreads
   * the rings and wounds whoever their fronts pass. Returns the number of kills.
   */
  update(dt: number, x: number, feetY: number): number {
    const stats = this.stats;
    if (stats) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.toll(x, feetY, stats);
        // Added rather than set, so the tolls keep their time on average whatever the frame rate.
        this.cooldown = Math.max(0, this.cooldown + stats.cooldown);
      }
    }

    let kills = 0;
    let kept = 0;
    for (const toll of this.tolls) {
      kills += this.spread(toll, dt);
      if (ringDone(toll.ring, CFG.bell)) this.ringPool.push(toll.sprite.setVisible(false));
      else this.tolls[kept++] = toll;
    }
    this.tolls.length = kept;
    this.swing(dt, x, feetY);
    return kills;
  }

  private toll(x: number, feetY: number, stats: BellStats): void {
    const sprite = this.ringPool.pop()?.setVisible(true) ?? this.addRing();
    this.tolls.push({ ring: newRing(x, feetY, stats.radius), wounded: new WeakSet(), sprite });
    this.sinceToll = 0;
  }

  /** Runs one ring out by `dt`, wounding whoever its front passes, and draws it. */
  private spread(toll: Toll, dt: number): number {
    const cfg = CFG.bell;
    const flatten = CFG.ground.flatten;
    const { ring, wounded } = toll;
    const sweep = stepRing(ring, dt, cfg);
    let kills = 0;
    if (sweep && this.stats) {
      const { damage, knockback } = this.stats;
      for (const enemy of this.horde.list) {
        if (enemy.dead || wounded.has(enemy)) continue;
        const dx = enemy.x - ring.x;
        const dy = enemy.y + enemy.kind.groundY - ring.y;
        if (!swept(groundDistance(dx, dy, flatten), sweep, cfg)) continue;
        wounded.add(enemy);
        // Away from where the bell tolled.
        const away = Math.hypot(dx, dy) || 1;
        if (this.horde.damage(enemy, damage, (dx / away) * knockback, (dy / away) * knockback)) {
          kills++;
          this.fx.wisps(enemy.x, enemy.y);
        }
      }
    }

    const front = ringFront(ring.age, ring.radius, cfg);
    const progress = front / ring.radius;
    const share = Math.min(1, bandWidth(progress, cfg) / Math.max(front, 1));
    // Fainter as it spreads, then gone over the moment it lingers at its radius.
    const linger = Math.max(0, ring.age - cfg.spread) / cfg.linger;
    const alpha = RING_ALPHA * (1 - 0.55 * progress) * (1 - Math.min(1, linger));
    const scale = front / RING.front;
    toll.sprite
      .setFrame(ringFrame(share))
      .setPosition(ring.x, ring.y)
      .setScale(scale, scale * flatten)
      .setAlpha(alpha);
    return kills;
  }

  /** The bell over the hero's head after a toll: it appears, swings once and fades. */
  private swing(dt: number, x: number, feetY: number): void {
    this.sinceToll += dt;
    const show = CFG.bell.show;
    const t = this.sinceToll;
    if (t >= show) {
      this.bell.setVisible(false);
      return;
    }
    const period = SWING.share * show;
    const angle = t < period ? SWING.angle * Math.sin((2 * Math.PI * t) / period) * (1 - t / period / 2) : 0;
    const fade = Math.min(1, t / APPEAR) * (1 - Math.max(0, (t / show - FADE_FROM) / (1 - FADE_FROM)));
    this.bell
      .setVisible(true)
      .setPosition(x, feetY - BELL_ABOVE_FEET)
      .setRotation(angle)
      .setAlpha(fade);
  }

  private addRing(): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(0, 0, TEX.ring, 0).setTint(RING_TINT).setBlendMode(Phaser.BlendModes.ADD);
    this.ground.add(sprite);
    return sprite;
  }
}

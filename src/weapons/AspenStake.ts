import Phaser from 'phaser';
import { ART_SCALE, TEX } from '../art/textures';
import { CFG } from '../config';
import type { Enemy } from '../entities/enemy';
import type { Horde } from '../entities/Horde';
import type { Fx } from '../fx/Fx';
import { itemStats } from '../progression/progression';
import { throwShots, type Shot, type StakeStats } from './stake';

interface Stake {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Distance it still flies before it falls. */
  left: number;
  pierce: number;
  hit: Set<Enemy>;
  sprite: Phaser.GameObjects.Image;
}

/** Longest distance a stake moves between hit checks, to avoid tunnelling. */
const MAX_STEP = 10;
const HIT_RADIUS = 5;
/**
 * The pivot in the stake texture, as a fraction of its size: on the shaft's
 * centre line at the red thread near the butt, so the stake leaves the hero
 * point first and turns about where it would be held.
 */
const GRIP = { x: 0.2, y: 0.49 };

/**
 * The starting weapon: thrown on its own, on its cooldown, the way the hero
 * faces, exactly left or right with no homing and no tilt, from level 3
 * behind him as well, and at the top level two at a time each way, side by
 * side and a moment apart; it pierces through a few enemies in its path.
 * How hard, how often, how far and through how many grows with its level
 * (CFG.items.stake).
 */
export class AspenStake {
  private stats: StakeStats = CFG.items.stake[0];
  private cooldown = 0.4;
  private flying: Stake[] = [];
  /** Stakes of the last throw not yet left the hand, with the seconds until they do. */
  private waiting: Array<{ shot: Shot; in: number }> = [];
  private readonly pool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly horde: Horde,
    private readonly fx: Fx,
  ) {}

  /** Takes on the numbers of `level`, from 1. */
  setLevel(level: number): void {
    this.stats = itemStats(CFG.items, 'stake', level) ?? CFG.items.stake[0];
  }

  /**
   * Throws when ready from `origin` the way of `facing` (1 right, -1 left)
   * and advances stakes in flight. Returns the number of kills.
   */
  update(dt: number, origin: { x: number; y: number }, facing: number): number {
    this.cooldown -= dt;
    // Stakes of a volley left in the hand go when their turn comes, from where the hero is then.
    let held = 0;
    for (const wait of this.waiting) {
      wait.in -= dt;
      if (wait.in <= 0) this.fire(origin, wait.shot.angle, wait.shot.lane);
      else this.waiting[held++] = wait;
    }
    this.waiting.length = held;
    if (this.cooldown <= 0) {
      for (const shot of throwShots(facing, this.stats, CFG.stake)) {
        if (shot.delay <= 0) this.fire(origin, shot.angle, shot.lane);
        else this.waiting.push({ shot, in: shot.delay });
      }
      // Added rather than set, so the throws keep their time on average whatever the frame rate.
      this.cooldown = Math.max(0, this.cooldown + this.stats.cooldown);
    }

    let kills = 0;
    for (const stake of this.flying) kills += this.advance(stake, dt);

    let kept = 0;
    for (const stake of this.flying) {
      if (stake.left > 0 && stake.pierce > 0) {
        this.flying[kept++] = stake;
      } else {
        this.pool.push(stake.sprite.setVisible(false));
      }
    }
    this.flying.length = kept;
    return kills;
  }

  /** Throws a stake along `angle` on a line `lane` below the hero's (above it if negative). */
  private fire(origin: { x: number; y: number }, angle: number, lane: number): void {
    const sprite = this.pool.pop()?.setVisible(true) ?? this.addSprite();
    sprite.setPosition(origin.x, origin.y + lane).setRotation(angle);
    this.flying.push({
      x: origin.x,
      y: origin.y + lane,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      left: this.stats.range,
      pierce: this.stats.pierce,
      hit: new Set(),
      sprite,
    });
  }

  private advance(stake: Stake, dt: number): number {
    const cfg = CFG.stake;
    const travel = Math.min(cfg.speed * dt, stake.left);
    const steps = Math.max(1, Math.ceil(travel / MAX_STEP));
    const step = travel / steps;
    let kills = 0;

    for (let i = 0; i < steps && stake.pierce > 0; i++) {
      stake.x += stake.dx * step;
      stake.y += stake.dy * step;
      this.horde.grid.forEachNear(stake.x, stake.y, (enemy) => {
        if (enemy.dead || stake.hit.has(enemy)) return;
        const ex = enemy.x - stake.x;
        const ey = enemy.y - stake.y;
        const reach = enemy.radius + HIT_RADIUS;
        if (ex * ex + ey * ey > reach * reach) return;

        stake.hit.add(enemy);
        stake.pierce--;
        this.fx.splinters(stake.x, stake.y);
        if (this.horde.damage(enemy, this.stats.damage, stake.dx * cfg.knockback, stake.dy * cfg.knockback)) {
          kills++;
          this.fx.wisps(enemy.x, enemy.y);
        }
        return stake.pierce <= 0;
      });
    }

    stake.left -= travel;
    stake.sprite.setPosition(stake.x, stake.y);
    return kills;
  }

  private addSprite(): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(0, 0, TEX.stake).setOrigin(GRIP.x, GRIP.y).setScale(1 / ART_SCALE);
    this.layer.add(sprite);
    return sprite;
  }
}

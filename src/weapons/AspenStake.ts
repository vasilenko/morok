import Phaser from 'phaser';
import { ART_SCALE, TEX } from '../art/textures';
import { CFG } from '../config';
import type { Horde, Navia } from '../entities/Horde';
import type { Fx } from '../fx/Fx';

interface Stake {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  pierce: number;
  hit: Set<Navia>;
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
 * The starting weapon: fires on its own at the nearest navia and pierces
 * through a few of them.
 */
export class AspenStake {
  private cooldown = 0.4;
  private flying: Stake[] = [];
  private readonly pool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly horde: Horde,
    private readonly fx: Fx,
  ) {}

  /** Fires when ready and advances stakes in flight. Returns the number of kills. */
  update(dt: number, origin: { x: number; y: number }): number {
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const target = this.nearest(origin);
      if (target) {
        this.fire(origin, target);
        this.cooldown = CFG.stake.cooldown;
      } else {
        this.cooldown = 0;
      }
    }

    let kills = 0;
    for (const stake of this.flying) kills += this.advance(stake, dt);

    let kept = 0;
    for (const stake of this.flying) {
      if (stake.life > 0 && stake.pierce > 0) {
        this.flying[kept++] = stake;
      } else {
        this.pool.push(stake.sprite.setVisible(false));
      }
    }
    this.flying.length = kept;
    return kills;
  }

  private nearest(origin: { x: number; y: number }): Navia | null {
    let best: Navia | null = null;
    let bestD2 = CFG.stake.range * CFG.stake.range;
    for (const navia of this.horde.list) {
      const dx = navia.x - origin.x;
      const dy = navia.y - origin.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = navia;
      }
    }
    return best;
  }

  private fire(origin: { x: number; y: number }, target: Navia): void {
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    const sprite = this.pool.pop()?.setVisible(true) ?? this.addSprite();
    sprite.setPosition(origin.x, origin.y).setRotation(angle);
    this.flying.push({
      x: origin.x,
      y: origin.y,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      life: CFG.stake.lifetime,
      pierce: CFG.stake.pierce,
      hit: new Set(),
      sprite,
    });
  }

  private advance(stake: Stake, dt: number): number {
    const cfg = CFG.stake;
    const travel = cfg.speed * dt;
    const steps = Math.max(1, Math.ceil(travel / MAX_STEP));
    const step = travel / steps;
    let kills = 0;

    for (let i = 0; i < steps && stake.pierce > 0; i++) {
      stake.x += stake.dx * step;
      stake.y += stake.dy * step;
      this.horde.grid.forEachNear(stake.x, stake.y, (navia) => {
        if (navia.dead || stake.hit.has(navia)) return;
        const ex = navia.x - stake.x;
        const ey = navia.y - stake.y;
        const reach = navia.radius + HIT_RADIUS;
        if (ex * ex + ey * ey > reach * reach) return;

        stake.hit.add(navia);
        stake.pierce--;
        this.fx.splinters(stake.x, stake.y);
        if (this.horde.damage(navia, cfg.damage, stake.dx * cfg.knockback, stake.dy * cfg.knockback)) {
          kills++;
          this.fx.wisps(navia.x, navia.y);
        }
        return stake.pierce <= 0;
      });
    }

    stake.life -= dt;
    stake.sprite.setPosition(stake.x, stake.y);
    return kills;
  }

  private addSprite(): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(0, 0, TEX.stake).setOrigin(GRIP.x, GRIP.y).setScale(1 / ART_SCALE);
    this.layer.add(sprite);
    return sprite;
  }
}

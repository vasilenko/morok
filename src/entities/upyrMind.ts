import type { UpyrConfig } from '../config';
import type { Strike } from './enemy';

/**
 * The upyr's attack, as pure logic: it prowls towards the hero, and once
 * close enough and rested it crouches for a moment (the tell), lunges in a
 * straight line at where the hero stood when the lunge began, and lies
 * helpless for a moment after landing. It commits to its direction, so a
 * hero who steps aside during the wind-up is missed.
 */
export type UpyrState = 'prowl' | 'windUp' | 'lunge' | 'recover';

export interface UpyrMind {
  state: UpyrState;
  /** Seconds spent in the current state. */
  time: number;
  /** Seconds until it may attack again. */
  cooldown: number;
  /** Unit direction of the lunge, fixed when it begins. */
  dirX: number;
  dirY: number;
  /** Distance covered in the current lunge. */
  travelled: number;
  /** Whether the current lunge has struck the hero, so it strikes once at most. */
  struck: boolean;
}

/** The parts of an enemy the mind moves and heals. */
export interface UpyrBody {
  x: number;
  y: number;
  hp: number;
  radius: number;
  speed: number;
  dead: boolean;
}

export interface UpyrTarget {
  x: number;
  y: number;
  radius: number;
}


/** A fresh upyr, prowling and ready to attack. */
export function newUpyrMind(): UpyrMind {
  return { state: 'prowl', time: 0, cooldown: 0, dirX: 1, dirY: 0, travelled: 0, struck: false };
}

/** Wind-up, lunge and recovery hold the upyr to its course: the crowd and stakes do not move it. */
export function isCommitted(mind: UpyrMind): boolean {
  return mind.state !== 'prowl';
}

/** Advances the upyr by `dt` seconds. Stake hits do not touch the mind, so they never interrupt it. */
export function stepUpyr(
  mind: UpyrMind,
  body: UpyrBody,
  target: UpyrTarget,
  dt: number,
  cfg: UpyrConfig,
  strike: Strike,
): void {
  if (body.dead) return;
  mind.time += dt;
  switch (mind.state) {
    case 'prowl':
      prowl(mind, body, target, dt, cfg);
      break;
    case 'windUp':
      if (mind.time >= cfg.windUp) startLunge(mind, body, target);
      break;
    case 'lunge':
      lunge(mind, body, target, dt, cfg, strike);
      break;
    case 'recover':
      if (mind.time >= cfg.recover) {
        enter(mind, 'prowl');
        mind.cooldown = cfg.cooldown;
      }
      break;
  }
}

function enter(mind: UpyrMind, state: UpyrState): void {
  mind.state = state;
  mind.time = 0;
}

function prowl(mind: UpyrMind, body: UpyrBody, target: UpyrTarget, dt: number, cfg: UpyrConfig): void {
  mind.cooldown = Math.max(0, mind.cooldown - dt);
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const distance = Math.hypot(dx, dy);
  if (mind.cooldown <= 0 && distance <= cfg.attackRange) {
    enter(mind, 'windUp');
    return;
  }
  if (distance === 0) return;
  body.x += (dx / distance) * body.speed * dt;
  body.y += (dy / distance) * body.speed * dt;
}

/** Aims at where the hero stands now; the direction does not change after this. */
function startLunge(mind: UpyrMind, body: UpyrBody, target: UpyrTarget): void {
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const distance = Math.hypot(dx, dy);
  // On top of the hero there is no direction to take, so keep the last one.
  if (distance > 0) {
    mind.dirX = dx / distance;
    mind.dirY = dy / distance;
  }
  mind.travelled = 0;
  mind.struck = false;
  enter(mind, 'lunge');
}

function lunge(
  mind: UpyrMind,
  body: UpyrBody,
  target: UpyrTarget,
  dt: number,
  cfg: UpyrConfig,
  strike: Strike,
): void {
  const step = Math.min(cfg.lungeSpeed * dt, cfg.lungeDistance - mind.travelled);
  const fromX = body.x;
  const fromY = body.y;
  body.x += mind.dirX * step;
  body.y += mind.dirY * step;
  mind.travelled += step;

  // The whole path of this step counts, so a fast lunge cannot skip over the hero.
  const reach = body.radius + target.radius;
  // A hero still invulnerable from an earlier hit shrugs the strike off,
  // and the lunge may strike later while it still passes through him.
  if (!mind.struck && segmentDistance(fromX, fromY, body.x, body.y, target.x, target.y) < reach) {
    if (strike(cfg.lungeDamage)) {
      mind.struck = true;
      // Feeding on the hero restores it.
      body.hp = cfg.hp;
    }
  }
  if (mind.travelled >= cfg.lungeDistance) enter(mind, 'recover');
}

/** Distance from point (px, py) to the segment from (ax, ay) to (bx, by). */
export function segmentDistance(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const sx = bx - ax;
  const sy = by - ay;
  const length2 = sx * sx + sy * sy;
  const t = length2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * sx + (py - ay) * sy) / length2)) : 0;
  return Math.hypot(ax + sx * t - px, ay + sy * t - py);
}

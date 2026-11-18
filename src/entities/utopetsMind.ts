import type { UtopetsConfig } from '../config';
import type { Strike } from './enemy';
import { segmentDistance } from './upyrMind';

/**
 * The utopets's ways, as pure logic: he rises out of a water, harmless
 * until he stands, or walks in already standing when there is no water to
 * rise out of; then walks at the hero, and once close
 * enough and rested he stops and raises an arm for a moment (the tell),
 * lunges both arms a short way towards where the hero stood when the arm
 * went up, and holds the grasp for a moment after. He commits to that
 * direction, so a hero who steps aside during the wind-up is missed.
 */
export type UtopetsState = 'rise' | 'walk' | 'windUp' | 'grasp' | 'recover';

export interface UtopetsMind {
  state: UtopetsState;
  /** Seconds spent in the current state. */
  time: number;
  /** Seconds until he may grasp again. */
  cooldown: number;
  /** Unit direction of the grasp, fixed when the wind-up begins. */
  dirX: number;
  dirY: number;
  /** Distance covered in the current grasp. */
  travelled: number;
  /** Whether the current grasp has struck the hero, so it strikes once at most. */
  struck: boolean;
}

/** The parts of an enemy the mind moves. */
export interface UtopetsBody {
  x: number;
  y: number;
  radius: number;
  speed: number;
  dead: boolean;
}

export interface UtopetsTarget {
  x: number;
  y: number;
  radius: number;
}

/** A fresh utopets, just beginning to rise. */
export function newUtopetsMind(): UtopetsMind {
  return { state: 'rise', time: 0, cooldown: 0, dirX: 1, dirY: 0, travelled: 0, struck: false };
}

/** Starts him walking, already standing: for one that walks in from beyond the edge of the view instead of rising. */
export function walkIn(mind: UtopetsMind): void {
  enter(mind, 'walk');
}

/** Rising, winding up, grasping and recovering hold him to his spot or course: the crowd and blows do not move him. */
export function isCommitted(mind: UtopetsMind): boolean {
  return mind.state !== 'walk';
}

/** Touching him costs the hero contact damage only once he stands, and not mid-grasp, which strikes on its own. */
export function touchHurts(mind: UtopetsMind): boolean {
  return mind.state !== 'rise' && mind.state !== 'grasp';
}

/** Which of the two rising poses shows: 1, head and arms out of the ground, then 2, on all fours. */
export function riseStage(mind: UtopetsMind, cfg: Pick<UtopetsConfig, 'rise'>): 1 | 2 {
  return mind.time < cfg.rise / 2 ? 1 : 2;
}

/** Advances the utopets by `dt` seconds. Wounds do not touch the mind, so they never interrupt it. */
export function stepUtopets(
  mind: UtopetsMind,
  body: UtopetsBody,
  target: UtopetsTarget,
  dt: number,
  cfg: UtopetsConfig,
  strike: Strike,
): void {
  if (body.dead) return;
  mind.time += dt;
  switch (mind.state) {
    case 'rise':
      if (mind.time >= cfg.rise) enter(mind, 'walk');
      break;
    case 'walk':
      walk(mind, body, target, dt, cfg);
      break;
    case 'windUp':
      if (mind.time >= cfg.windUp) {
        mind.travelled = 0;
        mind.struck = false;
        enter(mind, 'grasp');
      }
      break;
    case 'grasp':
      grasp(mind, body, target, dt, cfg, strike);
      break;
    case 'recover':
      if (mind.time >= cfg.recover) {
        enter(mind, 'walk');
        mind.cooldown = cfg.cooldown;
      }
      break;
  }
}

function enter(mind: UtopetsMind, state: UtopetsState): void {
  mind.state = state;
  mind.time = 0;
}

function walk(
  mind: UtopetsMind,
  body: UtopetsBody,
  target: UtopetsTarget,
  dt: number,
  cfg: UtopetsConfig,
): void {
  mind.cooldown = Math.max(0, mind.cooldown - dt);
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const distance = Math.hypot(dx, dy);
  if (mind.cooldown <= 0 && distance <= cfg.graspRange) {
    // Aims at where the hero stands now; the direction does not change after this.
    // On top of the hero there is no direction to take, so keep the last one.
    if (distance > 0) {
      mind.dirX = dx / distance;
      mind.dirY = dy / distance;
    }
    enter(mind, 'windUp');
    return;
  }
  if (distance === 0) return;
  body.x += (dx / distance) * body.speed * dt;
  body.y += (dy / distance) * body.speed * dt;
}

function grasp(
  mind: UtopetsMind,
  body: UtopetsBody,
  target: UtopetsTarget,
  dt: number,
  cfg: UtopetsConfig,
  strike: Strike,
): void {
  const speed = cfg.graspDistance / cfg.graspTime;
  const step = Math.min(speed * dt, cfg.graspDistance - mind.travelled);
  const fromX = body.x;
  const fromY = body.y;
  body.x += mind.dirX * step;
  body.y += mind.dirY * step;
  mind.travelled += step;

  // The whole path of this step counts, so the grasp cannot skip over the hero.
  // A hero still invulnerable from an earlier hit shrugs it off, and the
  // grasp may strike later in its course.
  const reach = body.radius + target.radius;
  if (!mind.struck && segmentDistance(fromX, fromY, body.x, body.y, target.x, target.y) < reach) {
    if (strike(cfg.graspDamage)) mind.struck = true;
  }
  if (mind.travelled >= cfg.graspDistance - 1e-9) enter(mind, 'recover');
}

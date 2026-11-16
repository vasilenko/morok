import Phaser from 'phaser';
import { ANIM, TEX } from '../art/textures';
import { CFG } from '../config';
import type { Enemy, EnemyKind, Target } from './enemy';

/** Cold multiply tint that sets the pale dead apart from the warm-toned hero. */
const COLD_TINT = 0xd6f2ff;
/** Where the shadow falls below a navia's position; she floats above it. */
const SHADOW_Y = 18;
/** How far the figure is lifted above its position, before the bob. */
const LIFT = 4;
/**
 * The art flies forward and up at about this angle (negative is up the
 * screen), so a sprite rotated by `elevation - ART_LEAN` heads along
 * `elevation`.
 */
const ART_LEAN = Phaser.Math.DegToRad(-30);
/** Tilt limits, so steep approaches lean the figure without standing it on end. */
const TILT_MIN = Phaser.Math.DegToRad(-35);
const TILT_MAX = Phaser.Math.DegToRad(50);
/**
 * Amplitude of the idle rotation wobble. Kept small: the baked shroud ripple
 * already carries the motion, and a wider sway rocks the still head with it.
 */
const WOBBLE = Phaser.Math.DegToRad(2);
/** Per-enemy ripple speed varies by up to this fraction either way, so the crowd falls out of step. */
const RIPPLE_SPEED_SPREAD = 0.15;
/** How far the hero must be to one side before a navia turns, to avoid flicker. */
const TURN_DEADZONE = 2;

/** A navia: a pale spirit that floats straight at the hero and swarms him. */
export const NAVIA: EnemyKind<null> = {
  texture: TEX.navia,
  // Small and faint, as she floats.
  shadowWidth: 24,
  shadowAlpha: 0.3,
  groundY: SHADOW_Y,

  /** Later arrivals are a little faster. */
  create(elapsed) {
    const cfg = CFG.navia;
    return {
      hp: cfg.hp,
      radius: cfg.radius,
      speed: (cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin)) * (1 + elapsed / 600),
      state: null,
    };
  },

  steer(navia, dt, target) {
    const dx = target.x - navia.x;
    const dy = target.y - navia.y;
    const distance = Math.hypot(dx, dy) || 1;
    navia.x += (dx / distance) * navia.speed * dt;
    navia.y += (dy / distance) * navia.speed * dt;
  },

  anchored: () => false,

  contactDamage: () => CFG.navia.damage,

  xp: () => CFG.navia.xp,

  /** The resting tint and the ripple restarted (on a random frame, see createAnimations) at a slightly random speed. */
  dress(sprite) {
    NAVIA.rest(sprite);
    sprite.play({
      key: ANIM.naviaFly,
      timeScale: 1 + Phaser.Math.FloatBetween(-RIPPLE_SPEED_SPREAD, RIPPLE_SPEED_SPREAD),
    });
  },

  rest(sprite) {
    sprite.setTint(COLD_TINT).setTintMode(Phaser.TintModes.MULTIPLY);
  },

  place: placeNavia,
};

/** Turns the navia towards the target and tilts her along her approach. */
function placeNavia(navia: Enemy<null>, clock: number, target: Target): void {
  const dx = target.x - navia.x;
  const dy = target.y - navia.y;
  if (Math.abs(dx) > TURN_DEADZONE) navia.flipped = dx < 0;

  // Elevation of the approach above or below horizontal, positive heading
  // down the screen. The art already leans up, so tilt by the difference.
  const elevation = Math.atan2(dy, Math.abs(dx));
  const tilt = Phaser.Math.Clamp(elevation - ART_LEAN, TILT_MIN, TILT_MAX);
  const wobble = Math.sin(clock * 2.6 + navia.phase * 2.3) * WOBBLE;
  const bob = Math.sin(clock * 4 + navia.phase * 1.7) * 1.5;

  navia.sprite
    .setPosition(navia.x, navia.y - LIFT + bob)
    // A flipped sprite is mirrored, so the same tilt must turn the other way.
    .setRotation((navia.flipped ? -tilt : tilt) + wobble)
    .setFlipX(navia.flipped)
    // Sorted by the point under her, where her shadow falls.
    .setDepth(navia.y + SHADOW_Y);
  navia.shadow.setPosition(navia.x, navia.y + SHADOW_Y);
}

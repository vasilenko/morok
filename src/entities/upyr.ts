import Phaser from 'phaser';
import { ANIM, ART_SCALE, TEX, UPYR_FRAMES } from '../art/textures';
import { CFG } from '../config';
import type { Enemy, EnemyKind, Target } from './enemy';
import { isCommitted, newUpyrMind, stepUpyr, type UpyrMind } from './upyrMind';

/** Where the ground is below an upyr's position: its frames pivot here, and its shadow falls here. */
const FEET_Y = 20;
/** How far the hero must be to one side before an upyr turns, to avoid flicker. */
const TURN_DEADZONE = 2;
/** Extra height at the top of the lunge's arc, in world units, over the height of the drawn leap. */
const LUNGE_ARC = 10;
/** The still pose held in each attacking state. */
const POSE = {
  windUp: UPYR_FRAMES.windUp,
  lunge: UPYR_FRAMES.lunge,
  recover: UPYR_FRAMES.landing,
} as const;

/**
 * An upyr: a risen corpse that prowls towards the hero and lunges at him
 * from close by. Its attack is the pure state machine in upyrMind.ts; this
 * is how it enters the horde and how it looks.
 */
export const UPYR: EnemyKind<UpyrMind> = {
  texture: TEX.upyr,
  // It stands on the ground, so its shadow is as dark as the hero's.
  shadowWidth: 30,
  shadowAlpha: 0.45,
  groundY: FEET_Y,

  create() {
    const cfg = CFG.upyr;
    return { hp: cfg.hp, radius: cfg.radius, speed: cfg.speed, state: newUpyrMind() };
  },

  steer(upyr, dt, target, strike) {
    stepUpyr(upyr.state, upyr, { x: target.x, y: target.y, radius: CFG.player.radius }, dt, CFG.upyr, strike);
  },

  anchored: (upyr) => isCommitted(upyr.state),

  // Mid-lunge it passes through the hero; its strike is dealt in steer.
  contactDamage: (upyr) => (upyr.state.state === 'lunge' ? 0 : CFG.upyr.damage),

  xp: () => CFG.upyr.xp,

  dress(sprite) {
    sprite.clearTint().setRotation(0).play(ANIM.upyrProwl);
  },

  rest(sprite) {
    sprite.clearTint();
  },

  place: placeUpyr,
};

/**
 * Shows the pose of the current state. Every frame pivots on its ground
 * point, so walking, crouching and landing stand on the same spot, and a
 * flipped sprite mirrors about it.
 */
function placeUpyr(upyr: Enemy<UpyrMind>, _clock: number, target: Target): void {
  const mind = upyr.state;
  const sprite = upyr.sprite;
  const groundY = upyr.y + FEET_Y;

  if (mind.state === 'prowl' || mind.state === 'windUp') {
    const dx = target.x - upyr.x;
    if (Math.abs(dx) > TURN_DEADZONE) upyr.flipped = dx < 0;
  }

  if (mind.state === 'prowl') {
    if (!sprite.anims.isPlaying) sprite.play(ANIM.upyrProwl);
  } else {
    hold(sprite, POSE[mind.state]);
  }

  if (mind.state === 'lunge') {
    // Facing along the lunge, the body turns towards its direction; the
    // turn stays within a quarter either way, so it is never upside down.
    if (mind.dirX !== 0) upyr.flipped = mind.dirX < 0;
    const heading = Math.atan2(mind.dirY, mind.dirX);
    const rotation = upyr.flipped ? Phaser.Math.Angle.Wrap(heading - Math.PI) : heading;

    // Turned about the middle of the body, which rides the drawn height of
    // the leap above its pivot, plus an arc over the course of the lunge.
    const frame = sprite.frame;
    const side = upyr.flipped ? -1 : 1;
    const offsetX = (side * (0.5 - frame.pivotX) * frame.realWidth) / ART_SCALE;
    const height = ((frame.pivotY - 0.5) * frame.realHeight) / ART_SCALE;
    const arc = Math.sin((Math.PI * mind.travelled) / CFG.upyr.lungeDistance) * LUNGE_ARC;
    sprite
      .setOrigin(0.5, 0.5)
      .setRotation(rotation)
      .setPosition(upyr.x + offsetX, groundY - height - arc);
  } else {
    sprite.setRotation(0).setPosition(upyr.x, groundY);
  }

  sprite
    .setFlipX(upyr.flipped)
    // Sorted by the ground point, where its shadow falls.
    .setDepth(groundY);
  upyr.shadow.setPosition(upyr.x, groundY);
}

/** Stops the prowl and shows a still pose, with its own pivot. */
function hold(sprite: Phaser.GameObjects.Sprite, frame: string): void {
  if (sprite.anims.isPlaying) sprite.stop();
  if (sprite.frame.name !== frame) sprite.setFrame(frame);
}

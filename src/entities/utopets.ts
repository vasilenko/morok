import type Phaser from 'phaser';
import { ANIM, TEX, UTOPETS_FRAMES } from '../art/textures';
import { CFG } from '../config';
import type { Enemy, EnemyKind, Target } from './enemy';
import {
  isCommitted,
  newUtopetsMind,
  riseStage,
  stepUtopets,
  touchHurts,
  type UtopetsMind,
} from './utopetsMind';

/** Where the ground is below an utopets's position: his frames pivot here, and his shadow falls here. */
const FEET_Y = 22;
/** How far the hero must be to one side before he turns, to avoid flicker. */
const TURN_DEADZONE = 2;
/** Shadow opacity once he stands; it darkens from nothing as he rises. */
const SHADOW_ALPHA = 0.5;

/**
 * An utopets: a drowned man who rises out of the water, walks heavily
 * at the hero and grasps at him from close by. His ways are the pure state
 * machine in utopetsMind.ts; this is how he enters the horde and how he
 * looks.
 */
export const UTOPETS: EnemyKind<UtopetsMind> = {
  texture: TEX.utopets,
  // The bulkiest thing on the field, standing on the ground.
  shadowWidth: 38,
  shadowAlpha: 0,
  groundY: FEET_Y,
  knockback: CFG.utopets.knockback,

  create() {
    const cfg = CFG.utopets;
    return { hp: cfg.hp, radius: cfg.radius, speed: cfg.speed, state: newUtopetsMind() };
  },

  steer(utopets, dt, target, strike) {
    stepUtopets(
      utopets.state,
      utopets,
      { x: target.x, y: target.y, radius: CFG.player.radius },
      dt,
      CFG.utopets,
      strike,
    );
  },

  anchored: (utopets) => isCommitted(utopets.state),

  // Rising, he does no harm; mid-grasp his strike is dealt in steer.
  contactDamage: (utopets) => (touchHurts(utopets.state) ? CFG.utopets.damage : 0),

  xp: () => CFG.utopets.xp,

  dress(sprite) {
    sprite.clearTint().setRotation(0);
    if (sprite.anims.isPlaying) sprite.stop();
    sprite.setFrame(UTOPETS_FRAMES.rise[0]);
  },

  rest(sprite) {
    sprite.clearTint();
  },

  place: placeUtopets,
};

/**
 * Shows the pose of the current state, every frame pivoted on its ground
 * point, so he stands on one spot whatever the pose and whichever way he
 * faces; the rising poses' bottom edge is the ground he comes up through.
 */
function placeUtopets(utopets: Enemy<UtopetsMind>, _clock: number, target: Target): void {
  const mind = utopets.state;
  const sprite = utopets.sprite;
  const groundY = utopets.y + FEET_Y;

  if (mind.state === 'walk' || mind.state === 'rise') {
    const dx = target.x - utopets.x;
    if (Math.abs(dx) > TURN_DEADZONE) utopets.flipped = dx < 0;
  } else if (mind.dirX !== 0) {
    // From the wind-up on he faces the way he grasps.
    utopets.flipped = mind.dirX < 0;
  }

  switch (mind.state) {
    case 'rise':
      hold(sprite, UTOPETS_FRAMES.rise[riseStage(mind, CFG.utopets) - 1]);
      break;
    case 'walk':
      if (!sprite.anims.isPlaying) sprite.play(ANIM.utopetsWalk);
      break;
    case 'windUp':
      hold(sprite, UTOPETS_FRAMES.windUp);
      break;
    default:
      hold(sprite, UTOPETS_FRAMES.grasp);
  }

  // A flipped sprite mirrors within its frame, so the pivot is mirrored
  // too: the ground point stays under him whichever way he faces.
  const frame = sprite.frame;
  sprite
    .setOrigin(utopets.flipped ? 1 - frame.pivotX : frame.pivotX, frame.pivotY)
    .setPosition(utopets.x, groundY)
    .setFlipX(utopets.flipped)
    // Sorted by the ground point, where his shadow falls.
    .setDepth(groundY);
  // His shadow spreads under him as he comes up.
  const risen = mind.state === 'rise' ? mind.time / CFG.utopets.rise : 1;
  utopets.shadow.setPosition(utopets.x, groundY).setAlpha(SHADOW_ALPHA * risen);
}

/** Stops the walk and shows a still pose, with its own pivot. */
function hold(sprite: Phaser.GameObjects.Sprite, frame: string): void {
  if (sprite.anims.isPlaying) sprite.stop();
  if (sprite.frame.name !== frame) sprite.setFrame(frame);
}

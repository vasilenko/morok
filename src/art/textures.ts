import Phaser from 'phaser';
import groundUrl from './sprites/kurgan-ground.jpg';
import naviaSheet from './sprites/navia.json';
import naviaUrl from './sprites/navia.png';
import sceneryAtlas from './sprites/scenery.json';
import sceneryUrl from './sprites/scenery.png';
import stakeUrl from './sprites/stake.png';
import upyrAtlas from './sprites/upyr.json';
import upyrUrl from './sprites/upyr.png';
import volhvSheet from './sprites/volhv-walk.json';
import volhvUrl from './sprites/volhv-walk.png';
import { ART_SCALE, GROUND_ART_SCALE } from './scale';

/**
 * Game art. Characters, props and the ground tile are generated from
 * art/source/ by `npm run sprites`; the shadow and the particle dot are
 * drawn with the 2D canvas API at boot and registered as Phaser textures.
 */

export { ART_SCALE, GROUND_ART_SCALE };

/** Side of the repeating ground tile, in world units. */
export const GROUND_TILE = 512;

export const TEX = {
  navia: 'navia',
  upyr: 'upyr',
  volhv: 'volhv',
  stake: 'stake',
  shadow: 'shadow',
  dot: 'dot',
  ground: 'ground',
  scenery: 'scenery',
} as const;

export const ANIM = {
  naviaFly: 'navia-fly',
  upyrProwl: 'upyr-prowl',
  volhvWalk: 'volhv-walk',
} as const;

/** Playback rate of the ripple; one loop takes a little under a second. */
const NAVIA_FPS = 10;

/**
 * Playback rate of the volhv's walk: two steps every half second. A planted
 * boot travels about 6 units per frame, so the ground would only match the
 * hero's 175 units/s at some 28 fps, which reads as a frantic scurry for
 * an old man. At this rate the planted boot keeps a bit over half the
 * ground speed and visibly slides, which reads better than legs a blur.
 */
const VOLHV_WALK_FPS = 16;

/**
 * The volhv's walk frames, counted from 0: contact, down, passing and up
 * for one leg, then the same for the other.
 */
export const VOLHV_FRAMES = {
  /** Both boots on the ground and closest together; held while standing. */
  stand: 5,
  /** Where the weight sinks onto the leading leg, twice per cycle. */
  firstDown: 1,
  count: volhvSheet.frameCount,
} as const;

/**
 * Playback rate of the upyr's prowl: four frames, two steps, per cycle. A
 * step covers some 30 units, so the feet would only hold the ground at its
 * 60 units/s at 4 fps, which stutters; like the volhv's, its feet slide a
 * little in exchange for a smoother gait.
 */
const UPYR_PROWL_FPS = 6;

/** Frames of the upyr atlas held while attacking; each pivots on its ground point. */
export const UPYR_FRAMES = {
  windUp: 'wind-up',
  lunge: 'lunge',
  landing: 'landing',
} as const;

const TAU = Math.PI * 2;

/** A grey multiply tint that scales a texture's colours by `brightness` (0..1). */
export function greyTint(brightness: number): number {
  const level = Math.round(brightness * 255);
  return Phaser.Display.Color.GetColor(level, level, level);
}

type Ctx = CanvasRenderingContext2D;

function makeCanvas(width: number, height: number, scale: number): { canvas: HTMLCanvasElement; g: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return { canvas, g };
}

const disc = (g: Ctx, x: number, y: number, r: number) => {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
};
const oval = (g: Ctx, x: number, y: number, rx: number, ry: number) => {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
};

// ── Procedural textures ────────────────────────────────────────────────────

/** Soft blob shadow, tinted and faded by whoever uses it. */
function createShadow(textures: Phaser.Textures.TextureManager): void {
  const { canvas, g } = makeCanvas(28, 10, ART_SCALE);
  g.fillStyle = '#000000';
  oval(g, 14, 5, 13, 4.5);
  textures.addCanvas(TEX.shadow, canvas);
}

/** White disc used for particles; 32px across. */
function createDot(textures: Phaser.Textures.TextureManager): void {
  const { canvas, g } = makeCanvas(32, 32, 1);
  g.fillStyle = '#ffffff';
  disc(g, 16, 16, 15);
  textures.addCanvas(TEX.dot, canvas);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Queues the sprite images. They are imported so that Vite fingerprints
 * them and rewrites the URLs for the build's relative base path.
 */
export function loadSprites(load: Phaser.Loader.LoaderPlugin): void {
  load.spritesheet(TEX.volhv, volhvUrl, {
    frameWidth: volhvSheet.frameWidth,
    frameHeight: volhvSheet.frameHeight,
  });
  load.spritesheet(TEX.navia, naviaUrl, {
    frameWidth: naviaSheet.frameWidth,
    frameHeight: naviaSheet.frameHeight,
  });
  load.atlas(TEX.upyr, upyrUrl, upyrAtlas);
  load.image(TEX.stake, stakeUrl);
  load.image(TEX.ground, groundUrl);
  load.atlas(TEX.scenery, sceneryUrl, sceneryAtlas);
}

/** Animations are global, so they are created once at boot for every scene. */
export function createAnimations(anims: Phaser.Animations.AnimationManager): void {
  anims.create({
    key: ANIM.naviaFly,
    frames: anims.generateFrameNumbers(TEX.navia),
    frameRate: NAVIA_FPS,
    repeat: -1,
    // Each play starts on a random frame, so the crowd does not ripple in step.
    randomFrame: true,
  });
  anims.create({
    key: ANIM.upyrProwl,
    frames: anims.generateFrameNames(TEX.upyr, { prefix: 'prowl-', start: 1, end: 4 }),
    frameRate: UPYR_PROWL_FPS,
    repeat: -1,
    // Out of step with each other, like the navii.
    randomFrame: true,
  });
  anims.create({
    key: ANIM.volhvWalk,
    frames: anims.generateFrameNumbers(TEX.volhv),
    frameRate: VOLHV_WALK_FPS,
    repeat: -1,
  });
}

export function createTextures(textures: Phaser.Textures.TextureManager): void {
  createShadow(textures);
  createDot(textures);
}

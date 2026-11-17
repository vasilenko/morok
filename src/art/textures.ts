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
import teethAtlas from './sprites/wolf-teeth.json';
import teethUrl from './sprites/wolf-teeth.png';
import { COAL, coalLight, GRADE_COLORS, WING, wingCover } from './coals';
import { ART_SCALE, GROUND_ART_SCALE } from './scale';

/**
 * Game art. Characters, props and the ground tile are generated from
 * art/source/ by `npm run sprites`; the shadow, the particle dot and the
 * sparks' coals are drawn with the 2D canvas API at boot and registered
 * as Phaser textures.
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
  speck: 'speck',
  coal: 'coal',
  ground: 'ground',
  scenery: 'scenery',
  teeth: 'teeth',
} as const;

/** The four drawings of a fang in the wolf teeth's atlas, each lying with its tip to the right. */
export const FANG_FRAMES = Object.keys(teethAtlas.frames);

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
function createDot(textures: Phaser.Textures.TextureManager): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(32, 32, 1);
  g.fillStyle = '#ffffff';
  disc(g, 16, 16, 15);
  textures.addCanvas(TEX.dot, canvas);
  return canvas;
}

/**
 * The dot as light, for sprites that must add their light to what is under
 * them like the ADD blend does, yet sort among the entities in their normal
 * blend, where another blend mode would break the batch at every one.
 *
 * Its colour is the dot's light and its alpha a token 1/255 throughout.
 * Phaser's sprite shader divides a texel's colour by its alpha and
 * multiplies it back by the alpha it draws with, so such a texel comes out
 * as the dot's light, scaled by the sprite's tint and alpha, over a
 * background left all but untouched: the same as the dot added. It is
 * uploaded as raw data, since a canvas would premultiply that colour away.
 */
function createSpeck(textures: Phaser.Textures.TextureManager, dot: HTMLCanvasElement): void {
  const { width, height } = dot;
  const pixels = dot.getContext('2d')!.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(pixels.length);
  for (let at = 0; at < data.length; at += 4) {
    const alpha = pixels[at + 3] / 255;
    for (let c = 0; c < 3; c++) data[at + c] = Math.round(pixels[at + c] * alpha);
    data[at + 3] = 1;
  }
  const renderer = textures.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const glTexture = renderer.createUint8ArrayTexture(data, width, height, false);
  // Smooth like the canvas textures, where raw data defaults to blocky.
  renderer.setTextureFilter(glTexture, Phaser.Textures.FilterMode.LINEAR);
  textures.addGLTexture(TEX.speck, glTexture);
}

/** The frame of the coals' texture that holds the wing. */
export const WING_FRAME = 'wing';

/** The frame of the coals' texture that holds a coal of `grade`, on the ground or off it. */
export function coalFrame(grade: number, grounded: boolean): number {
  return grounded ? grade : GRADE_COLORS.length + grade;
}

/**
 * Every grade's coal in one texture, on the ground and off it (see
 * coalFrame), with the wing beside them, so all the sparks draw in one
 * batch. Both are worked out per pixel: the coal's light is stored as the
 * colour and opacity that, laid over black, give that light; the wing is
 * white, of its cover's opacity. Each frame's origin is the coal's heart
 * or the wing's root.
 */
function createCoals(textures: Phaser.Textures.TextureManager): void {
  const [coal, wing] = [COAL.frame, WING.frame];
  const [coalW, coalH] = [coal.width * ART_SCALE, coal.height * ART_SCALE];
  const [wingW, wingH] = [wing.width * ART_SCALE, wing.height * ART_SCALE];
  const grades = GRADE_COLORS.length;
  const coals = 2 * grades;
  const { canvas, g } = makeCanvas(coal.width * coals + wing.width, Math.max(coal.height, wing.height), ART_SCALE);
  const image = g.createImageData(canvas.width, canvas.height);
  const put = (i: number, j: number, rgb: readonly number[], alpha: number) => {
    const at = (j * canvas.width + i) * 4;
    for (let c = 0; c < 3; c++) image.data[at + c] = Math.round(255 * rgb[c]);
    image.data[at + 3] = Math.round(255 * alpha);
  };
  const at = (pixel: number) => (pixel + 0.5) / ART_SCALE;
  const frames: number[] = [];
  for (const grounded of [true, false]) {
    GRADE_COLORS.forEach((color, grade) => {
      const frame = coalFrame(grade, grounded);
      frames.push(frame);
      for (let j = 0; j < coalH; j++) {
        for (let i = 0; i < coalW; i++) {
          const light = coalLight(coal.left + at(i), coal.top + at(j), color, grounded);
          const alpha = Math.min(1, Math.max(...light));
          put(frame * coalW + i, j, alpha > 0 ? light.map((c) => Math.min(1, c / alpha)) : light, alpha);
        }
      }
    });
  }
  for (let j = 0; j < wingH; j++) {
    for (let i = 0; i < wingW; i++) put(coals * coalW + i, j, [1, 1, 1], wingCover(wing.left + at(i), wing.top + at(j)));
  }
  g.putImageData(image, 0, 0);
  const texture = textures.addCanvas(TEX.coal, canvas)!;
  for (const frame of frames) texture.add(frame, 0, frame * coalW, 0, coalW, coalH);
  texture.add(WING_FRAME, 0, coals * coalW, 0, wingW, wingH);
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
  load.atlas(TEX.teeth, teethUrl, teethAtlas);
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
  createSpeck(textures, createDot(textures));
  createCoals(textures);
}

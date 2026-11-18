import Phaser from 'phaser';
import groundUrl from './sprites/kurgan-ground.jpg';
import naviaSheet from './sprites/navia.json';
import naviaUrl from './sprites/navia.png';
import relicsAtlas from './sprites/relics.json';
import relicsUrl from './sprites/relics.png';
import signsAtlas from './sprites/signs.json';
import signsUrl from './sprites/signs.png';
import sceneryAtlas from './sprites/scenery.json';
import sceneryUrl from './sprites/scenery.png';
import stakeUrl from './sprites/stake.png';
import upyrAtlas from './sprites/upyr.json';
import upyrUrl from './sprites/upyr.png';
import utopetsAtlas from './sprites/utopets.json';
import utopetsUrl from './sprites/utopets.png';
import volhvSheet from './sprites/volhv-walk.json';
import volhvUrl from './sprites/volhv-walk.png';
import teethAtlas from './sprites/wolf-teeth.json';
import teethUrl from './sprites/wolf-teeth.png';
import { CFG } from '../config';
import { COAL, coalLight, GRADE_COLORS, WING, wingCover } from './coals';
import { bakeGlow, bakeRays, SIGN_LIGHT, signPixels, strands } from './signs';
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
  utopets: 'utopets',
  volhv: 'volhv',
  stake: 'stake',
  shadow: 'shadow',
  dot: 'dot',
  speck: 'speck',
  coal: 'coal',
  ground: 'ground',
  scenery: 'scenery',
  teeth: 'teeth',
  relics: 'relics',
  ring: 'ring',
  trail: 'trail',
  signs: 'signs',
  signLight: 'sign-light',
  drownedSheen: 'drowned-sheen',
} as const;

/** The black book's four signs, each a frame of the signs' atlas: its cuts, dark, of the opacity of the cut. */
export const SIGN_FRAMES = Object.keys(signsAtlas.frames);

/** The frame of the signs' light that holds the glow of the cuts of `drawing`. */
export function signGlowFrame(drawing: number): string {
  return `glow-${drawing}`;
}

/** The frame of the signs' light that holds the rays of `drawing` rising from `band`, of strand group `group`. */
export function signRaysFrame(drawing: number, band: number, group: number): string {
  return `rays-${drawing}-${band}-${group}`;
}

/** The frames of the relics' atlas: the funeral bell and the sickle, as seen in the world. */
export const RELIC_FRAMES = {
  bell: 'bell',
  sickle: 'sickle',
} as const satisfies Record<string, keyof typeof relicsAtlas.frames>;

/** The four drawings of a fang in the wolf teeth's atlas, each lying with its tip to the right. */
export const FANG_FRAMES = Object.keys(teethAtlas.frames);

export const ANIM = {
  naviaFly: 'navia-fly',
  upyrProwl: 'upyr-prowl',
  utopetsWalk: 'utopets-walk',
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

/**
 * Playback rate of the utopets's heavy walk: four frames, two steps,
 * per cycle. At his 30 units/s his feet would hold the ground at about
 * 3 fps, which reads as a slideshow; a little faster, they slide a little.
 */
const UTOPETS_WALK_FPS = 4;

/** Frames of the utopets atlas held while rising and attacking; each pivots on its ground point. */
export const UTOPETS_FRAMES = {
  rise: ['rise-1', 'rise-2'],
  windUp: 'wind-up',
  grasp: 'grasp',
} as const satisfies Record<string, keyof typeof utopetsAtlas.frames | readonly (keyof typeof utopetsAtlas.frames)[]>;

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
 * Registers `light`, RGBA pixels of which only the colour counts, as a
 * texture whose sprites add their light to what is under them like the
 * ADD blend does, yet sort among the entities in their normal blend, where
 * another blend mode would break the batch at every one.
 *
 * Its colour is the light and its alpha a token 1/255 throughout. Phaser's
 * sprite shader divides a texel's colour by its alpha and multiplies it
 * back by the alpha it draws with, so such a texel comes out as the light,
 * scaled by the sprite's tint and alpha, over a background left all but
 * untouched: the same as the light added. It is uploaded as raw data,
 * since a canvas would premultiply that colour away. The alpha of `light`
 * is overwritten.
 */
export function addLightTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  light: Uint8Array,
  width: number,
  height: number,
): Phaser.Textures.Texture {
  for (let at = 3; at < light.length; at += 4) light[at] = 1;
  const renderer = textures.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const glTexture = renderer.createUint8ArrayTexture(light, width, height, false);
  // Smooth like the canvas textures, where raw data defaults to blocky.
  renderer.setTextureFilter(glTexture, Phaser.Textures.FilterMode.LINEAR);
  return textures.addGLTexture(key, glTexture)!;
}

/** The dot as light (see addLightTexture), for the tiny sparks the coals shed and the trails of those in flight. */
function createSpeck(textures: Phaser.Textures.TextureManager, dot: HTMLCanvasElement): void {
  const { width, height } = dot;
  const pixels = dot.getContext('2d')!.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(pixels.length);
  for (let at = 0; at < data.length; at += 4) {
    const alpha = pixels[at + 3] / 255;
    for (let c = 0; c < 3; c++) data[at + c] = Math.round(pixels[at + c] * alpha);
  }
  addLightTexture(textures, TEX.speck, data, width, height);
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

/**
 * The funeral bell's ring as it runs out along the ground: a pale band
 * that brightens towards its front, which is the frame's circle, and ends
 * there in a soft rim. A band of a fixed width is a smaller share of a
 * wider ring, so there is a frame for each share in `shares`, from the
 * whole radius down to a thin line; the bell picks the frame nearest the
 * share its band takes now, and scales and flattens it to the ring.
 */
export const RING = {
  /** Side of a frame, in pixels; the front is a circle `front` pixels from its middle. */
  size: 256,
  front: 124,
  /** Width of the soft rim outside the front, in pixels. */
  rim: 2.5,
  /** The band's width as a share of the radius, frame by frame, from wide to thin. */
  shares: Array.from({ length: 12 }, (_, i) => 0.9 * (0.025 / 0.9) ** (i / 11)),
};

/** The frame of the ring's texture whose band is nearest `share` of the radius wide. */
export function ringFrame(share: number): number {
  let best = 0;
  RING.shares.forEach((s, i) => {
    if (Math.abs(Math.log(s / share)) < Math.abs(Math.log(RING.shares[best] / share))) best = i;
  });
  return best;
}

/** The ring's frames in a grid, white, of the opacity of their light: drawn added, tinted by the bell. */
function createRing(textures: Phaser.Textures.TextureManager): void {
  const { size, front, rim, shares } = RING;
  const columns = 4;
  const rows = Math.ceil(shares.length / columns);
  const { canvas, g } = makeCanvas(size * columns, size * rows, 1);
  const image = g.createImageData(canvas.width, canvas.height);
  shares.forEach((share, frame) => {
    const [left, top] = [(frame % columns) * size, Math.floor(frame / columns) * size];
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const r = Math.hypot(i + 0.5 - size / 2, j + 0.5 - size / 2);
        // 0 at the band's inner edge, 1 at the front.
        const across = (r / front - (1 - share)) / share;
        if (across <= 0) continue;
        const light = Math.min(1, across) ** 1.6 * (1 - smoothstep(front, front + rim, r));
        const at = ((top + j) * canvas.width + left + i) * 4;
        image.data.set([255, 255, 255, Math.round(255 * light)], at);
      }
    }
  });
  g.putImageData(image, 0, 0);
  const texture = textures.addCanvas(TEX.ring, canvas)!;
  shares.forEach((_, frame) => texture.add(frame, 0, (frame % columns) * size, Math.floor(frame / columns) * size, size, size));
}

/**
 * The light of the black book's signs, baked from the darkness of their
 * cuts (see signs.ts) into one texture of added light (see
 * addLightTexture): for every drawing, the glow of its cuts, coloured, and
 * its rays, band by band and group by group, white, for the book to tint.
 * A glow frame is centred on the sign; a ray frame's bottom row is its
 * band's last. The strands are drawn from a fixed seed, so every run's
 * signs look alike.
 */
function createSignLight(textures: Phaser.Textures.TextureManager): void {
  const { width, height } = signPixels(CFG.ground.flatten);
  // Read back once per drawing, so the context is kept on the CPU.
  const cut = { g: document.createElement('canvas').getContext('2d', { willReadFrequently: true })! };
  cut.g.canvas.width = width;
  cut.g.canvas.height = height;
  const sheet = textures.get(TEX.signs);
  const frames: Array<{ name: string; w: number; h: number; rgb: (p: number, c: number) => number }> = [];
  SIGN_FRAMES.forEach((name, drawing) => {
    const frame = sheet.get(name);
    cut.g.clearRect(0, 0, width, height);
    cut.g.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, width, height);
    const pixels = cut.g.getImageData(0, 0, width, height).data;
    const mask = new Float32Array(width * height);
    for (let p = 0; p < mask.length; p++) mask[p] = pixels[p * 4 + 3] / 255;

    const glow = bakeGlow(mask, width, height);
    const margin = SIGN_LIGHT.margin;
    frames.push({ name: signGlowFrame(drawing), w: width + 2 * margin, h: height + 2 * margin, rgb: (p, c) => glow[p * 3 + c] });
    const lines = strands(width, seeded(drawing + 1));
    for (let band = 0; band < SIGN_LIGHT.bands; band++) {
      for (let group = 0; group < SIGN_LIGHT.groups; group++) {
        const rays = bakeRays(mask, width, height, band, group, lines);
        frames.push({ name: signRaysFrame(drawing, band, group), w: width, h: rays.length / width, rgb: (p) => rays[p] });
      }
    }
  });

  // Shelves of frames, each with a gutter of clear pixels so smoothing never bleeds in a neighbour.
  const gutter = 2;
  const atlasWidth = 2048;
  const placed: Array<{ x: number; y: number }> = [];
  let [x, y, shelf] = [0, 0, 0];
  for (const frame of frames) {
    if (x + frame.w + 2 * gutter > atlasWidth) [x, y, shelf] = [0, y + shelf, 0];
    placed.push({ x: x + gutter, y: y + gutter });
    x += frame.w + 2 * gutter;
    shelf = Math.max(shelf, frame.h + 2 * gutter);
  }
  const atlasHeight = y + shelf;
  const data = new Uint8Array(atlasWidth * atlasHeight * 4);
  frames.forEach((frame, i) => {
    const at = placed[i];
    for (let j = 0; j < frame.h; j++) {
      for (let k = 0; k < frame.w; k++) {
        const o = ((at.y + j) * atlasWidth + at.x + k) * 4;
        for (let c = 0; c < 3; c++) data[o + c] = Math.round(255 * frame.rgb(j * frame.w + k, c));
      }
    }
  });
  const texture = addLightTexture(textures, TEX.signLight, data, atlasWidth, atlasHeight);
  frames.forEach((frame, i) => texture.add(frame.name, 0, placed[i].x, placed[i].y, frame.w, frame.h));
}

/** A random source of uniform draws 0..1 that repeats for the same seed (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The sickle's trail, laid along the arc it has swept as a strip: its
 * length runs from the start edge (left) to the blade (right) and its
 * height from the outer edge of the crescent (top) to the inner (bottom).
 * Light of a pale warm bone-white, `color`, brightest at the blade and at
 * the outer edge, fading to nothing at the start edge and towards the
 * inner edge, with a narrow soft rim on the outside so it reads as one
 * clean cut through the air. The sickle adds it to what is under it.
 */
export const TRAIL = { width: 128, height: 32, color: [242, 230, 204] };

function createTrail(textures: Phaser.Textures.TextureManager): void {
  const { width, height } = TRAIL;
  const { canvas, g } = makeCanvas(width, height, 1);
  const image = g.createImageData(width, height);
  for (let j = 0; j < height; j++) {
    const v = (j + 0.5) / height;
    const across = smoothstep(0, 0.12, v) * (1 - v) ** 1.4;
    for (let i = 0; i < width; i++) {
      const u = (i + 0.5) / width;
      const along = u ** 1.6;
      image.data.set([...TRAIL.color, Math.round(255 * Math.min(1, 1.25 * across * along))], (j * width + i) * 4);
    }
  }
  g.putImageData(image, 0, 0);
  textures.addCanvas(TEX.trail, canvas);
}

/**
 * The faint witch-light on drowned water (see DrownedWater), so that it can
 * be made out in the dark as well as in the hero's light: a sickly green
 * film over the water, gathering into a rim along its edge. A light texture
 * (see addLightTexture), round, `size` pixels across; the water's edge is
 * `edge` of the way out from its middle, and its light at its brightest is
 * `color`, a green well above its red and blue, so the night takes it for
 * witch-light.
 */
export const DROWNED_SHEEN = { size: 128, edge: 0.72, color: [0.04, 0.14, 0.06] };

function createDrownedSheen(textures: Phaser.Textures.TextureManager): void {
  const { size, edge, color } = DROWNED_SHEEN;
  const light = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const r = Math.hypot((i + 0.5) / size - 0.5, (j + 0.5) / size - 0.5) * 2;
      const rim = smoothstep(edge - 0.25, edge, r) * (1 - smoothstep(edge, edge + 0.1, r));
      const film = 0.2 * (1 - smoothstep(edge - 0.1, edge + 0.05, r));
      const share = Math.max(rim, film);
      for (let c = 0; c < 3; c++) light[(j * size + i) * 4 + c] = Math.round(255 * color[c] * share);
    }
  }
  addLightTexture(textures, TEX.drownedSheen, light, size, size);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
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
  load.atlas(TEX.utopets, utopetsUrl, utopetsAtlas);
  load.image(TEX.stake, stakeUrl);
  load.image(TEX.ground, groundUrl);
  load.atlas(TEX.scenery, sceneryUrl, sceneryAtlas);
  load.atlas(TEX.teeth, teethUrl, teethAtlas);
  load.atlas(TEX.relics, relicsUrl, relicsAtlas);
  load.atlas(TEX.signs, signsUrl, signsAtlas);
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
    key: ANIM.utopetsWalk,
    frames: anims.generateFrameNames(TEX.utopets, { prefix: 'walk-', start: 1, end: 4 }),
    frameRate: UTOPETS_WALK_FPS,
    repeat: -1,
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
  createRing(textures);
  createTrail(textures);
  createSignLight(textures);
  createDrownedSheen(textures);
}

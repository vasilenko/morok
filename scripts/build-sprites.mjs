/**
 * Turns the source art in art/source/ into game-ready sprites in
 * src/art/sprites/. Run with `npm run sprites` after changing a source
 * image or a size below, and commit the output.
 *
 * Each sprite is trimmed to its opaque bounds, resized so the figure has the
 * given size in world units at ART_SCALE, and padded with a transparent
 * gutter so linear filtering never clips its edges.
 *
 * A sprite with a `ripple` is baked into a looping cloth animation instead,
 * and a sprite with a `sheet` is cut out of a generated sheet of poses on a
 * light backdrop. Both come out as a horizontal strip of frames that share
 * one canvas and registration, plus a JSON file with the frame size and
 * count for the game to load it by.
 *
 * Poses too different in size to share a frame (see UPYR) are packed into
 * an atlas instead, each trimmed on its own with its ground point as pivot.
 * A sheet drawn as framed cells, each pose standing on a ground line (see
 * UTOPETS), is cut cell by cell into such an atlas.
 *
 * The ground tile is resized on its own, keeping its seams; see GROUND.
 * The items' pictures and the kill count's icon for the interface are plain
 * images; see ITEM_PICTURES and KILLS_ICON. The signs the black book cuts
 * are drawn in thin lines that the usual cutting would split into strokes,
 * so they are taken by the quarter of their sheet instead; see SIGNS.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  backdropMask,
  clearUninked,
  crop,
  cutOut,
  findCells,
  groundPoint,
  isolateFigure,
  removeGroundLine,
  splitFigures,
  upperBodyAnchor,
} from './cutout.mjs';
import { rippleReach, warpRipple } from './ripple.mjs';

/** Must match ART_SCALE in src/art/scale.ts. */
const ART_SCALE = 3;
/** Transparent border around each sprite, in output pixels. */
const GUTTER = 2;
/** Pixels at or below this alpha count as background when trimming. */
const TRIM_ALPHA = 8;
/**
 * The source art is almost but not quite opaque inside (alpha 252-253),
 * which would let the ground show faintly through. Snap it to solid.
 */
const SOLID_ALPHA = 250;

/**
 * The navia's shroud waves while her head and claws stay still. The body
 * axis runs from her face to the tip of the hem, in source pixels; see
 * scripts/ripple.mjs for what the numbers mean.
 */
const NAVIA_RIPPLE = {
  frames: 8,
  head: [880, 250],
  tail: [170, 1100],
  rigidUntil: 0.3,
  looseFrom: 0.8,
  amplitude: 0.04,
  waves: 1.25,
};

/**
 * The volhv's walk cycle: eight poses on a flat near-white backdrop, two
 * rows of four, read like text. See scripts/cutout.mjs for the steps.
 */
const VOLHV_WALK = {
  frames: 8,
  backdrop: {
    minLight: 236,
    maxSpread: 8,
    // Every enclosed light pocket on this sheet, down to single pixels, is
    // backdrop showing through a gap in the hatching; the art paints its
    // highlights warm, never neutral white.
    minPocket: 1,
  },
  edge: { band: 2, backdrop: 249, ink: 28, maxSpread: 28 },
  // The figures are about 430 pixels tall and their rows 512 apart.
  split: { minArea: 20000, minSpeck: 4, rowGap: 200 },
};

/**
 * Source image, output file and the size of the trimmed figure in world
 * units. Give either a height or a width; the other follows the aspect.
 */
const SPRITES = [
  { source: 'volhv-walk.png', output: 'volhv-walk.png', height: 56, sheet: VOLHV_WALK },
  { source: 'navia.png', output: 'navia.png', height: 36, ripple: NAVIA_RIPPLE },
  { source: 'stake.png', output: 'stake.png', width: 34 },
];

/**
 * How the kurgan scenery sheets are cut: six props on a flat near-white
 * backdrop, two rows of three.
 */
const KURGAN_SHEET = {
  backdrop: {
    minLight: 236,
    maxSpread: 8,
    // Unlike the volhv sheet, these props paint pale lichen and grey ash
    // that a smaller pocket would mistake for backdrop.
    minPocket: 12,
  },
  edge: { band: 2, backdrop: 249, ink: 28, maxSpread: 28 },
  // The smallest prop is some 24000 pixels; loose pebbles and bones of
  // up to 3000 pixels join the nearest prop. Rows are 512 pixels apart.
  split: { minArea: 15000, minSpeck: 4, rowGap: 200 },
};

/**
 * The upyr: seven poses on a plain white backdrop, a row of four and a row
 * of three, read like text: a prowl of four frames, the wind-up, the lunge
 * and the landing. They differ too much in size and shape to share one
 * frame, so each is trimmed on its own and packed into an atlas, with its
 * ground point (see groundPoint in scripts/cutout.mjs) as the frame's
 * pivot; stood on one spot, the poses do not jump between frames.
 */
const UPYR = {
  source: 'upyr.png',
  output: 'upyr',
  /** Frame names in reading order of the sheet. */
  frames: ['prowl-1', 'prowl-2', 'prowl-3', 'prowl-4', 'wind-up', 'lunge', 'landing'],
  /** The tallest of these frames is `height` world units; every frame shares its scale. */
  sizedBy: ['prowl-1', 'prowl-2', 'prowl-3', 'prowl-4'],
  height: 46,
  cut: {
    backdrop: {
      minLight: 236,
      maxSpread: 8,
      // Every neutral light pocket on this sheet is backdrop: inside the
      // curled hands, through the open mouth, and slivers between the hair
      // strands under the chin. The eyes and teeth are painted cream,
      // outside the neutral range, so they stay whatever their size.
      minPocket: 1,
    },
    edge: { band: 2, backdrop: 249, ink: 28, maxSpread: 28 },
    // The smallest pose is some 68000 pixels; the rows are 460 apart.
    split: { minArea: 20000, minSpeck: 4, rowGap: 200 },
  },
};

/** How the sheets drawn like the upyr's are cut: figures on a plain white backdrop. */
const PLAIN_SHEET = UPYR.cut;

/**
 * The utopets, the drowned man: eight poses, each in a framed cell of
 * its own on a white backdrop, two rows of four, the cells of the lower row
 * not as wide as those of the upper. A heavy walk of four frames, rising
 * out of the ground in two (his head and arms, then on all fours), the
 * wind-up with an arm raised and the grasp with both arms forward. Every
 * cell is cut on its own (see cutCells): its frame and its grey number are
 * left out and the ground line he stands on is taken from under him. Then
 * the poses are packed as the upyr's are, each pivoted on its ground point;
 * the bottom edge of the two rising poses, cut off by the ground in the
 * drawing, is that ground.
 */
const UTOPETS = {
  source: 'utopets.png',
  output: 'utopets',
  frames: ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'rise-1', 'rise-2', 'wind-up', 'grasp'],
  sizedBy: ['walk-1', 'walk-2', 'walk-3', 'walk-4'],
  height: 58,
  cut: {
    ...PLAIN_SHEET,
    // The frames are drawn in a grey of about 200, fringed up to 234.
    frame: { minLight: 150, maxLight: 235, maxSpread: 8, minShare: 0.6, minCell: 20 },
    // Each cell holds one pose, of some 60000 pixels or more; the drops of
    // water falling from him are loose specks of a few dozen.
    split: { minArea: 20000, minSpeck: 4, rowGap: 200 },
    // The numbers are grey no darker than about 137; the drops are outlined in ink.
    maxInk: 80,
    // The ground line runs most of the way across its cell.
    groundLine: { minRun: 0.5, ink: 60 },
  },
};

/**
 * The wolf teeth that circle the hero: four fangs in a row, each lying with
 * its tip pointing right. They are packed into an atlas, trimmed each on
 * its own and scaled alike, so the longest is `width` world units across;
 * the game turns each about its middle.
 */
const WOLF_TEETH = {
  source: 'wolf-teeth.png',
  output: 'wolf-teeth',
  frames: ['fang-1', 'fang-2', 'fang-3', 'fang-4'],
  width: 18,
  cut: PLAIN_SHEET,
};

/**
 * The pictures of the items on the level-up cards, which are DOM images,
 * not textures: one file each, fitted into a square of `size` pixels,
 * which is the card's picture at twice its CSS size, for sharp displays.
 */
const ITEM_PICTURES = {
  source: 'items.png',
  outputs: ['item-stake.png', 'item-teeth.png', 'item-hag-stone.png'],
  size: 144,
  cut: PLAIN_SHEET,
};

/** The pictures of the funeral bell, the sickle and the black book, drawn on a sheet of their own. */
const RELIC_PICTURES = {
  source: 'items-bell-sickle-book.png',
  outputs: ['item-bell.png', 'item-sickle.png', 'item-book.png'],
  size: 144,
  cut: PLAIN_SHEET,
};

/**
 * The bell and the sickle as they are seen in the world, from the same
 * sheet as their pictures: the bell over the hero when it tolls, the
 * sickle in his swing. Packed into an atlas, each at its own size in world
 * units; the book has no sprite.
 */
const RELICS = {
  source: RELIC_PICTURES.source,
  output: 'relics',
  frames: 3,
  cut: PLAIN_SHEET,
  take: {
    1: { name: 'bell', height: 20 },
    2: { name: 'sickle', width: 40 },
  },
};

/**
 * The four signs the black book cuts into the ground, each in its own
 * quarter of a plain white sheet, drawn in thin dark lines. Every quarter's
 * lines, trimmed to their bounds, become one frame, `size` world units
 * square: the widest strike (CFG.items.book), which the game flattens to
 * lie on the ground. A pixel's darkness is its alpha, between `from`
 * (none) and `to` (full) as a share of black; its colour is `ink`, so the
 * frame is both the cut and the mask its light rises from.
 */
const SIGNS = {
  source: 'signs.png',
  output: 'signs',
  frames: ['sign-1', 'sign-2', 'sign-3', 'sign-4'],
  size: 110,
  from: 0.08,
  to: 0.63,
  /** Darkness above which a pixel counts as part of a line when trimming. */
  trim: 0.2,
  ink: [22, 15, 11],
};

/**
 * The skull beside the kill count, also a DOM image: the first of the three
 * emblems on its sheet, the others not shipped. 56 pixels holds the icon at
 * twice its CSS size, with room to grow it a little.
 */
const KILLS_ICON = {
  source: 'emblems.png',
  outputs: ['icon-skull.png', null, null],
  size: 56,
  cut: PLAIN_SHEET,
};

/**
 * Scenery cut out of the kurgan sheets and packed into one atlas, plus a
 * JSON file of frame rectangles in the format Phaser loads atlases from.
 * `take` maps a frame of the sheet, counted from 1 in reading order, to
 * its name in the atlas and its size in world units; frames not listed
 * are not shipped.
 */
const SCENERY = {
  output: 'scenery',
  sheets: [
    {
      source: 'kurgan-stones.png',
      take: {
        2: { name: 'tally-stone', height: 56 },
      },
    },
    {
      source: 'kurgan-props.png',
      take: {
        // The carving is temporary, to be replaced with a neutral sign.
        1: { name: 'sign-stone', height: 82 },
        3: { name: 'mound', width: 120 },
        4: { name: 'fire-pit', width: 74 },
        5: { name: 'bones', width: 46 },
        6: { name: 'grave-pole', height: 80 },
      },
    },
    {
      source: 'kurgan-puddles.png',
      take: {
        1: { name: 'puddle-round', width: 46 },
        2: { name: 'puddle-long', width: 80 },
        3: { name: 'puddle-double', width: 76 },
        4: { name: 'pool-reeds', width: 88 },
        5: { name: 'pool-bone', width: 92 },
        6: { name: 'pond', width: 190 },
      },
    },
  ],
};
/** Every sheet holds this many props. */
const SCENERY_SHEET_FRAMES = 6;
/** Width of the scenery atlas in pixels; rows are added as needed. */
const ATLAS_WIDTH = 1024;

/**
 * The repeating ground tile. The source is already seamless; it is resized
 * to `size` world units at GROUND_ART_SCALE and saved as JPEG, since an
 * opaque, noisy texture this large would take megabytes as PNG.
 */
const GROUND = { source: 'kurgan-ground.png', output: 'kurgan-ground.jpg', size: 512, quality: 85 };
/** Must match GROUND_ART_SCALE in src/art/scale.ts. */
const GROUND_ART_SCALE = 2;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'art/source');
const outputDir = join(root, 'src/art/sprites');

/** Bounds of the pixels whose alpha is above TRIM_ALPHA. */
function opaqueBounds(data, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= TRIM_ALPHA) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) throw new Error('image is fully transparent');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Straight RGBA pixels of a source image, with near-opaque alpha snapped to solid. */
async function loadSource(source) {
  const { data, info } = await sharp(join(sourceDir, source))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error(`${source}: expected RGBA, got ${info.channels} channels`);

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] >= SOLID_ALPHA) data[i] = 255;
  }
  return { data, width: info.width, height: info.height };
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: true, palette: false };

async function buildSprite(sprite) {
  if (sprite.sheet) return buildSheetStrip(sprite);
  const image = await loadSource(sprite.source);
  if (sprite.ripple) return buildRippleStrip(sprite, image);

  const { output, width, height } = sprite;
  const bounds = opaqueBounds(image.data, image.width, image.height);
  const resize = width
    ? { width: Math.round(width * ART_SCALE) }
    : { height: Math.round(height * ART_SCALE) };
  const file = join(outputDir, output);
  const result = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .extract(bounds)
    .resize({ ...resize, kernel: sharp.kernel.lanczos3 })
    .extend({ top: GUTTER, bottom: GUTTER, left: GUTTER, right: GUTTER, background: TRANSPARENT })
    .png(PNG_OPTIONS)
    .toFile(file);
  console.log(`${sprite.source} -> src/art/sprites/${output} ${result.width}x${result.height}`);
}

/**
 * Bakes the ripple into frames at source resolution, then trims all of them
 * to the union of their bounds, so the still head sits on the same pixel in
 * every frame. The scale comes from the unwarped figure, so it keeps the
 * size given in SPRITES however far the cloth swings.
 */
async function buildRippleStrip({ source, output, width, height, ripple }, image) {
  // One extra pixel each side for the bilinear footprint.
  const pad = rippleReach(ripple) + 1;
  const canvas = padImage(image, pad);
  const shifted = {
    ...ripple,
    head: [ripple.head[0] + pad, ripple.head[1] + pad],
    tail: [ripple.tail[0] + pad, ripple.tail[1] + pad],
  };
  const frames = [];
  for (let i = 0; i < ripple.frames; i++) {
    frames.push(warpRipple(canvas.data, canvas.width, canvas.height, i / ripple.frames, shifted));
  }

  const figure = opaqueBounds(canvas.data, canvas.width, canvas.height);
  const box = unionBounds(frames.map((frame) => opaqueBounds(frame, canvas.width, canvas.height)));
  const scale = width ? (width * ART_SCALE) / figure.width : (height * ART_SCALE) / figure.height;
  const size = { width: Math.round(box.width * scale), height: Math.round(box.height * scale) };
  const frameWidth = size.width + 2 * GUTTER;
  const frameHeight = size.height + 2 * GUTTER;

  const rendered = [];
  for (const frame of frames) {
    rendered.push(
      await sharp(frame, { raw: { width: canvas.width, height: canvas.height, channels: 4 } })
        .extract(box)
        .resize({ ...size, fit: 'fill', kernel: sharp.kernel.lanczos3 })
        .extend({ top: GUTTER, bottom: GUTTER, left: GUTTER, right: GUTTER, background: TRANSPARENT })
        .raw()
        .toBuffer(),
    );
  }
  await writeStrip(source, output, rendered, frameWidth, frameHeight);
}

/**
 * Cuts a sheet on a light backdrop into figures in reading order (see
 * scripts/cutout.mjs) and checks that it holds the expected number.
 */
async function cutSheet(source, { backdrop, edge, split }, count) {
  const { data, info } = await sharp(join(sourceDir, source)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = backdropMask(data, info.width, info.height, info.channels, backdrop);
  const rgba = cutOut(data, info.width, info.height, info.channels, mask, edge);
  const { labels, figures } = splitFigures(rgba, info.width, info.height, split);
  if (figures.length !== count) throw new Error(`${source}: expected ${count} figures, found ${figures.length}`);
  return { rgba, labels, figures, info };
}

/**
 * Cuts the poses out of a sheet (see scripts/cutout.mjs) and stacks them
 * pinned by the upper body, so the parts that do not move in the drawing
 * do not jitter in the game. All frames are trimmed to the union of their
 * bounds and scaled alike, so the tallest pose has the size given in
 * SPRITES.
 */
async function buildSheetStrip({ source, output, width, height, sheet }) {
  const { rgba, labels, figures, info } = await cutSheet(source, sheet, sheet.frames);

  const anchors = figures.map((figure) => upperBodyAnchor(labels, info.width, figure));
  const box = unionBounds(
    figures.map((f, i) => ({
      left: f.left - anchors[i].x,
      top: f.top - anchors[i].y,
      width: f.right - f.left,
      height: f.bottom - f.top,
    })),
  );
  const canvas = { width: box.width, height: box.height };
  const at = { x: -box.left, y: -box.top };
  const scale = width ? (width * ART_SCALE) / box.width : (height * ART_SCALE) / box.height;
  const size = { width: Math.round(box.width * scale), height: Math.round(box.height * scale) };
  const frameWidth = size.width + 2 * GUTTER;
  const frameHeight = size.height + 2 * GUTTER;

  const rendered = [];
  for (const [i, figure] of figures.entries()) {
    const frame = isolateFigure(rgba, labels, info.width, figure, anchors[i], canvas, at);
    rendered.push(
      await sharp(frame, { raw: { ...canvas, channels: 4 } })
        .resize({ ...size, fit: 'fill', kernel: sharp.kernel.lanczos3 })
        .extend({ top: GUTTER, bottom: GUTTER, left: GUTTER, right: GUTTER, background: TRANSPARENT })
        .raw()
        .toBuffer(),
    );
  }
  await writeStrip(source, output, rendered, frameWidth, frameHeight);
}

/** Writes raw RGBA frames as a horizontal strip and its JSON metadata. */
async function writeStrip(source, output, frames, frameWidth, frameHeight) {
  const strip = joinHorizontally(frames, frameWidth, frameHeight);
  await sharp(strip, { raw: { width: frameWidth * frames.length, height: frameHeight, channels: 4 } })
    .png(PNG_OPTIONS)
    .toFile(join(outputDir, output));

  const meta = output.replace(/\.png$/, '.json');
  const info = { frameWidth, frameHeight, frameCount: frames.length };
  await writeFile(join(outputDir, meta), `${JSON.stringify(info, null, 2)}\n`);
  console.log(
    `${source} -> src/art/sprites/${output} ${frames.length} frames of ${frameWidth}x${frameHeight}, src/art/sprites/${meta}`,
  );
}

/** The image centred on a transparent canvas `pad` pixels larger on every side. */
function padImage({ data, width, height }, pad) {
  const padded = { width: width + 2 * pad, height: height + 2 * pad };
  padded.data = Buffer.alloc(padded.width * padded.height * 4);
  for (let y = 0; y < height; y++) {
    data.copy(padded.data, ((y + pad) * padded.width + pad) * 4, y * width * 4, (y + 1) * width * 4);
  }
  return padded;
}

function unionBounds(list) {
  const left = Math.min(...list.map((b) => b.left));
  const top = Math.min(...list.map((b) => b.top));
  const right = Math.max(...list.map((b) => b.left + b.width));
  const bottom = Math.max(...list.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

/** Lays equally sized raw RGBA frames side by side, row by row. */
function joinHorizontally(frames, frameWidth, frameHeight) {
  const rowBytes = frameWidth * 4;
  const strip = Buffer.alloc(rowBytes * frames.length * frameHeight);
  for (let y = 0; y < frameHeight; y++) {
    frames.forEach((frame, i) => {
      frame.copy(strip, (y * frames.length + i) * rowBytes, y * rowBytes, (y + 1) * rowBytes);
    });
  }
  return strip;
}

/**
 * Cuts the taken props out of every scenery sheet, trims and scales each
 * on its own and packs them into one atlas. A frame's rectangle covers the
 * trimmed prop only; the transparent gutter around it keeps linear
 * filtering from bleeding in a neighbour.
 */
async function buildScenery({ output, sheets }) {
  const props = [];
  for (const { source, take } of sheets) props.push(...(await cutTaken(source, KURGAN_SHEET, SCENERY_SHEET_FRAMES, take)));

  await writeAtlas('scenery', output, props);
}

/** Cuts the taken figures out of a sheet of `frames` and packs them into an atlas, each at its own size. */
async function buildTakenAtlas({ source, output, frames, cut, take }) {
  await writeAtlas(source, output, await cutTaken(source, cut, frames, take));
}

/**
 * Cuts each quarter of the signs' sheet into a frame of its own (see SIGNS)
 * and packs them into an atlas.
 */
async function buildSigns({ source, output, frames, size, from, to, trim, ink }) {
  const { data, info } = await sharp(join(sourceDir, source)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const side = Math.round(size * ART_SCALE);
  const props = [];
  for (const [i, name] of frames.entries()) {
    const left = Math.floor((i * width) / frames.length);
    const right = Math.floor(((i + 1) * width) / frames.length);
    const quarter = { width: right - left, height };
    const darkness = Buffer.alloc(quarter.width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < quarter.width; x++) {
        const at = (y * width + left + x) * channels;
        const light = (0.299 * data[at] + 0.587 * data[at + 1] + 0.114 * data[at + 2]) / 255;
        darkness[y * quarter.width + x] = Math.round(255 * Math.min(1, Math.max(0, (1 - light - from) / (to - from))));
      }
    }
    const bounds = darkBounds(darkness, quarter.width, height, Math.round(255 * trim));
    const alpha = await sharp(darkness, { raw: { ...quarter, channels: 1 } })
      .extract(bounds)
      .resize({ width: side, height: side, fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .extractChannel(0)
      .raw()
      .toBuffer();
    const rgba = Buffer.alloc(side * side * 4);
    for (let p = 0; p < alpha.length; p++) rgba.set([...ink, alpha[p]], p * 4);
    props.push({ name, data: rgba, width: side, height: side });
  }
  await writeAtlas(source, output, props);
}

/** Bounds of the bytes of a one-channel image above `min`. */
function darkBounds(data, width, height, min) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] <= min) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error('no line found');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Packs raw RGBA images into an atlas and writes it with a JSON file of
 * frame rectangles in the format Phaser loads atlases from, plus the
 * frame's pivot for images that have one.
 */
async function writeAtlas(source, output, props) {
  const { width, height, placed } = packShelves(props, ATLAS_WIDTH, GUTTER);
  const atlas = Buffer.alloc(width * height * 4);
  for (const { prop, x, y } of placed) {
    for (let row = 0; row < prop.height; row++) {
      prop.data.copy(atlas, ((y + row) * width + x) * 4, row * prop.width * 4, (row + 1) * prop.width * 4);
    }
  }
  await sharp(atlas, { raw: { width, height, channels: 4 } })
    .png(PNG_OPTIONS)
    .toFile(join(outputDir, `${output}.png`));

  // Frames in the order of the build table, so the JSON reads like it.
  const frames = {};
  for (const prop of props) {
    const { x, y } = placed.find((p) => p.prop === prop);
    frames[prop.name] = { frame: { x, y, w: prop.width, h: prop.height } };
    if (prop.pivot) frames[prop.name].pivot = prop.pivot;
  }
  await writeFile(join(outputDir, `${output}.json`), `${JSON.stringify({ frames }, null, 2)}\n`);
  console.log(`${source} -> src/art/sprites/${output}.png ${width}x${height}, src/art/sprites/${output}.json`);
  for (const prop of props) {
    const pivot = prop.pivot ? ` pivot ${prop.pivot.x}, ${prop.pivot.y}` : '';
    console.log(`  ${prop.name} ${prop.width}x${prop.height}${pivot}`);
  }
}

/**
 * Packs poses cut out of a sheet (by cutFigures or cutCells) into an atlas,
 * each trimmed on its own. All poses share one scale, set by the tallest of
 * `sizedBy`, and each frame pivots on its ground point, as a fraction of
 * the frame.
 */
async function buildPoseAtlas({ source, output, frames, sizedBy, height }, figures) {
  const poses = figures.map(({ image, canvas, bounds }, i) => {
    const ground = groundPoint(image, canvas.width, canvas.height, TRIM_ALPHA);
    return { name: frames[i], image, canvas, bounds, ground };
  });

  const tallest = Math.max(...poses.filter((p) => sizedBy.includes(p.name)).map((p) => p.bounds.height));
  const scale = (height * ART_SCALE) / tallest;
  const props = [];
  for (const { name, image, canvas, bounds, ground } of poses) {
    const size = { width: Math.round(bounds.width * scale), height: Math.round(bounds.height * scale) };
    const data = await resizeFigure({ image, canvas, bounds }, size);
    const pivot = {
      x: round4((ground.x - bounds.left) / bounds.width),
      y: round4((ground.y - bounds.top) / bounds.height),
    };
    props.push({ name, data, ...size, pivot });
  }
  await writeAtlas(source, output, props);
}

/**
 * Cuts the figures out of a sheet, trims each on its own and packs them
 * into an atlas, all at one scale, set by the widest figure.
 */
async function buildFigureAtlas({ source, output, frames, width, cut }) {
  const figures = await cutFigures(source, cut, frames.length);
  const widest = Math.max(...figures.map((f) => f.bounds.width));
  const scale = (width * ART_SCALE) / widest;
  const props = [];
  for (const [i, figure] of figures.entries()) {
    const size = { width: Math.round(figure.bounds.width * scale), height: Math.round(figure.bounds.height * scale) };
    props.push({ name: frames[i], data: await resizeFigure(figure, size), ...size });
  }
  await writeAtlas(source, output, props);
}

/**
 * Cuts the figures out of a sheet and writes each as its own file, fitted
 * into a square of `size` pixels. `outputs` names a file for every figure
 * in reading order; a figure whose name is null is not shipped.
 */
async function buildPictures({ source, outputs, size, cut }) {
  const figures = await cutFigures(source, cut, outputs.length);
  for (const [i, figure] of figures.entries()) {
    if (!outputs[i]) continue;
    const fit = size / Math.max(figure.bounds.width, figure.bounds.height);
    const scaled = {
      width: Math.round(figure.bounds.width * fit),
      height: Math.round(figure.bounds.height * fit),
    };
    const file = join(outputDir, outputs[i]);
    const result = await sharp(await resizeFigure(figure, scaled), { raw: { ...scaled, channels: 4 } })
      .png(PNG_OPTIONS)
      .toFile(file);
    console.log(`${source} -> src/art/sprites/${outputs[i]} ${result.width}x${result.height}`);
  }
}

/** Every figure of a sheet as a raw RGBA image of its own, with the bounds of its opaque pixels. */
async function cutFigures(source, cut, count) {
  const { rgba, labels, figures, info } = await cutSheet(source, cut, count);
  return figures.map((figure) => {
    const canvas = { width: figure.right - figure.left, height: figure.bottom - figure.top };
    const corner = { x: figure.left, y: figure.top };
    const image = isolateFigure(rgba, labels, info.width, figure, corner, canvas, { x: 0, y: 0 });
    return { image, canvas, bounds: opaqueBounds(image, canvas.width, canvas.height) };
  });
}

/**
 * Every pose of a sheet of framed cells (see UTOPETS), in the reading
 * order of the cells, as a raw RGBA image of its own with the bounds of its
 * opaque pixels. Each cell is cut out on its own, as a sheet of one figure:
 * the backdrop and the frame round it are cleared, the cell's number goes
 * as a part without ink, the ground line is taken from under the pose, and
 * the loose drops of water left in the cell join the pose.
 */
async function cutCells(source, { frame, maxInk, groundLine, backdrop, edge, split }, count) {
  const { data, info } = await sharp(join(sourceDir, source)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cells = findCells(data, info.width, info.height, info.channels, frame);
  if (cells.length !== count) throw new Error(`${source}: expected ${count} cells, found ${cells.length}`);
  return cells.map((cell, i) => {
    const { width, height } = cell;
    const pixels = crop(data, info.width, info.channels, cell);
    const mask = backdropMask(pixels, width, height, info.channels, backdrop);
    const rgba = cutOut(pixels, width, height, info.channels, mask, edge);
    clearUninked(rgba, pixels, width, height, info.channels, maxInk);
    if (!removeGroundLine(rgba, width, height, groundLine)) throw new Error(`${source}: no ground line in cell ${i + 1}`);
    const { labels, figures } = splitFigures(rgba, width, height, split);
    if (figures.length !== 1) throw new Error(`${source}: expected one pose in cell ${i + 1}, found ${figures.length}`);
    const [figure] = figures;
    const canvas = { width: figure.right - figure.left, height: figure.bottom - figure.top };
    const corner = { x: figure.left, y: figure.top };
    const image = isolateFigure(rgba, labels, width, figure, corner, canvas, { x: 0, y: 0 });
    return { image, canvas, bounds: opaqueBounds(image, canvas.width, canvas.height) };
  });
}

/** A figure trimmed to its opaque bounds and resized to `size`, as raw RGBA. */
function resizeFigure({ image, canvas, bounds }, size) {
  return sharp(image, { raw: { ...canvas, channels: 4 } })
    .extract(bounds)
    .resize({ ...size, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

/**
 * The figures of a sheet of `frames` listed in `take` (see SCENERY), as raw
 * RGBA images at their game size.
 */
async function cutTaken(source, cut, frames, take) {
  const { rgba, labels, figures, info } = await cutSheet(source, cut, frames);

  const props = [];
  for (const [frame, { name, width, height }] of Object.entries(take)) {
    const figure = figures[frame - 1];
    const canvas = { width: figure.right - figure.left, height: figure.bottom - figure.top };
    const corner = { x: figure.left, y: figure.top };
    const image = isolateFigure(rgba, labels, info.width, figure, corner, canvas, { x: 0, y: 0 });
    const bounds = opaqueBounds(image, canvas.width, canvas.height);
    const resize = width ? { width: Math.round(width * ART_SCALE) } : { height: Math.round(height * ART_SCALE) };
    const { data: scaled, info: size } = await sharp(image, { raw: { ...canvas, channels: 4 } })
      .extract(bounds)
      .resize({ ...resize, kernel: sharp.kernel.lanczos3 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    props.push({ name, data: scaled, width: size.width, height: size.height });
  }
  return props;
}

/**
 * Shelf packing: the images, tallest first, are laid left to right in rows
 * of the given width, each with `gutter` pixels of clear space all round.
 * Returns the atlas size and the top-left corner of every image.
 */
function packShelves(images, width, gutter) {
  const order = [...images].sort((a, b) => b.height - a.height || a.name.localeCompare(b.name));
  const placed = [];
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const prop of order) {
    const cellWidth = prop.width + 2 * gutter;
    if (cellWidth > width) throw new Error(`${prop.name} is wider than the atlas`);
    if (x + cellWidth > width) {
      y += shelf;
      x = 0;
      shelf = 0;
    }
    placed.push({ prop, x: x + gutter, y: y + gutter });
    x += cellWidth;
    shelf = Math.max(shelf, prop.height + 2 * gutter);
  }
  return { width, height: y + shelf, placed };
}

/**
 * Resizes the seamless ground texture to the tile size without breaking
 * the seam. A resampling kernel reaches past the image edge, where it
 * would see clamped pixels instead of the far side of the tile, so the
 * source is first wrapped around itself by a margin that scales to a whole
 * number of output pixels, and the margin is cut off again afterwards.
 */
async function buildGround({ source, output, size, quality }) {
  const input = sharp(join(sourceDir, source));
  const { width, height } = await input.metadata();
  if (width !== height) throw new Error(`${source}: expected a square tile, got ${width}x${height}`);
  const tile = size * GROUND_ART_SCALE;

  // The smallest margin m with m * tile / width a whole number.
  const margin = width / gcd(width, tile);
  const scaledMargin = (margin * tile) / width;
  const scaled = tile + 2 * scaledMargin;
  const wrapped = await input
    .removeAlpha()
    .extend({ top: margin, bottom: margin, left: margin, right: margin, extendWith: 'repeat' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = await sharp(wrapped.data, { raw: wrapped.info })
    .resize({ width: scaled, height: scaled, kernel: sharp.kernel.lanczos3 })
    .extract({ left: scaledMargin, top: scaledMargin, width: tile, height: tile })
    .jpeg({ quality, mozjpeg: true })
    .toFile(join(outputDir, output));
  console.log(`${source} -> src/art/sprites/${output} ${result.width}x${result.height}`);
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

await mkdir(outputDir, { recursive: true });
for (const sprite of SPRITES) await buildSprite(sprite);
await buildGround(GROUND);
await buildScenery(SCENERY);
await buildPoseAtlas(UPYR, await cutFigures(UPYR.source, UPYR.cut, UPYR.frames.length));
await buildPoseAtlas(UTOPETS, await cutCells(UTOPETS.source, UTOPETS.cut, UTOPETS.frames.length));
await buildFigureAtlas(WOLF_TEETH);
await buildPictures(ITEM_PICTURES);
await buildPictures(RELIC_PICTURES);
await buildTakenAtlas(RELICS);
await buildSigns(SIGNS);
await buildPictures(KILLS_ICON);

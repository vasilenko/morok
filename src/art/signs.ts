/**
 * The look of the black book's signs, as pure logic: thin cuts in the
 * earth from which witch-light rises. textures.ts bakes the light this
 * returns into a texture; BlackBook.ts makes it live.
 *
 * Every lit point of a cut throws a thin ray straight up the screen,
 * fading towards its top. The rays stand in separate strands, columns a
 * unit or two wide with dark gaps between them, and each strand belongs to
 * one of `groups` groups that pulse out of step, each at its own rate, so
 * neighbouring strands never pulse together. Each group's rays are baked
 * apart, and the sign is drawn in a sprite per group, whose brightness
 * pulses; and in a sprite per band of rows of the sign, so whatever
 * stands among the cuts is covered by the rays of the cuts in front of it
 * and covers those of the cuts behind it.
 *
 * Arrays hold one value per pixel, row by row; sizes are in pixels of the
 * baked texture unless named in world units.
 */

/** A colour as linear RGB, each channel 0..1. */
export type Rgb = readonly [number, number, number];

export const SIGN_LIGHT = {
  /** Texture pixels per world unit: the rays are soft, so they need fewer than the art. */
  scale: 2,
  /** Width of a sign as drawn on the sheet, in world units; must match SIGNS.size in scripts/build-sprites.mjs. */
  size: 110,
  /** How tall a ray stands above its cut, in world units, on a sign that size. */
  reach: 44,
  /** How fast a ray fades towards its top: its light is (1 - height / reach) to this power. */
  falloff: 2.2,
  /** World units of cut, summed up a column, that light a ray to full. */
  full: 3.2,
  /** Bands of rows the sign is drawn in, from the back to the front. */
  bands: 4,
  /** Groups of strands that pulse apart. */
  groups: 4,
  /** A strand is this many pixels wide, at random... */
  strand: { min: 2, max: 4 },
  /** ...and this share of them are gaps. */
  gaps: 0.3,
  /** Brightness of a strand at its weakest, before its pulse: the strongest are 1. */
  weakest: 0.35,
  /** The cut's own glow: its core, and a soft halo of `radius` world units round it. */
  core: 0.9,
  halo: { radius: 3, strength: 0.6 },
  /** Pixels round the cut's glow, so the halo is not clipped. */
  margin: 8,
  /** The rays' pale navi green, and the paler colour of the cut's core. */
  green: [0.4, 1.0, 0.52] as Rgb,
  pale: [0.86, 1.0, 0.84] as Rgb,
  /** Pulses a second of a group of strands, at random between these. */
  rate: [1, 2.5] as [number, number],
  /** A strand's brightness at the bottom of its pulse, as a share of the top. */
  low: 0.35,
};

/** A sign's size when baked: width and height in pixels, flattened to lie on the ground. */
export function signPixels(flatten: number): { width: number; height: number } {
  const width = Math.round(SIGN_LIGHT.size * SIGN_LIGHT.scale);
  return { width, height: Math.round(width * flatten) };
}

/** The rows of band `band`: from `top` (inclusive) to `bottom` (exclusive). */
export function bandRows(band: number, height: number): { top: number; bottom: number } {
  const bands = SIGN_LIGHT.bands;
  return { top: Math.round((band * height) / bands), bottom: Math.round(((band + 1) * height) / bands) };
}

/** Pixels a ray reaches above its cut. */
export function reachPixels(): number {
  return Math.round(SIGN_LIGHT.reach * SIGN_LIGHT.scale);
}

/**
 * The strands of a sign `width` pixels wide, drawing with `random` (0..1,
 * uniform): for every column, how strong its strand is (0 in a gap; a
 * strand is brightest in its middle) and which group it pulses with. No
 * two strands in a row share a group.
 */
export function strands(width: number, random: () => number): { strength: Float32Array; group: Uint8Array } {
  const { strand, gaps, weakest, groups } = SIGN_LIGHT;
  const strength = new Float32Array(width);
  const group = new Uint8Array(width);
  let last = -1;
  for (let x = 0; x < width; ) {
    const span = Math.min(width - x, strand.min + Math.floor(random() * (strand.max - strand.min + 1)));
    const lit = random() >= gaps;
    const peak = weakest + (1 - weakest) * random();
    let g = Math.floor(random() * (groups - 1));
    if (g >= last && last >= 0) g++;
    for (let i = 0; i < span; i++) {
      strength[x + i] = lit ? peak * Math.sin((Math.PI * (i + 0.5)) / span) : 0;
      group[x + i] = g;
    }
    if (lit) last = g;
    x += span;
  }
  return { strength, group };
}

/**
 * The rays of band `band` and group `g` of a sign whose cuts are `mask`
 * (0..1, `width` by `height`): a frame as wide as the sign, from the
 * band's top less the rays' reach down to its bottom, of light 0..1. A
 * pixel gathers the cut below it in its column within reach, the nearer
 * the stronger, scaled by its strand; columns of other groups are dark.
 */
export function bakeRays(
  mask: Float32Array,
  width: number,
  height: number,
  band: number,
  g: number,
  lines: { strength: Float32Array; group: Uint8Array },
): Float32Array {
  const { top, bottom } = bandRows(band, height);
  const reach = reachPixels();
  const rows = bottom - top + reach;
  const out = new Float32Array(width * rows);
  const full = SIGN_LIGHT.full * SIGN_LIGHT.scale;
  const fall = Array.from({ length: reach }, (_, d) => (1 - d / reach) ** SIGN_LIGHT.falloff);
  for (let x = 0; x < width; x++) {
    const strength = lines.strength[x];
    if (lines.group[x] !== g || strength <= 0) continue;
    for (let row = 0; row < rows; row++) {
      // The row of the sign this frame row shows.
      const y = top - reach + row;
      let sum = 0;
      for (let d = 0; d < reach; d++) {
        const from = y + d;
        if (from < top) continue;
        if (from >= bottom) break;
        sum += mask[from * width + x] * fall[d];
      }
      out[row * width + x] = Math.min(1, sum / full) * strength;
    }
  }
  return out;
}

/**
 * The cut's own glow, `margin` pixels larger than the sign on every side:
 * a pale core where the cut is, in a soft green halo. RGB, 0..1, three
 * values per pixel.
 */
export function bakeGlow(mask: Float32Array, width: number, height: number): Float32Array {
  const { margin, core, halo, pale, green, scale } = SIGN_LIGHT;
  const w = width + 2 * margin;
  const h = height + 2 * margin;
  const padded = new Float32Array(w * h);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) padded[(y + margin) * w + x + margin] = mask[y * width + x];
  }
  const soft = blur(padded, w, h, halo.radius * scale);
  const out = new Float32Array(w * h * 3);
  for (let p = 0; p < w * h; p++) {
    for (let c = 0; c < 3; c++) {
      out[p * 3 + c] = Math.min(1, core * padded[p] * pale[c] + halo.strength * soft[p] * green[c]);
    }
  }
  return out;
}

/**
 * How bright a group of strands is at `time`, pulsing at `rate` a second
 * from `phase`: between SIGN_LIGHT.low and 1.
 */
export function pulse(time: number, rate: number, phase: number): number {
  const low = SIGN_LIGHT.low;
  return low + (1 - low) * (0.5 + 0.5 * Math.sin(2 * Math.PI * rate * time + phase));
}

/** A Gaussian blur of standard deviation `sigma` pixels, done as two passes. */
function blur(data: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const radius = Math.ceil(sigma * 2.5);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-(((i - radius) / sigma) ** 2) / 2));
  const total = kernel.reduce((a, b) => a + b, 0);
  const pass = (src: Float32Array, dx: number, dy: number) => {
    const out = new Float32Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = x + k * dx;
          const sy = y + k * dy;
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
          sum += src[sy * width + sx] * kernel[k + radius];
        }
        out[y * width + x] = sum / total;
      }
    }
    return out;
  };
  return pass(pass(data, 1, 0), 0, 1);
}

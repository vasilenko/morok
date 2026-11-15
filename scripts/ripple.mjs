/**
 * A travelling cloth wave baked into sprite frames.
 *
 * The figure is described by a straight body axis from head to tail tip.
 * Every point is located by its position `s` along that axis (0 at the head,
 * 1 at the tail tip) and is pushed sideways, perpendicular to the axis, by a
 * sine that travels from the body towards the tail. Because the push is
 * perpendicular and depends on `s` alone, it never changes a point's `s`, so
 * the warp is a pure shear that can be inverted exactly when sampling.
 */

const TAU = Math.PI * 2;

/**
 * @typedef {object} RippleConfig
 * @property {[number, number]} head Point on the head that stays still, in source pixels.
 * @property {[number, number]} tail Tip of the tail, in source pixels.
 * @property {number} rigidUntil Position along the axis where the cloth starts to move.
 * @property {number} looseFrom Position along the axis where the motion reaches full strength.
 * @property {number} amplitude Largest sideways push, as a fraction of the axis length.
 * @property {number} waves Wavelengths along the loose part, from rigidUntil to the tail tip.
 */

/** Head-to-tail unit direction, its perpendicular and the axis length. */
export function bodyAxis({ head, tail }) {
  const dx = tail[0] - head[0];
  const dy = tail[1] - head[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) throw new Error('ripple axis has zero length');
  const ux = dx / length;
  const uy = dy / length;
  return { length, ux, uy, nx: -uy, ny: ux };
}

/**
 * How free the cloth is at `s`: 0 up to rigidUntil, so head, face and arms
 * never move, then a smoothstep to 1 at looseFrom, so the ribbons and the hem
 * swing fully and the transition shows no crease.
 */
export function rippleWeight(s, { rigidUntil, looseFrom }) {
  if (s <= rigidUntil) return 0;
  if (s >= looseFrom) return 1;
  const t = (s - rigidUntil) / (looseFrom - rigidUntil);
  return t * t * (3 - 2 * t);
}

/**
 * Sideways push in source pixels at `s` for a loop `phase` in [0, 1). The
 * crest moves towards the tail as the phase grows, and phase 1 equals
 * phase 0, so frames sampled at i / N loop seamlessly.
 */
export function rippleOffset(s, phase, config) {
  const weight = rippleWeight(s, config);
  if (weight === 0) return 0;
  const { length } = bodyAxis(config);
  const loose = (s - config.rigidUntil) / (1 - config.rigidUntil);
  return config.amplitude * length * weight * Math.sin(TAU * (config.waves * loose - phase));
}

/** Largest push of any frame, in source pixels; the canvas is padded by this much. */
export function rippleReach(config) {
  return Math.ceil(config.amplitude * bodyAxis(config).length);
}

/**
 * Warps straight (non-premultiplied) RGBA pixels into a new buffer of the
 * same size. Sampling is bilinear on premultiplied colour, so the soft edge
 * of the figure blends with transparency instead of with black, and keeps no
 * dark or light fringe.
 */
export function warpRipple(data, width, height, phase, config) {
  const axis = bodyAxis(config);
  const [hx, hy] = config.head;
  const out = Buffer.alloc(width * height * 4);
  const pixel = [0, 0, 0, 0];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Sample at pixel centres; s is the same before and after the push.
      const px = x + 0.5 - hx;
      const py = y + 0.5 - hy;
      const s = (px * axis.ux + py * axis.uy) / axis.length;
      const push = rippleOffset(s, phase, config);
      const i = (y * width + x) * 4;
      if (push === 0) {
        data.copy(out, i, i, i + 4);
        continue;
      }
      samplePremultiplied(data, width, height, x - push * axis.nx, y - push * axis.ny, pixel);
      const alpha = pixel[3];
      if (alpha <= 0) continue;
      out[i] = Math.round(Math.min(255, pixel[0] / alpha));
      out[i + 1] = Math.round(Math.min(255, pixel[1] / alpha));
      out[i + 2] = Math.round(Math.min(255, pixel[2] / alpha));
      out[i + 3] = Math.round(alpha);
    }
  }
  return out;
}

/**
 * Bilinear sample at a pixel position, with transparency outside the image.
 * Writes premultiplied red, green and blue (scaled by alpha in 0..255) and
 * alpha into `out`.
 */
function samplePremultiplied(data, width, height, x, y, out) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  out[0] = out[1] = out[2] = out[3] = 0;
  for (let j = 0; j < 2; j++) {
    const sy = y0 + j;
    if (sy < 0 || sy >= height) continue;
    const wy = j ? fy : 1 - fy;
    for (let k = 0; k < 2; k++) {
      const sx = x0 + k;
      if (sx < 0 || sx >= width) continue;
      const w = wy * (k ? fx : 1 - fx);
      if (w === 0) continue;
      const i = (sy * width + sx) * 4;
      const a = data[i + 3] * w;
      out[0] += data[i] * a;
      out[1] += data[i + 1] * a;
      out[2] += data[i + 2] * a;
      out[3] += a;
    }
  }
}

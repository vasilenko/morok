import Phaser from 'phaser';
import { NIGHT } from './config';

const HEAT_KEY = 'fire-heat';
const BLOB_KEY = 'fire-heat-blob';
/** Side of the blob texture, in texture pixels. */
const BLOB_SIZE = 64;

/** Index of the renderer's additive blend mode for the heat map, made once per renderer. */
const sumBlends = new WeakMap<Phaser.Renderer.WebGL.WebGLRenderer, number>();

/** What the sparks stamp into the heat map, one call per fire. */
export interface FireStamp {
  /**
   * A fire's heat on the ground point (x, y), of grade `grade`, at
   * `strength` (0..1) of that grade's heat.
   */
  heat(x: number, y: number, grade: number, strength: number): void;
}

/**
 * The heat of the sparks' fires on the ground, for the night filter: a
 * low-resolution texture over the part of the world in view, into which
 * every fire stamps one soft blob, and the blobs add up. The filter thins
 * the fog by it and lays a faint light with it, so a lone small fire makes
 * a small hole while a field of them opens a clearing.
 *
 * Stamping costs one quad per fire into a texture of a few hundred texels
 * a side, all in one batch, however many fires there are; a uniform array
 * would cap the number of fires the filter can see.
 *
 * The map is laid on the world grid, `NIGHT.fire.cell` world units per
 * texel, with its corner snapped to the grid, so it does not swim as the
 * camera moves. It holds the heat itself in the red channel, and in the
 * blue the heat weighted by its grade's place from the lowest (0) to the
 * highest (1), so that blue over red is the mean grade of the heat there,
 * which tints its light; the 8-bit texture clips each at 1, above any
 * useful cap.
 */
export class FireHeat {
  /** World position of the map's top-left corner, and its size in world units. */
  x = 0;
  y = 0;
  width = 0;
  height = 0;

  private readonly texture: Phaser.Textures.DynamicTexture;
  private readonly blend: number;
  /** Whether the map holds anything, so an empty one is cleared only once. */
  private lit = true;

  constructor(scene: Phaser.Scene) {
    const textures = scene.textures;
    if (!textures.exists(BLOB_KEY)) textures.addCanvas(BLOB_KEY, blobCanvas());
    this.texture = textures.exists(HEAT_KEY)
      ? (textures.get(HEAT_KEY) as Phaser.Textures.DynamicTexture)
      : textures.addDynamicTexture(HEAT_KEY, 2, 2)!;
    this.blend = sumBlend(scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer);
  }

  /** The map's texture, for the filter to sample. */
  get glTexture(): Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null {
    return this.texture.getWebGLTexture() ?? null;
  }

  /**
   * Redraws the map over the view centred on (centreX, centreY), `viewWidth`
   * by `viewHeight` world units. `fires` is called with the stamps that
   * lay one fire's heat.
   */
  draw(
    centreX: number,
    centreY: number,
    viewWidth: number,
    viewHeight: number,
    fires: (stamp: FireStamp) => void,
  ): void {
    const fire = NIGHT.fire;
    const cell = fire.cell;
    // Room round the view for the camera's shake and the blobs that reach in.
    const margin = Math.max(...fire.radius) + 16;
    this.x = Math.floor((centreX - viewWidth / 2 - margin) / cell) * cell;
    this.y = Math.floor((centreY - viewHeight / 2 - margin) / cell) * cell;
    const columns = Math.ceil((viewWidth + 2 * margin) / cell) + 1;
    const rows = Math.ceil((viewHeight + 2 * margin) / cell) + 1;
    const texture = this.texture;
    if (texture.width < columns || texture.height < rows) texture.setSize(columns, rows);
    this.width = texture.width * cell;
    this.height = texture.height * cell;

    let stamped = 0;
    const blend = this.blend;
    const config = { tint: 0, scaleX: 0, scaleY: 0, blendMode: blend };
    // One soft blob of `radius` world units across round (x, y), its height
    // that divided by `squash`, its strength in the channels of `tint`.
    const blob = (x: number, y: number, radius: number, squash: number, tint: number) => {
      const u = (x - this.x) / cell;
      const v = (y - this.y) / cell;
      const r = radius / cell;
      const rv = r / squash;
      if (u < -r || v < -rv || u > texture.width + r || v > texture.height + rv) return;
      // The strength goes in through the tint, which scales the blob's grey.
      config.tint = tint;
      config.scaleX = (2 * r) / BLOB_SIZE;
      config.scaleY = config.scaleX / squash;
      texture.stamp(BLOB_KEY, undefined, u, v, config);
      stamped++;
    };
    const level = (value: number) => Math.round(Math.min(1, value) * 255);
    const highest = Math.max(1, fire.radius.length - 1);
    texture.clear();
    fires({
      heat: (x, y, grade, strength) => {
        const heat = fire.heat[grade] * strength;
        // The heat lies on the ground, squashed like the hero's pool of light.
        if (heat > 0) {
          const tint = Phaser.Display.Color.GetColor(level(heat), 0, level((heat * grade) / highest));
          blob(x, y, fire.radius[grade], NIGHT.lightSquash, tint);
        }
      },
    });
    // An empty map is cleared once and then left alone.
    if (stamped > 0 || this.lit) texture.render();
    this.lit = stamped > 0;
  }
}

/**
 * A round blob, white at the centre and black at the rim, opaque all over
 * so its grey is the heat whatever the alpha handling. The fall-off is
 * (1 - r²)², smooth at both ends, so neighbours sum to a smooth field.
 */
function blobCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = BLOB_SIZE;
  const g = canvas.getContext('2d')!;
  const image = g.createImageData(BLOB_SIZE, BLOB_SIZE);
  const half = BLOB_SIZE / 2;
  for (let j = 0; j < BLOB_SIZE; j++) {
    for (let i = 0; i < BLOB_SIZE; i++) {
      const r2 = ((i + 0.5 - half) ** 2 + (j + 0.5 - half) ** 2) / (half * half);
      const level = Math.round(255 * Math.max(0, 1 - r2) ** 2);
      const at = (j * BLOB_SIZE + i) * 4;
      image.data[at] = image.data[at + 1] = image.data[at + 2] = level;
      image.data[at + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

/** A blend mode that adds the source to what is there, unweighted: the blobs sum. */
function sumBlend(renderer: Phaser.Renderer.WebGL.WebGLRenderer): number {
  let index = sumBlends.get(renderer);
  if (index === undefined) {
    const gl = renderer.gl;
    renderer.addBlendMode([gl.ONE, gl.ONE], gl.FUNC_ADD);
    // addBlendMode's return value is off by one; the new mode is the last.
    index = renderer.blendModes.length - 1;
    sumBlends.set(renderer, index);
  }
  return index;
}

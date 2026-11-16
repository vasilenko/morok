import Phaser from 'phaser';

const MASK_KEY = 'coal-mask';

type Tinted = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Tint;

/**
 * Which pixels of the frame show a coal's own light, as the camera sees it,
 * for the night filter to keep those in their colour in the dark
 * (NIGHT.fire.aura).
 *
 * The filter works on the finished frame, where a coal's pixels cannot be
 * told from a pale creature drawn over it. So the scene is drawn a second
 * time into a texture the size of the frame, in the same depth order: the
 * coals, their wings and the sparks they shed in their own light, and
 * everything else as a black silhouette, so whatever stands in front of a
 * coal blots it out and whatever lies behind it is covered by it. What is
 * left is the coals' light where it is seen, to the pixel.
 *
 * The silhouettes are the objects' own sprites, tinted black for the
 * moment they are drawn, so the whole entity layer stays one batch; a blend
 * mode of their own would break it at every coal, which costs far more.
 */
export class CoalMask {
  /** World position of the mask's top-left corner, as of the last draw. */
  x = 0;
  y = 0;

  private readonly texture: Phaser.Textures.DynamicTexture;
  /** The entities drawn as silhouettes this frame, and their own tints, reused. */
  private readonly covers: Tinted[] = [];
  private readonly tints: number[] = [];

  constructor(scene: Phaser.Scene) {
    const textures = scene.textures;
    this.texture = textures.exists(MASK_KEY)
      ? (textures.get(MASK_KEY) as Phaser.Textures.DynamicTexture)
      : textures.addDynamicTexture(MASK_KEY, 2, 2)!;
  }

  /** The mask's texture, for the filter to sample. */
  get glTexture(): Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null {
    return this.texture.getWebGLTexture() ?? null;
  }

  /** Size of the mask in pixels, the size of the camera's frame. */
  get width(): number {
    return this.texture.width;
  }

  get height(): number {
    return this.texture.height;
  }

  /**
   * Redraws the mask as `camera` sees the scene, without its shake: first
   * `entities`, the depth-sorted layer the coals lie in among all that can
   * stand in front of them, where `glows` picks out the coals' own lights,
   * all of them tintable; then `lights`, drawn over those in their own
   * light; and last `over`, which covers everything.
   */
  draw(
    camera: Phaser.Cameras.Scene2D.Camera,
    entities: Phaser.GameObjects.Layer,
    glows: (object: Phaser.GameObjects.GameObject) => boolean,
    lights: Phaser.GameObjects.Layer,
    over: Phaser.GameObjects.Layer,
  ): void {
    const texture = this.texture;
    if (texture.width !== camera.width || texture.height !== camera.height) texture.setSize(camera.width, camera.height);
    texture.camera.setZoom(camera.zoom).setScroll(camera.scrollX, camera.scrollY);
    texture.camera.roundPixels = camera.roundPixels;

    const { covers, tints } = this;
    for (const child of entities.list) {
      if (!child.willRender(camera) || glows(child)) continue;
      const cover = child as Tinted;
      covers.push(cover);
      tints.push(cover.tintTopLeft, cover.tintTopRight, cover.tintBottomLeft, cover.tintBottomRight);
      cover.setTint(0);
    }

    texture.clear();
    // A layer draws its children in depth order, as the camera will.
    texture.draw(entities);
    texture.draw(lights);
    // Erased one by one: a layer would draw its children in their own blend
    // mode, not the erasing one.
    texture.erase(over.list.filter((child) => child.willRender(camera)));
    texture.render();

    covers.forEach((cover, i) => cover.setTint(tints[4 * i], tints[4 * i + 1], tints[4 * i + 2], tints[4 * i + 3]));
    covers.length = tints.length = 0;
    this.x = texture.camera.worldView.x;
    this.y = texture.camera.worldView.y;
  }
}

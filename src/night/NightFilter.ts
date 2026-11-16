import Phaser from 'phaser';
import { GRADE_COLORS } from '../art/coals';
import { DPR } from '../display';
import { beamTarget, easeAngle } from './beam';
import { NIGHT } from './config';
import { CoalMask } from './CoalMask';
import { FireHeat } from './FireHeat';
import { drainFlare, eyeFire, flameWaver, flareStrength } from './flame';
import fragmentSource from './night.frag?raw';

const NODE = 'FilterNight';
/** Lattice period of the fog noise, in cells; matches FOG_PERIOD in night.frag. */
const FOG_PERIOD = 256;
const DEGREES = Math.PI / 180;

/**
 * The night over a camera, as one filter pass. Holds what the game knows
 * (where the hero is, when he was last hit); the render node turns it into
 * uniforms every frame, so the picture stays alive while the scene is
 * paused.
 */
export class NightFilter extends Phaser.Filters.Controller {
  /** The hero's position in the world, where the light is centred. */
  focusX = 0;
  focusY = 0;
  /** The skull's burning eye in the world, where the beam starts. */
  eyeX = 0;
  eyeY = 0;
  /** Where the beam points on the ground plane, radians clockwise from right. */
  beamAngle = 0;
  /** Game time of the last hit, in seconds; the flash fades from it. */
  private hurtAt = -Infinity;
  /** Heat stored from the sparks drunk in, in worth, as of game time `heatAt`. */
  private heat = 0;
  private heatAt = 0;

  /** The heat of the sparks' fires, which thins the fog and lights the ground. */
  readonly fires: FireHeat;
  /** The coals' own light as seen, which keeps them in their colour in the dark. */
  readonly coals: CoalMask;

  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    super(camera, NODE);
    this.fires = new FireHeat(camera.scene);
    this.coals = new CoalMask(camera.scene);
  }

  /**
   * Swings the beam towards where the hero faces, tilted by his vertical
   * movement (-1..1, 0 when standing).
   */
  steer(facing: number, moveY: number, dt: number): void {
    const target = beamTarget(facing, moveY, NIGHT.beam.tilt * DEGREES);
    this.beamAngle = easeAngle(this.beamAngle, target, dt, NIGHT.beam.swing);
  }

  /** How far the lantern's fire is from its mean at this moment, -1..1. */
  get waver(): number {
    const flicker = NIGHT.beam.flicker;
    return flameWaver(this.now, flicker.speed, flicker.shiver);
  }

  /** Flashes the screen edges red. */
  flash(): void {
    this.hurtAt = this.now;
  }

  /** The skull drinks in sparks worth `worth`: the fire in its eye flares. */
  feed(worth: number): void {
    const now = this.now;
    this.heat = drainFlare(this.heat, now - this.heatAt, NIGHT.eye.flare.fade) + worth;
    this.heatAt = now;
  }

  /** Strength of the eye's flare at this moment, 0..1. */
  get flare(): number {
    const flare = NIGHT.eye.flare;
    return flareStrength(drainFlare(this.heat, this.now - this.heatAt, flare.fade), flare.knee);
  }

  /** Real seconds since the game started, running while the scene is paused. */
  get now(): number {
    return this.camera.scene.game.loop.time / 1000;
  }

  /** Strength of the hurt flash at this moment. */
  get hurt(): number {
    const since = this.now - this.hurtAt;
    // A clock that jumped back (a stepped loop in tests) must not flash.
    if (since < 0) return 0;
    return Math.max(0, NIGHT.hurt.peak - since * NIGHT.hurt.fade);
  }
}

class FilterNight extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super(NODE, manager, undefined, fragmentSource);
  }

  setupTextures(controller: Phaser.Filters.Controller, textures: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper[]): void {
    const night = controller as NightFilter;
    const heat = night.fires.glTexture;
    if (heat) textures[1] = heat;
    const coals = night.coals.glTexture;
    if (coals) textures[2] = coals;
  }

  setupUniforms(controller: Phaser.Filters.Controller, drawingContext: Phaser.Renderer.WebGL.DrawingContext): void {
    const night = controller as NightFilter;
    const camera = night.camera;
    const set = (name: string, value: number | number[]) => this.programManager.setUniform(name, value);
    const time = night.now;

    set('uResolution', [drawingContext.width, drawingContext.height]);
    set('uDpr', DPR);
    set('uZoom', camera.zoom);

    // The view matrix of a camera drawing to its own framebuffer; it
    // includes the shake, so the light shakes with the world it falls on.
    const view = camera.getViewMatrix(true);
    const focus = view.transformPoint(night.focusX, night.focusY);
    set('uFocus', [focus.x, focus.y]);
    set('uLightInner', NIGHT.lightInner);
    set('uLightOuter', NIGHT.lightOuter);
    set('uLightSquash', NIGHT.lightSquash);
    set('uAmbient', NIGHT.ambient);
    set('uWarm', NIGHT.warm);
    set('uCold', NIGHT.cold);
    set('uGlow', NIGHT.glow);
    set('uGlowHue', NIGHT.glowHue);

    const beam = NIGHT.beam;
    const eye = view.transformPoint(night.eyeX, night.eyeY);
    // The flame: the beam's brightness swings by `amount` and its reach
    // breathes with it; the fire in the socket follows the same waver.
    const waver = night.waver;
    const fire = 1 + beam.flicker.amount * waver;
    const breath = 1 + beam.flicker.breathe * waver;
    set('uEye', [eye.x, eye.y]);
    set('uBeamDir', [Math.cos(night.beamAngle), Math.sin(night.beamAngle)]);
    // The lobe's exponent, chosen so that it is at half strength halfAngle
    // off the axis.
    const half = Math.min(179, Math.max(1, beam.halfAngle)) * DEGREES;
    set('uBeamFocus', Math.log(0.5) / Math.log((1 + Math.cos(half)) / 2));
    set('uBeamReach', [beam.full * breath, beam.range * breath]);
    set('uBeamIntensity', beam.intensity * fire);
    set('uBeamColor', beam.color);

    const glow = eyeFire(NIGHT.eye, waver, night.flare);
    set('uEyeCore', NIGHT.eye.core);
    set('uEyeHalo', glow.halo);
    set('uEyeIntensity', glow.intensity);
    set('uEyeShade', glow.shade);
    set('uEyeCoreColor', NIGHT.eye.coreColor);
    set('uEyeHaloColor', glow.haloColor);

    // Wrapping the origin to the noise period keeps the shader's world
    // coordinates small, however far the hero walks.
    const fog = NIGHT.fog;
    const period = FOG_PERIOD * fog.cell;
    const shown = camera.worldView;
    set('uFogOrigin', [
      wrap(shown.x - fog.drift[0] * time, period),
      wrap(shown.y - fog.drift[1] * time, period),
    ]);
    set('uFogCell', fog.cell);
    set('uFogAlpha', fog.alpha);
    set('uFogColor', fog.color);
    set('uFogCoverage', fog.coverage);
    set('uFogSoftness', fog.softness);

    // The fires' heat map, placed by where the screen's corner lies on it,
    // with the same world view as the fog, so the clearings stay with it.
    const fires = night.fires;
    set('uHeat', 1);
    set('uHeatOrigin', [shown.x - fires.x, shown.y - fires.y]);
    set('uHeatSize', [fires.width || 1, fires.height || 1]);
    set('uHeatCap', NIGHT.fire.cap);
    set('uFireLight', NIGHT.fire.light);
    set('uFireColor', NIGHT.fire.color);
    set('uFireTint', NIGHT.fire.tint);
    GRADE_COLORS.forEach((color, grade) => set(`uGradeColor${grade}`, [...color]));
    // The coals' mask is drawn without the camera's shake, so its corner is
    // placed where the shaken view puts that point of the world.
    const coals = night.coals;
    const corner = view.transformPoint(coals.x, coals.y);
    set('uCoals', 2);
    set('uCoalOrigin', [corner.x, corner.y]);
    set('uCoalSize', [coals.width, coals.height]);
    const aura = NIGHT.fire.aura;
    set('uAuraLight', aura.light);
    set('uAuraFull', aura.full);
    set('uAuraFrom', aura.from);
    set('uAuraTo', aura.to);

    set('uGrain', NIGHT.grain.amount);
    set('uGrainSize', NIGHT.grain.size);

    const hatch = NIGHT.hatch;
    set('uHatch', hatch.amount);
    set('uHatchSpacing', hatch.spacing);
    set('uHatchStart', hatch.start);
    set('uHatchPatch', hatch.patch);

    set('uHurt', night.hurt);
    set('uHurtColor', NIGHT.hurt.color);
  }
}

function wrap(value: number, period: number): number {
  return ((value % period) + period) % period;
}

/**
 * Puts the night over the camera. The render node is registered on first use.
 *
 * It is an external filter: for a full-screen camera the result is the same
 * as an internal one, but the last external filter draws straight to the
 * screen, which saves a full-screen copy every frame.
 */
export function addNight(camera: Phaser.Cameras.Scene2D.Camera): NightFilter {
  const nodes = (camera.scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer).renderNodes;
  if (!nodes.hasNode(NODE)) nodes.addNodeConstructor(NODE, FilterNight);
  return camera.filters!.external.add(new NightFilter(camera)) as NightFilter;
}

/**
 * Tuning of the night filter: the light the hero carries, the colour of the
 * dark, the fog in it and the print texture over the frame. Distances are in
 * world units, screen-fixed sizes in CSS pixels, colours are linear RGB
 * multipliers. Mutable on purpose: the filter reads these every frame, so
 * they can be tuned live from the console in dev builds (`__morok.night`).
 */
export const NIGHT = {
  /** Brightness left in the dark, as a share of full light (0..1). */
  ambient: 0.16,
  /** Distance from the hero where his light starts to fade. */
  lightInner: 75,
  /** Distance from the hero where his light is gone. */
  lightOuter: 350,
  /**
   * The light is an ellipse, this much shorter than it is wide, so it
   * reads as a pool on the ground seen at an angle.
   */
  lightSquash: 1.15,
  /** Colour multiplier where the light falls. */
  warm: [1.1, 1.0, 0.86] as [number, number, number],
  /** Colour multiplier in the dark. */
  cold: [0.5, 0.72, 1.0] as [number, number, number],
  /** How much pale things keep glowing in the dark, so enemies stay readable. */
  glow: 0.55,
  /**
   * Share of their own hue that strongly coloured things keep in that glow
   * (0..1), instead of the cold; pale and dull things are untouched.
   */
  glowHue: 0.85,

  /**
   * The skull lantern on the staff: fire in its eye socket throws a soft
   * lobe of light along the ground ahead of the hero, strongest along his
   * facing and fading smoothly round to nothing behind him. It adds to his
   * own light, so everything the dark does (cold, glow, fog, strokes) thins
   * inside it.
   */
  beam: {
    /**
     * Brightness on the axis, as a share of full light (0..1). The flicker
     * swings it around this; anything above 1 is clipped to full light.
     */
    intensity: 0.88,
    /** Distance from the skull where the beam starts to fade. */
    full: 140,
    /** Distance from the skull where the beam is gone. */
    range: 420,
    /**
     * Angle off the axis, in degrees, where the beam has half its strength.
     * The fall-off is smooth all the way round, with no edge: at 40 about a
     * fifth of the strength remains 60 degrees off the axis, almost none
     * square to the side and none behind, so the light is thrown forward.
     */
    halfAngle: 40,
    /** Most the beam tilts towards the hero's vertical movement, in degrees. */
    tilt: 40,
    /** Time constant of the swing to a new direction, in seconds. */
    swing: 0.12,
    /** Colour multiplier where the beam falls; a little more orange than `warm`. */
    color: [1.2, 0.86, 0.55] as [number, number, number],
    /**
     * The fire in the skull flickers: irregular slow swells with a little
     * quick trembling on top, the same flame for the beam and the eye.
     */
    flicker: {
      /** How far the brightness swings either way, as a share of it (0..1). */
      amount: 0.18,
      /** How fast the flame moves; at 1 the slow swells turn two or three times a second. */
      speed: 1,
      /** Share of the swing that is quick trembling rather than slow swells (0..1). */
      shiver: 0.2,
      /** How far the beam's reach swings with it, as a share of the reach (0..1). */
      breathe: 0.07,
    },
  },

  /**
   * The fire seen in the skull's eye socket itself, drawn over everything.
   * It wavers with the same flame as the beam, but much harder, since it is
   * the one place the eye reads as fire; it is screened over the picture,
   * so even its brightest flare stays below white.
   */
  eye: {
    /** Radius of the hot core, in world units. */
    core: 0.9,
    /** Radius of the soft halo around it at rest, in world units. */
    halo: 5.5,
    /** Overall strength at rest; 1 brings the core to its full colour. */
    intensity: 1,
    coreColor: [0.8, 0.58, 0.26] as [number, number, number],
    /** Colour of the halo when the flame flares. */
    haloColor: [1.0, 0.45, 0.1] as [number, number, number],
    /** Colour of the halo when the flame sinks: a deeper, redder orange. */
    emberColor: [0.5, 0.12, 0.02] as [number, number, number],
    /** How far the eye's brightness swings either way, as a share of it (0..1). */
    flicker: 0.45,
    /** How far the halo's radius swings with it, as a share of the radius (0..1). */
    breathe: 0.2,
    /**
     * How much darker the bone round the socket gets as the flame sinks to
     * its lowest, as a share of its brightness (0..1); at the top of a flare
     * it is untouched. The skull is seen to be lit by the fire inside it.
     */
    shade: 0.6,
    /**
     * The fire flares when the skull drinks in a spark. Each spark adds its
     * worth to a store of heat that drains away exponentially; the flare's
     * strength (0..1) is that heat run through a saturating curve, so a
     * single spark flashes, a larger one harder, and a stream of them holds
     * a steady strong burn instead of strobing.
     */
    flare: {
      /** Seconds for the stored heat to drain to about a third. */
      fade: 0.18,
      /**
       * Stored heat, in spark worth, at which the flare reaches about two
       * thirds of its full strength; it nears full strength past three times
       * this. At 2.5, a spark worth 1 flares to a third, one worth 5 to
       * six sevenths, and a spark every other frame holds it near nine tenths.
       */
      knee: 2.5,
      /** What full flare adds to the fire's strength, as a share of its rest strength. */
      intensity: 1.6,
      /** What full flare adds to the halo's radius, as a share of its rest radius. */
      halo: 0.9,
    },
  },

  fog: {
    /** Opacity of the fog where it is thickest, in full dark. */
    alpha: 0.3,
    color: [0.42, 0.5, 0.55] as [number, number, number],
    /** Share of the plane the fog covers (0..1). */
    coverage: 0.36,
    /** Size of the largest fog blobs. */
    cell: 170,
    /** Width of the blobs' soft edge, in noise units (0..1). */
    softness: 0.11,
    /** Wind carrying the fog over the plane, world units per second. */
    drift: [7, -3] as [number, number],
  },

  /**
   * The sparks' coals drive the fog away round them and lay a faint light
   * on the ground. Each lying spark adds a soft round heat of its grade to
   * a heat map (see FireHeat); heats add up where they overlap, so a field
   * of coals clears more than one, up to `cap`. Per-grade lists are
   * indexed by grade (CFG.spark.grades).
   */
  fire: {
    /** Radius of a fire's heat on the ground, per grade, in world units. */
    radius: [60, 85, 120, 170] as number[],
    /** A fire's heat at its centre, per grade (0..1): the share of the fog it clears there on its own. */
    heat: [0.8, 0.9, 1, 1] as number[],
    /** Most of the fog that any number of fires together clear (0..1). */
    cap: 1,
    /**
     * Light the fires lay on the ground at full heat, as a share of full
     * light (0..1); 0 leaves the fires lighting nothing. It adds to the
     * hero's light and the beam like they add to each other.
     */
    light: 0.1,
    /** Colour multiplier where that light falls: a neutral warm... */
    color: [1.05, 0.96, 0.84] as [number, number, number],
    /** ...taken this share (0..1) of the way to the colour of the grades whose heat it is (GRADE_COLORS). */
    tint: 0.3,
    /**
     * The light each coal gives itself: a soft upright blob round the coal
     * and the tiny sparks rising from it, within which whatever is bright
     * keeps its own colour, as a light should, where the night would turn
     * a pale coal as cold and blue as the navii; the dark soil there is
     * left alone. It is at full strength over the inner half of its radii,
     * fades to nothing at the rim and goes with the coal when the spark is
     * drawn in.
     */
    aura: {
      /** Radius of the blob across, in world units. */
      radius: 9,
      /** How much taller than wide the blob is, to hold the sparks rising from the coal. */
      stretch: 2.2,
      /** Height of its centre above the coal's ground point, in world units. */
      rise: 10,
      /** Brightness at full strength, as a share of full light (0..1). */
      light: 1,
      /**
       * Brightest channel of a pixel (0..1) from which it starts to keep its
       * colour, and from which it keeps all of it: above the brightest soil,
       * below the coals' halos.
       */
      from: 0.32,
      to: 0.6,
    },
    /** Seconds a new spark's heat takes to grow in, and a gathered one's to die away. */
    fadeIn: 0.35,
    fadeOut: 0.6,
    /** World units per texel of the heat map; the heat is smooth, so it can be coarse. */
    cell: 4,
  },

  grain: {
    /** Strength of the paper grain over the whole frame (0..1). */
    amount: 0.035,
    /** Size of one grain, in CSS pixels. */
    size: 1.5,
  },

  /**
   * Woodcut-like strokes cut into the deepest dark, so the far field reads
   * as an engraved black instead of an empty one.
   */
  hatch: {
    /** Brightness of a stroke at full strength (0..1). */
    amount: 0.05,
    /** Distance between parallel strokes, in CSS pixels. */
    spacing: 5,
    /** How dark (0..1, 1 = no light at all) the frame must be before strokes appear. */
    start: 0.8,
    /** Size of the patches the strokes are broken into, in CSS pixels. */
    patch: 46,
  },

  /** The red flash at the screen edges when the hero is hit. */
  hurt: {
    /** Strength right after a hit (0..1). */
    peak: 0.6,
    /** How fast it fades, per second. */
    fade: 2.2,
    color: [0.7, 0.15, 0.17] as [number, number, number],
  },
};


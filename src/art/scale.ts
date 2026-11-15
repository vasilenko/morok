/**
 * How many texture pixels the art holds per world unit, kept apart from
 * the Phaser texture code so pure logic and its tests can size sprites.
 * Both must match the same constants in scripts/build-sprites.mjs.
 */

/** Textures hold this multiple of their world size so they stay sharp when zoomed. */
export const ART_SCALE = 3;
/** The ground tile is large, so it gets a smaller oversampling factor. */
export const GROUND_ART_SCALE = 2;

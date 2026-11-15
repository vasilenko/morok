/** Device pixel ratio the canvas renders at, capped to keep fill-rate sane. */
export const DPR = Math.min(window.devicePixelRatio || 1, 2);

/** Canvas backing-store size for the current window. */
export function canvasSize(): { width: number; height: number } {
  return {
    width: Math.round(window.innerWidth * DPR),
    height: Math.round(window.innerHeight * DPR),
  };
}

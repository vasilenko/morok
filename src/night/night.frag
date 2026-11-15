// The night over the game camera: the hero's light, the colour of the dark,
// fog, the red of hurt, and a print texture over it all.
// Runs once per pixel of the camera's framebuffer.
#pragma phaserTemplate(shaderName)

#ifdef GL_FRAGMENT_PRECISION_HIGH
// World coordinates for the fog need more than mediump.
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

// Framebuffer size in device pixels, and device pixels per CSS pixel.
uniform vec2 uResolution;
uniform float uDpr;
// Device pixels per world unit.
uniform float uZoom;

// The hero, in framebuffer pixels from the top-left corner.
uniform vec2 uFocus;
uniform float uLightInner;
uniform float uLightOuter;
uniform float uLightSquash;
uniform float uAmbient;
uniform vec3 uWarm;
uniform vec3 uCold;
uniform float uGlow;

// The skull lantern: its eye in framebuffer pixels, the beam's direction on
// the ground plane (unit, y down), the exponent of its angular fall-off, and
// the distances where it starts to fade and is gone.
uniform vec2 uEye;
uniform vec2 uBeamDir;
uniform float uBeamFocus;
uniform vec2 uBeamReach;
uniform float uBeamIntensity;
uniform vec3 uBeamColor;
// The fire seen in the eye socket: radii in world units, and colours.
uniform float uEyeCore;
uniform float uEyeHalo;
uniform float uEyeIntensity;
// How bright the skull's bone around the socket is in the fire's light now.
uniform float uEyeShade;
uniform vec3 uEyeCoreColor;
uniform vec3 uEyeHaloColor;

// World position of the framebuffer's top-left corner, wrapped to the
// fog's period and shifted by its drift.
uniform vec2 uFogOrigin;
uniform float uFogCell;
uniform float uFogAlpha;
uniform vec3 uFogColor;
uniform float uFogCoverage;
uniform float uFogSoftness;

uniform float uGrain;
uniform float uGrainSize;

uniform float uHatch;
uniform float uHatchSpacing;
uniform float uHatchStart;
uniform float uHatchPatch;

uniform float uHurt;
uniform vec3 uHurtColor;

// The fog's lattice repeats every this many cells, so its origin can be
// wrapped on the CPU and world coordinates stay small however far the hero
// walks. Must match FOG_PERIOD in NightFilter.ts.
const float FOG_PERIOD = 256.0;

float luma(vec3 c)
{
    return dot(c, vec3(0.299, 0.587, 0.114));
}

// Hash without sine (Dave Hoskins), stable for the small inputs used here.
float hash(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Value noise on a lattice that repeats every `period` cells.
float noise(vec2 p, float period)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(mod(i, period));
    float b = hash(mod(i + vec2(1.0, 0.0), period));
    float c = hash(mod(i + vec2(0.0, 1.0), period));
    float d = hash(mod(i + vec2(1.0, 1.0), period));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Three octaves; each doubles the frequency and the lattice period with it,
// so the sum still repeats every FOG_PERIOD base cells.
float fbm(vec2 p)
{
    // Warp the domain by a coarse noise first, so the blobs lose the square
    // look of the lattice. The warp repeats with the same period.
    p += 0.7 * vec2(noise(p * 0.5 + vec2(5.0, 1.0), FOG_PERIOD * 0.5),
                    noise(p * 0.5 + vec2(13.0, 29.0), FOG_PERIOD * 0.5));
    float sum = 0.5 * noise(p, FOG_PERIOD);
    sum += 0.3 * noise(p * 2.0 + vec2(17.0, 9.0), FOG_PERIOD * 2.0);
    sum += 0.2 * noise(p * 4.0 + vec2(41.0, 73.0), FOG_PERIOD * 4.0);
    return sum;
}

// Engraved strokes along `dir`, `spacing` CSS pixels apart. Each line is
// cut into dashes of random length and only some survive; every dash
// swells in the middle and tapers to a point, like a cut of the burin.
float strokes(vec2 css, vec2 dir, float spacing, float seed)
{
    float along = dot(css, vec2(-dir.y, dir.x));
    float across = dot(css, dir) / spacing + 0.15 * sin(along * 0.045 + seed);
    float line = floor(across);
    float dashLength = 10.0 + 22.0 * hash(vec2(line, seed));
    float dashPosition = along / dashLength + hash(vec2(seed, line));
    float keep = step(0.5, hash(vec2(line + seed, floor(dashPosition))));
    float t = fract(dashPosition);
    float width = 0.9 * keep * smoothstep(0.0, 0.3, t) * smoothstep(1.0, 0.6, t);
    float distance = abs(fract(across) - 0.5) * spacing;
    return 1.0 - smoothstep(0.4 * width, width + 0.001, distance);
}

void main ()
{
    // Pixel position, with y pointing down like the game's screen space
    // (the framebuffer texture has y = 0 at the bottom).
    vec2 pixel = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uResolution;
    vec2 css = pixel / uDpr;

    // Distance from the screen centre, 0 there and 1 at the corners.
    vec2 fromCentre = pixel - 0.5 * uResolution;
    float edge = length(fromCentre) / length(0.5 * uResolution);

    vec3 source = texture2D(uMainSampler, outTexCoord).rgb;
    float lum = luma(source);

    // The hero's light: full within lightInner world units, gone at
    // lightOuter. The ellipse is squashed vertically.
    vec2 toHero = (pixel - uFocus) / uZoom;
    toHero.y *= uLightSquash;
    float pool = 1.0 - smoothstep(uLightInner, uLightOuter, length(toHero));

    // The skull's beam: a soft lobe from the burning eye, laid on the ground
    // with the same squash as the pool. The cosine of a pixel's angle off the
    // axis, mapped to 1 ahead and 0 behind and raised to a power, fades it
    // smoothly round the hero with no edge anywhere.
    vec2 toEye = (pixel - uEye) / uZoom;
    toEye.y *= uLightSquash;
    float reach = length(toEye);
    float axis = dot(toEye, uBeamDir) / max(reach, 0.001);
    float lobe = pow(max(0.5 + 0.5 * axis, 0.0), uBeamFocus);
    // The flicker can lift the intensity above 1; light never goes past full.
    float beam = min(uBeamIntensity, 1.0) * lobe
        * (1.0 - smoothstep(uBeamReach.x, uBeamReach.y, reach));

    // Two lights add like light does: each lights a share of what the other
    // leaves dark, so the sum is never below either and never above 1.
    float light = 1.0 - (1.0 - pool) * (1.0 - beam);
    float dark = 1.0 - light;
    // The tint of the light, from the warm pool to the orange fire by how
    // much of it is the beam's.
    vec3 lit = mix(uWarm, uBeamColor, beam / max(pool + beam, 0.001));

    // Light and tint: warm where lit, cold in the dark, never fully black.
    vec3 color = source * (uAmbient + (1.0 - uAmbient) * light) * mix(uCold, lit, light);

    // Woodcut strokes in the deepest dark: faint pale dashes, gathered in
    // patches so they never form a regular screen.
    if (uHatch > 0.0)
    {
        float deep = smoothstep(uHatchStart, 1.0, dark);
        float patches = noise(css / uHatchPatch, 4096.0);
        float hatch = strokes(css, vec2(0.26, 0.966), uHatchSpacing, 3.0) * smoothstep(0.35, 0.65, patches);
        // A second direction crosses the first only in the thickest patches.
        hatch = max(hatch, strokes(css, vec2(0.77, -0.64), uHatchSpacing * 1.3, 11.0)
            * smoothstep(0.7, 0.9, patches) * deep);
        color += uHatch * deep * hatch * uCold;
    }

    // Pale things keep a glow in the dark: lum squared lifts the navii and
    // leaves the dark soil alone.
    color += lum * lum * dark * uGlow * uCold;

    // Fog in the dark, anchored to the world.
    vec2 world = uFogOrigin + pixel / uZoom;
    float fog = fbm(world / uFogCell);
    float threshold = 1.0 - uFogCoverage;
    fog = smoothstep(threshold - uFogSoftness, threshold + uFogSoftness, fog);
    color = mix(color, uFogColor, uFogAlpha * dark * fog);

    // The fire in the skull's eye, laid over everything the night did, so
    // it burns on top of the hero in either facing: a small hot core in a
    // short halo that falls off with the square of its fade. It is screened
    // rather than added, so its flares lift the picture towards white without
    // ever reaching it, and the flicker stays visible at its brightest.
    float fromSocket = length(pixel - uEye) / uZoom;
    float core = 1.0 - smoothstep(0.4 * uEyeCore, uEyeCore, fromSocket);
    float halo = 1.0 - smoothstep(0.0, uEyeHalo, fromSocket);
    // The bone round the socket is lit by the fire, so it darkens as the
    // flame sinks.
    color *= mix(1.0, uEyeShade, halo);
    vec3 fire = uEyeIntensity * (core * uEyeCoreColor + halo * halo * uEyeHaloColor);
    color += min(fire, 1.0) * max(1.0 - color, 0.0);

    // The hurt flash: red closing in from the edges.
    color = mix(color, uHurtColor, uHurt * 0.75 * clamp((edge - 0.3) / 0.7, 0.0, 1.0));

    // Paper grain, fixed to the screen; mostly multiplied, a little added
    // so it shows in the blacks too.
    float grain = hash(floor(css / uGrainSize)) - 0.5;
    color = color * (1.0 + 2.0 * uGrain * grain) + 0.3 * uGrain * grain;

    gl_FragColor = vec4(color, 1.0);
}

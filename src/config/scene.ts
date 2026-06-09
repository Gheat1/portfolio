import * as THREE from 'three';
import { GALLERY_ITEMS } from './sections';
import { SKILL_GROUPS } from '../data/portfolio';

/**
 * SCENE CHOREOGRAPHY  —  the single source of truth for the camera fly-through.
 *
 * The whole experience is driven by ONE scalar: `progress` ∈ [0, 1], produced by
 * GSAP ScrollTrigger from the scroll position. This file maps that scalar to:
 *
 *   1. CAMERA_KEYFRAMES — where the camera *is* and what it *looks at* at a given
 *      scroll percentage. The GSAP timeline tweens between these; `CameraRig`
 *      damps the real camera toward the tweened values each frame.
 *   2. GALLERY_WINDOWS  — per-CRT scroll windows: when the camera arrives/departs
 *      and the sub-window over which the on-screen terminal text scrolls.
 *   3. OVERLAY_TIMINGS  — the scroll window during which each HTML overlay panel
 *      is on screen (opacity 1). Outside the window it fades to 0.
 *   4. SKILLS_EXPLODE   — the scroll window over which the skills core scatters.
 *
 * Timeline budget (scroll fraction → scene):
 *   0.00–0.16  scene 1 — particle field / summary
 *   0.16–0.28  transition (descend toward the core)
 *   0.28–0.50  scene 2 — skills core orbit + explode
 *   0.50–0.60  transition (drop down the data shaft to the CRT corridor)
 *   0.62–0.96  scene 3 — dwell at each CRT monitor (text scrolls on-screen),
 *              quick hop to the next during the last ~28% of each slot
 *   0.96–1.00  finale — pull back to a wide shot of the strung-up corridor
 */

export type Vec3 = [number, number, number];

/**
 * Narrow-viewport flag, sampled once at module load (the keyframes below are
 * baked from it). Phones get a centred monitor framed from further back;
 * rotating across the 700px boundary mid-session needs a reload to re-frame,
 * which is an acceptable trade for keeping the keyframes static.
 */
const IS_NARROW = typeof window !== 'undefined' && window.innerWidth < 700;

/** Where each scene physically lives in world space. Move these and the camera follows. */
export const PARTICLES_ANCHOR: Vec3 = [0, 0, 0];
export const SKILLS_ANCHOR: Vec3 = [0, -34, 0];
export const GALLERY = {
  /** position of the first CRT monitor */
  anchor: [0, -68, 0] as Vec3,
  /** distance between adjacent monitors along +X */
  spacing: 9,
  /** how far in front of the monitors (along +Z) the camera trucks */
  cameraDolly: IS_NARROW ? 12.5 : 8,
};

/** World position of CRT monitor `i` (the camera dwells at these in order). */
export function galleryPosition(i: number): Vec3 {
  return [GALLERY.anchor[0] + i * GALLERY.spacing, GALLERY.anchor[1], GALLERY.anchor[2]];
}

/**
 * How far LEFT of the focused monitor the camera sits. The camera looks straight
 * ahead (−Z), so the CRT lands in the RIGHT half of the screen (undistorted),
 * leaving the left half as a clean column for the DOM title block. On narrow
 * viewports the monitor is centred instead (the title block becomes a bottom
 * sheet — see the 900px media query).
 */
export const GALLERY_SHIFT = IS_NARROW ? 0 : 1.6;

export interface CameraKeyframe {
  /** scroll progress at which the camera reaches this pose, 0..1 */
  at: number;
  position: Vec3;
  /** point the camera orients toward (this is how we author "rotation") */
  lookAt: Vec3;
  /** easing into this keyframe (GSAP ease string). Defaults to 'power1.inOut'. */
  ease?: string;
}

// ── the wire dive: skills core → inside the trunk cable → out of CRT-01 ─────
/**
 * Scroll markers for the tunnel ride. The camera swings to the cable mouth
 * (`approach`), rides the centerline (`enter → exitTube`), punches through the
 * glass under the warp flash (`exit`), and backs away to the dwell pose
 * (`settled`). WireTunnel.tsx renders the cable around this same curve.
 */
export const TUNNEL = {
  approach: 0.553,
  enter: 0.558,
  exitTube: 0.604,
  exit: 0.609,
  settled: 0.618,
  /** wall the camera flies inside — sized so chord-lerp + damping lag never clip it */
  innerRadius: 1.0,
  /** the visible cable jacket seen from outside */
  outerRadius: 1.08,
};

/** Full-screen flash window that covers the burst through the CRT glass. */
export const WARP_FLASH = { inStart: 0.5975, inEnd: 0.604, outStart: 0.6065, outEnd: 0.617 };

/**
 * The trunk cable's path: out from under the skills core, a couple of lazy
 * S-bends through the void, then a WIDE sweep behind CRT-01 that curls forward
 * into its housing and dead-ends just behind the glass. Slopes stay under ~60°
 * so `lookAt` never degenerates against the +Y up vector, and every bend keeps
 * its curvature radius comfortably above the tube radius — a sharper corner
 * here makes TubeGeometry fold into itself and bulge through the wall.
 * 'centripetal' parameterization is used for the same reason (cusp-proof).
 * The SAME curve drives the camera keyframes, the cable jacket, the tunnel
 * wall, and the packet traffic — they cannot drift.
 */
export const TUNNEL_CURVE = (() => {
  const m0 = galleryPosition(0);
  const y = m0[1] + 0.13; // screen-center height — the hook runs level here
  // The final approach is a TRUE quarter-circle (r = 2.5) in the horizontal
  // plane, sampled at 30° steps: swings the heading from +X to +Z, then a
  // dead-straight run bores into the housing. Hand-placed corners here kept
  // producing curvature tighter than the tube radius (= wall folds into the
  // pipe); an explicit arc pins the bend radius at 2.5 ≫ 1.08.
  const hookC = new THREE.Vector3(-2.5, y, -2.6); // arc center
  const hook = [-90, -60, -30, 0].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return new THREE.Vector3(hookC.x + 2.5 * Math.cos(a), y, hookC.z + 2.5 * Math.sin(a));
  });
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(2, -39, 2),
      new THREE.Vector3(6, -46, -1),
      new THREE.Vector3(1, -53, 2.5),
      new THREE.Vector3(-4, -59, 0),
      // a wide descending U-loop left of the corridor (a cable "service loop"):
      // it bleeds off the remaining height and reverses the heading so the
      // pipe enters the hook arc already pointing +X, dead level
      new THREE.Vector3(-8.5, -62.5, -1.0),
      new THREE.Vector3(-10.5, -65.0, -3.5),
      new THREE.Vector3(-8.8, -66.9, -5.6),
      new THREE.Vector3(-6.0, -67.6, -5.4),
      ...hook, // quarter-circle: heading +X → heading +Z
      new THREE.Vector3(m0[0], m0[1] + 0.12, 0.15), // straight run, dead-ends behind the glass
    ],
    false,
    'centripetal',
  );
})();

// ── scene-3 scroll span ──────────────────────────────────────────────────────
const GALLERY_SCROLL = { start: 0.62, end: 0.96 };
/** Fraction of each slot the camera HOLDS STILL in front of a monitor (reading time). */
const DWELL = 0.72;

export interface GalleryWindow {
  /** slot boundaries — each CRT owns [slotStart, slotEnd] of scroll */
  slotStart: number;
  slotEnd: number;
  /** camera parked in front of this CRT during [arrive, depart] */
  arrive: number;
  depart: number;
  /** the on-screen terminal text scrolls from top to bottom over [readStart, readEnd] */
  readStart: number;
  readEnd: number;
}

/** Per-CRT scroll windows. Shared by camera keyframes, overlay timings, and the
 *  in-screen text scroller so all three can never drift apart. */
export const GALLERY_WINDOWS: GalleryWindow[] = GALLERY_ITEMS.map((_, i) => {
  const span = GALLERY_SCROLL.end - GALLERY_SCROLL.start;
  const slot = span / GALLERY_ITEMS.length;
  const slotStart = GALLERY_SCROLL.start + i * slot;
  const arrive = slotStart;
  const depart = slotStart + slot * DWELL;
  return {
    slotStart: +slotStart.toFixed(4),
    slotEnd: +(slotStart + slot).toFixed(4),
    arrive: +arrive.toFixed(4),
    depart: +depart.toFixed(4),
    readStart: +(arrive + slot * 0.07).toFixed(4),
    readEnd: +(depart - slot * 0.04).toFixed(4),
  };
});

/**
 * The camera path. `at` MUST be ascending. The first entry's pose is also the
 * camera's initial pose.
 */
export const CAMERA_KEYFRAMES: CameraKeyframe[] = [
  // ── Scene 1: particle field / summary ───────────────────────────────────
  { at: 0.0, position: [0, 0, 16], lookAt: PARTICLES_ANCHOR, ease: 'none' },
  { at: 0.09, position: [0, 0.6, 9], lookAt: PARTICLES_ANCHOR },
  { at: 0.16, position: [2.2, 1.0, 7], lookAt: [0, 0, -2] },

  // ── Transition 1 → 2: descent ───────────────────────────────────────────
  { at: 0.28, position: [0, SKILLS_ANCHOR[1] + 1, 16], lookAt: SKILLS_ANCHOR, ease: 'power2.inOut' },

  // ── Scene 2: skills core (orbit while it explodes; held through all 4 categories) ──
  { at: 0.39, position: [12, SKILLS_ANCHOR[1] + 2, 11], lookAt: SKILLS_ANCHOR },
  { at: 0.54, position: [-10, SKILLS_ANCHOR[1] - 1, 12], lookAt: SKILLS_ANCHOR },

  // ── Transition 2 → 3: dive INTO the trunk cable, out through CRT-01 ─────
  ...tunnelKeyframes(),

  // ── Scene 3: dwell-and-hop past the CRT wall ─────────────────────────────
  ...galleryKeyframes(),

  // ── Finale: pull back and up — the whole strung-up corridor in one shot ──
  {
    at: 1.0,
    position: [
      galleryPosition(GALLERY_ITEMS.length - 1)[0] - GALLERY.spacing * 1.4,
      GALLERY.anchor[1] + 3.6,
      GALLERY.cameraDolly + 10,
    ],
    lookAt: [
      galleryPosition(GALLERY_ITEMS.length - 1)[0] - GALLERY.spacing * 2.6,
      GALLERY.anchor[1] - 1.2,
      -2,
    ],
    ease: 'power2.inOut',
  },
];

/**
 * The wire-dive camera path, sampled from TUNNEL_CURVE so the camera rides the
 * exact centerline of the rendered cable. The lookAt leads ~7% ahead along the
 * curve, which makes the camera bank naturally through the S-bends.
 */
function tunnelKeyframes(): CameraKeyframe[] {
  const out: CameraKeyframe[] = [];
  const P = (u: number) => TUNNEL_CURVE.getPointAt(u);
  const vec = (v: THREE.Vector3): Vec3 => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
  const camX0 = galleryPosition(0)[0] - GALLERY_SHIFT;

  // swing from the skills orbit down to the glowing cable mouth
  const mouthApproach = P(0).clone().addScaledVector(TUNNEL_CURVE.getTangentAt(0), -2.4);
  out.push({ at: TUNNEL.approach, position: vec(mouthApproach), lookAt: vec(P(0.06)), ease: 'power2.inOut' });

  // ride the centerline — sampled densely so the straight-line lerp between
  // keyframes never strays from the curve by more than ~0.25 world units
  // (a 7-sample version cut corners right through the wall on the S-bends);
  // extra-dense through the U-loop and hook arc in the back half
  const samples = [
    0.03, 0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.56, 0.62, 0.68, 0.74, 0.79, 0.84, 0.88, 0.92, 0.95, 0.98,
  ];
  samples.forEach((u, i) => {
    const at = TUNNEL.enter + ((TUNNEL.exitTube - TUNNEL.enter) * i) / (samples.length - 1);
    const ahead = u + 0.07;
    const look =
      ahead <= 1
        ? P(ahead)
        : P(1).clone().addScaledVector(TUNNEL_CURVE.getTangentAt(1), (ahead - 1) * 8);
    out.push({
      at: +at.toFixed(4),
      position: vec(P(u)),
      lookAt: vec(look),
      ease: i === 0 ? 'power2.in' : 'none',
    });
  });

  // burst out through the glass — the warp flash covers the 180° whip-pan
  out.push({
    at: TUNNEL.exit,
    position: [galleryPosition(0)[0], GALLERY.anchor[1] + 0.12, 2.4],
    lookAt: [camX0, GALLERY.anchor[1], -1],
    ease: 'none',
  });
  // back away from the now-glowing screen into the dwell pose
  out.push({
    at: TUNNEL.settled,
    position: [camX0, GALLERY.anchor[1], GALLERY.cameraDolly],
    lookAt: [camX0, GALLERY.anchor[1], -1],
    ease: 'power2.out',
  });
  return out;
}

/**
 * Two keyframes per CRT: arrive, then HOLD (identical pose) until depart. The
 * gap between one monitor's `depart` and the next one's `arrive` is the quick
 * sideways hop. Holding the camera still while the on-screen text scrolls is
 * what makes the terminal feeds actually readable.
 */
function galleryKeyframes(): CameraKeyframe[] {
  const out: CameraKeyframe[] = [];
  GALLERY_WINDOWS.forEach((w, i) => {
    const p = galleryPosition(i);
    const camX = p[0] - GALLERY_SHIFT; // sit left of the monitor, look straight ahead
    const position: Vec3 = [camX, p[1], GALLERY.cameraDolly];
    const lookAt: Vec3 = [camX, p[1], -1]; // straight −Z → CRT sits right-of-centre, undistorted
    out.push({ at: w.arrive, position, lookAt, ease: i === 0 ? 'power1.out' : 'power2.inOut' });
    out.push({ at: w.depart, position, lookAt, ease: 'none' }); // hold still — reading time
  });
  return out;
}

/**
 * Overlay visibility windows, keyed by overlay id (the `data-overlay` attribute).
 * `start`/`end` are the scroll fractions where the panel sits at full opacity;
 * the controller ramps it in/out over OVERLAY_RAMP on either side.
 *
 * A timing with `end > 0.999` is treated as "sticky": the controller skips the
 * fade-out so the panel survives to the very bottom of the page (the contact
 * card uses this).
 */
export const OVERLAY_RAMP = 0.012;

export interface OverlayTiming {
  start: number;
  end: number;
}

export const OVERLAY_TIMINGS: Record<string, OverlayTiming> = {
  summary: { start: 0.03, end: 0.15 },
  ...skillTimings(),
  ...galleryTimings(),
  contact: { start: 0.963, end: 1.05 }, // sticky — never fades back out
};

/** One abutting window per skill category → they reveal sequentially as you scroll. */
function skillTimings(): Record<string, OverlayTiming> {
  const start = 0.3;
  const end = 0.54;
  const n = SKILL_GROUPS.length;
  const slot = (end - start) / n;
  const out: Record<string, OverlayTiming> = {};
  SKILL_GROUPS.forEach((_, i) => {
    out[`skill-${i}`] = {
      start: +(start + i * slot).toFixed(4),
      end: +(start + (i + 1) * slot).toFixed(4),
    };
  });
  return out;
}

/**
 * Each CRT's DOM title block is visible while the camera dwells there and is
 * fully gone before the next monitor's window begins (86% of the slot), so
 * panels never overlap even though they share a screen position.
 */
function galleryTimings(): Record<string, OverlayTiming> {
  const out: Record<string, OverlayTiming> = {};
  GALLERY_ITEMS.forEach((item, i) => {
    const w = GALLERY_WINDOWS[i];
    out[item.id] = {
      start: +(w.slotStart + 0.002).toFixed(4),
      end: +(w.slotStart + (w.slotEnd - w.slotStart) * 0.86).toFixed(4),
    };
  });
  return out;
}

/** Scroll window over which the skills core scatters from intact (0) to fully exploded (1). */
export const SKILLS_EXPLODE = { start: 0.28, end: 0.5 };

import { CAMERA_KEYFRAMES } from '../config/scene';

/**
 * SHARED MUTABLE STATE  —  the bridge between two worlds that must not trigger
 * React re-renders on every scroll tick.
 *
 *   • GSAP (outside React, scrubbed by ScrollTrigger) WRITES to `rig` ~60×/sec.
 *   • The R3F render loop (`useFrame`, inside the canvas) READS `rig` each frame
 *     and applies it to the real camera / meshes, with damping.
 *
 * Keeping this as a plain module-level object (not React state, not a context)
 * is the key performance decision: scrolling mutates numbers only — it never
 * re-renders the component tree, so there is zero layout thrashing.
 */

const start = CAMERA_KEYFRAMES[0];

export const rig = {
  /** Target camera pose. GSAP tweens these between CAMERA_KEYFRAMES. */
  cam: {
    px: start.position[0],
    py: start.position[1],
    pz: start.position[2],
    lx: start.lookAt[0],
    ly: start.lookAt[1],
    lz: start.lookAt[2],
  },
  /** Skills core scatter amount, 0 (intact) → 1 (fully exploded). */
  skills: { explode: 0 },
  /** Raw scroll progress 0..1 — handy for debug HUD / conditional logic. */
  progress: 0,
};

export type Rig = typeof rig;

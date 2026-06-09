import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rig } from '../state/rig';

/**
 * The ONE place the real camera is moved. Every frame it damps the camera toward
 * the GSAP-tweened target in `rig.cam`, adds a little pointer parallax, and aims
 * the camera at the (also damped) lookAt point.
 *
 * ── The interpolation math ────────────────────────────────────────────────
 * GSAP already gives us a scroll-mapped target (rig.cam). We *additionally* damp
 * toward it with frame-rate-independent exponential smoothing:
 *
 *     value += (target − value) · (1 − e^(−λ·dt))
 *
 * `THREE.MathUtils.damp(value, target, λ, dt)` is exactly that. Larger λ = snappier
 * follow; smaller λ = floatier. Because the decay uses dt, the motion is identical
 * at 30fps or 144fps. This second smoothing pass is what makes fast scroll flings
 * feel fluid instead of teleporting.
 */

const PARALLAX = 0.3; // world units of camera drift at full pointer deflection (kept gentle so on-screen CRT text stays readable)
const POS_LAMBDA = 7; // camera position follow speed
const LOOK_LAMBDA = 8; // aim follow speed

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  // Persisted, damped lookAt target (kept across frames).
  const look = useRef(new THREE.Vector3(rig.cam.lx, rig.cam.ly, rig.cam.lz));

  useFrame((state, delta) => {
    // Clamp dt so returning to a backgrounded tab doesn't fling the camera.
    const dt = Math.min(delta, 1 / 30);

    // pointer is normalized to [-1, 1]; parallax nudges the eye, not the target.
    const px = state.pointer.x * PARALLAX;
    const py = state.pointer.y * PARALLAX;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, rig.cam.px + px, POS_LAMBDA, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, rig.cam.py + py, POS_LAMBDA, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, rig.cam.pz, POS_LAMBDA, dt);

    look.current.x = THREE.MathUtils.damp(look.current.x, rig.cam.lx, LOOK_LAMBDA, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, rig.cam.ly, LOOK_LAMBDA, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, rig.cam.lz, LOOK_LAMBDA, dt);

    camera.lookAt(look.current);
  });

  return null;
}

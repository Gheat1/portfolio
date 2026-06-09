import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rig } from '../state/rig';
import { TUNNEL } from '../config/scene';

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
 *
 * ── The wire-dive exception ───────────────────────────────────────────────
 * Inside the tunnel the camera must stay within a ~1-unit pipe. Loose damping
 * cuts corners on the S-bends and pointer parallax shoves the eye through the
 * wall, so across the dive window we blend to a "locked" profile: ~10× less
 * parallax and a much snappier λ. The blend factor is itself damped so the
 * hand-off never pops.
 */

const PARALLAX = 0.3; // world units of camera drift at full pointer deflection
const POS_LAMBDA = 7; // camera position follow speed
const LOOK_LAMBDA = 8; // aim follow speed
const TUNNEL_POS_LAMBDA = 16; // locked-to-the-rails follow inside the wire
const TUNNEL_LOOK_LAMBDA = 18;
const TUNNEL_PARALLAX_SCALE = 0.08;

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  // Persisted, damped lookAt target (kept across frames).
  const look = useRef(new THREE.Vector3(rig.cam.lx, rig.cam.ly, rig.cam.lz));
  // 0 = free-flight profile, 1 = locked tunnel profile.
  const lock = useRef(0);

  useFrame((state, delta) => {
    // Clamp dt so returning to a backgrounded tab doesn't fling the camera.
    const dt = Math.min(delta, 1 / 30);

    // Are we riding the wire? (small lead-in before `approach` so the lock is
    // engaged by the time the camera threads the mouth)
    const p = rig.progress;
    const inTunnel = p > TUNNEL.approach - 0.006 && p < TUNNEL.settled ? 1 : 0;
    lock.current = THREE.MathUtils.damp(lock.current, inTunnel, 10, dt);

    const posLambda = THREE.MathUtils.lerp(POS_LAMBDA, TUNNEL_POS_LAMBDA, lock.current);
    const lookLambda = THREE.MathUtils.lerp(LOOK_LAMBDA, TUNNEL_LOOK_LAMBDA, lock.current);
    const parallax = PARALLAX * THREE.MathUtils.lerp(1, TUNNEL_PARALLAX_SCALE, lock.current);

    // pointer is normalized to [-1, 1]; parallax nudges the eye, not the target.
    const px = state.pointer.x * parallax;
    const py = state.pointer.y * parallax;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, rig.cam.px + px, posLambda, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, rig.cam.py + py, posLambda, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, rig.cam.pz, posLambda, dt);

    look.current.x = THREE.MathUtils.damp(look.current.x, rig.cam.lx, lookLambda, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, rig.cam.ly, lookLambda, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, rig.cam.lz, lookLambda, dt);

    camera.lookAt(look.current);
  });

  return null;
}

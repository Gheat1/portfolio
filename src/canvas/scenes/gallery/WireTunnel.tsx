import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TUNNEL, TUNNEL_CURVE, galleryPosition } from '../../../config/scene';
import { rig } from '../../../state/rig';
import { makeCableMaterial, makeTunnelInteriorMaterial } from './CrtScreenMaterial';

/**
 * THE WIRE DIVE. One fat trunk cable runs from under the skills core down into
 * the back of CRT-01 — and the scene-2 → scene-3 transition flies the camera
 * straight through the inside of it.
 *
 *   • EXTERIOR — a chunky cable jacket (always visible) with fast pulses, so
 *     from outside you can literally see the wire that feeds the CRT wall.
 *   • INTERIOR — a BackSide tube around the same curve: rushing energy rings +
 *     dashed packet lanes whose speed is coupled to scroll (uRush), plus a hot
 *     glow at the far end (the glass you're about to burst through). Feathered
 *     in/out around the dive window.
 *   • MOUTH — concentric glowing intake rings at the entrance, teasing the
 *     dive from the skills orbit.
 *   • PACKETS — bright elongated tracers flying down the pipe alongside (and
 *     past) the camera. Bloom turns them into light streaks.
 *
 * Camera keyframes sample the SAME curve (scene.ts → tunnelKeyframes), so the
 * camera is always on the centerline of what's rendered here.
 */

const PACKET_COUNT = 16;

interface PacketDef {
  phase: number;
  speed: number;
  radius: number;
  angle: number;
  len: number;
}

const packetGeo = new THREE.BoxGeometry(0.09, 0.09, 1);
const UP = new THREE.Vector3(0, 1, 0);

// scratch vectors for the per-frame packet math (no allocations in the loop)
const vPos = new THREE.Vector3();
const vTan = new THREE.Vector3();
const vSide = new THREE.Vector3();
const vUp2 = new THREE.Vector3();
const vLook = new THREE.Vector3();

export default function WireTunnel() {
  const interiorRef = useRef<THREE.Mesh>(null);
  const packetsRef = useRef<THREE.Group>(null);

  const { exteriorGeo, interiorGeo, exteriorMat, interiorMat, mouthRings, packets, packetMats } =
    useMemo(() => {
      const len = TUNNEL_CURVE.getLength();
      const exteriorGeo = new THREE.TubeGeometry(TUNNEL_CURVE, 180, TUNNEL.outerRadius, 18, false);
      const interiorGeo = new THREE.TubeGeometry(TUNNEL_CURVE, 180, TUNNEL.innerRadius, 18, false);

      const exteriorMat = makeCableMaterial({
        base: new THREE.Color('#0b1016'),
        pulse: new THREE.Color('#7dffe2'),
        speed: 0.55, // core → CRT wall: data feeding the projects, fast
        phase: 0.13,
        length: len,
      });
      const interiorMat = makeTunnelInteriorMaterial();

      // intake rings at the mouth, aligned to the curve tangent
      const mouthRings = [0, 0.014, 0.034].map((u, i) => {
        const p = TUNNEL_CURVE.getPointAt(u);
        const t = TUNNEL_CURVE.getTangentAt(u);
        const m = new THREE.Matrix4().lookAt(p, p.clone().add(t), UP);
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        return {
          position: p,
          quaternion: q,
          radius: TUNNEL.outerRadius + 0.22 + i * 0.16,
          opacity: 0.85 - i * 0.25,
        };
      });

      const rng = mulberry(2026);
      const packets: PacketDef[] = Array.from({ length: PACKET_COUNT }, () => ({
        phase: rng(),
        speed: 0.22 + rng() * 0.3, // full pipe in ~2–4.5s
        radius: 0.25 + rng() * 0.55,
        angle: rng() * Math.PI * 2,
        len: 0.6 + rng() * 1.0,
      }));
      const packetMats = packets.map((_, i) => {
        const pick = i / PACKET_COUNT;
        const color = pick > 0.92 ? '#ff5d82' : pick > 0.55 ? '#5ed2ff' : '#7dffe2';
        return new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
      });

      return { exteriorGeo, interiorGeo, exteriorMat, interiorMat, mouthRings, packets, packetMats };
    }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = rig.progress;
    exteriorMat.uniforms.uTime.value = t;

    // the ride window, with feathering margins on both sides
    const inWindow = p > 0.544 && p < 0.627;
    if (interiorRef.current) interiorRef.current.visible = inWindow;
    if (packetsRef.current) packetsRef.current.visible = inWindow;
    if (!inWindow) return;

    const fadeIn = THREE.MathUtils.smoothstep(p, 0.546, 0.556);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(p, 0.61, 0.622);
    interiorMat.uniforms.uFade.value = Math.min(fadeIn, fadeOut);
    interiorMat.uniforms.uTime.value = t;
    // scroll-coupled rush: progress through the pipe drives the wall pattern,
    // so flick-scrolling visibly slams the data past you
    interiorMat.uniforms.uRush.value = THREE.MathUtils.clamp(
      (p - TUNNEL.enter) / (TUNNEL.exitTube - TUNNEL.enter),
      -0.2,
      1.2,
    );

    // packet traffic: tracers flying core → CRT, looping
    const group = packetsRef.current;
    if (group) {
      for (let i = 0; i < packets.length; i++) {
        const d = packets[i];
        const m = group.children[i] as THREE.Mesh | undefined;
        if (!m) continue;
        const u = (t * d.speed + d.phase) % 1;

        TUNNEL_CURVE.getPointAt(u, vPos);
        TUNNEL_CURVE.getTangentAt(u, vTan);
        // radial offset in the local cross-section frame
        vSide.crossVectors(vTan, UP).normalize();
        vUp2.crossVectors(vSide, vTan).normalize();
        vPos.addScaledVector(vSide, Math.cos(d.angle) * d.radius);
        vPos.addScaledVector(vUp2, Math.sin(d.angle) * d.radius);

        m.position.copy(vPos);
        vLook.copy(vPos).addScaledVector(vTan, 1);
        m.lookAt(vLook);
        m.scale.set(1, 1, d.len);
      }
    }
  });

  return (
    <group>
      {/* the trunk cable, seen from outside — core to CRT-01 */}
      <mesh geometry={exteriorGeo} material={exteriorMat} />

      {/* the ride: inside wall (BackSide), only alive around the dive */}
      <mesh ref={interiorRef} geometry={interiorGeo} material={interiorMat} visible={false} />

      {/* glowing intake rings at the mouth */}
      {mouthRings.map((r, i) => (
        <mesh key={i} position={r.position} quaternion={r.quaternion}>
          <torusGeometry args={[r.radius, 0.035, 8, 48]} />
          <meshBasicMaterial
            color="#54ffd9"
            transparent
            opacity={r.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* packet tracers */}
      <group ref={packetsRef} visible={false}>
        {packets.map((_, i) => (
          <mesh key={i} geometry={packetGeo} material={packetMats[i]} />
        ))}
      </group>

      <PortIris />
    </group>
  );
}

/**
 * Two glowing discs sealing the pipe where it bores into CRT-01's housing.
 * From inside the wire they ARE the light at the end of the tunnel — and they
 * matter structurally: they occlude the monitor's dark tube-back/bezel boxes,
 * which the pipe passes straight through. Without them you'd see the housing's
 * unlit exterior crossing the tunnel ahead of the warp flash (the "buggy" dark
 * mass). Flying through each disc is a frame of pure brightness, blending into
 * the flash. Double-sided so the reverse (scroll-up) ride is covered too.
 */
function PortIris() {
  const m0 = galleryPosition(0);
  return (
    <group>
      {/* just outside the tube-back housing — hides the whole box from the pipe */}
      <mesh position={[m0[0], m0[1] + 0.13, -2.0]}>
        <circleGeometry args={[0.99, 40]} />
        <meshBasicMaterial color="#cefff2" side={THREE.DoubleSide} />
      </mesh>
      {/* inside the housing, ahead of the bezel — hides the bezel interior */}
      <mesh position={[m0[0], m0[1] + 0.12, -0.5]}>
        <circleGeometry args={[0.99, 40]} />
        <meshBasicMaterial color="#e6fff8" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** tiny deterministic PRNG so the traffic pattern is identical every load */
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

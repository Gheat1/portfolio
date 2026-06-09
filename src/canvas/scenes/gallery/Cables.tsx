import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GALLERY, galleryPosition } from '../../../config/scene';
import { GALLERY_ITEMS } from '../../../config/sections';
import { makeCableMaterial } from './CrtScreenMaterial';
import { BEZEL_W, BEZEL_H } from './CrtMonitor';

/**
 * The wiring loom that strings the CRT wall together. Four cable families:
 *
 *   • LINKS  — fat sagging bundles between adjacent monitors (side ports)
 *   • RISERS — one drop per monitor down to the trunk bus on the floor
 *   • TRUNK  — two long backbone runs below the corridor, fast traffic
 *   • HANGS  — thin wires from the monitor tops up into the darkness, so the
 *              whole wall reads as *suspended* by its own cabling
 *
 * Every cable is a TubeGeometry along a cubic bézier with catenary-ish droop,
 * and every jacket runs the pulse shader from CrtScreenMaterial — bright
 * packets forever streaming through the loom. Endpoints are buried ~0.1 units
 * inside the bezels so the monitors' idle sway never exposes a joint.
 */

const TRUNK_Y = GALLERY.anchor[1] - 3.4;
const TRUNK_Z = -0.7;

const TEAL = new THREE.Color('#0c2d27');
const BLUE = new THREE.Color('#0c2030');
const DARK = new THREE.Color('#0a0e12');
const PULSE_TEAL = new THREE.Color('#7dffe2');
const PULSE_BLUE = new THREE.Color('#5ed2ff');
const PULSE_WARN = new THREE.Color('#ff5d82');

interface CableDef {
  curve: THREE.Curve<THREE.Vector3>;
  radius: number;
  base: THREE.Color;
  pulse: THREE.Color;
  speed: number;
  phase: number;
  length: number;
}

function droop(a: THREE.Vector3, b: THREE.Vector3, sag: number, zJitter: number): THREE.CubicBezierCurve3 {
  const dir = Math.sign(b.x - a.x) || 1;
  const c1 = a.clone().add(new THREE.Vector3(dir * 0.9, -sag * 0.9, zJitter));
  const c2 = b.clone().add(new THREE.Vector3(-dir * 0.9, -sag * 0.9, zJitter));
  return new THREE.CubicBezierCurve3(a, c1, c2, b);
}

function vertical(a: THREE.Vector3, b: THREE.Vector3, bow: number): THREE.CubicBezierCurve3 {
  const c1 = a.clone().add(new THREE.Vector3(bow * 0.4, (b.y - a.y) * 0.35, bow));
  const c2 = b.clone().add(new THREE.Vector3(-bow * 0.4, (a.y - b.y) * 0.35, bow));
  return new THREE.CubicBezierCurve3(a, c1, c2, b);
}

export default function Cables() {
  const junctions = useRef<THREE.Mesh[]>([]);

  const { cables, junctionPts } = useMemo(() => {
    const defs: CableDef[] = [];
    const junctionPts: THREE.Vector3[] = [];
    const n = GALLERY_ITEMS.length;
    const rng = mulberry(1337);

    const sidePortR = (i: number) => {
      const p = galleryPosition(i);
      return new THREE.Vector3(p[0] + BEZEL_W / 2 - 0.1, p[1] - 1.05, -0.05);
    };
    const sidePortL = (i: number) => {
      const p = galleryPosition(i);
      return new THREE.Vector3(p[0] - BEZEL_W / 2 + 0.1, p[1] - 1.05, -0.05);
    };

    // ── LINKS: 3 sagging wires per gap ──
    for (let i = 0; i < n - 1; i++) {
      const a = sidePortR(i);
      const b = sidePortL(i + 1);
      const variants = [
        { sag: 1.0 + rng() * 0.4, z: -0.12, r: 0.034, base: TEAL, pulse: PULSE_TEAL, sp: 0.16 + rng() * 0.08 },
        { sag: 1.6 + rng() * 0.5, z: 0.28, r: 0.026, base: BLUE, pulse: PULSE_BLUE, sp: -(0.1 + rng() * 0.07) },
        { sag: 2.2 + rng() * 0.6, z: -0.5, r: 0.04, base: DARK, pulse: rng() > 0.7 ? PULSE_WARN : PULSE_TEAL, sp: 0.07 + rng() * 0.05 },
      ];
      for (const v of variants) {
        const curve = droop(a.clone().setZ(a.z + v.z * 0.3), b.clone().setZ(b.z + v.z * 0.3), v.sag, v.z);
        defs.push({
          curve,
          radius: v.r,
          base: v.base,
          pulse: v.pulse,
          speed: v.sp,
          phase: rng(),
          length: curve.getLength(),
        });
      }
    }

    // ── RISERS: monitor bottom port → trunk junction ──
    for (let i = 0; i < n; i++) {
      const p = galleryPosition(i);
      const a = new THREE.Vector3(p[0] + 0.7, p[1] - BEZEL_H / 2 + 0.1, -0.1);
      const j = new THREE.Vector3(p[0] + 0.9 + (rng() - 0.5) * 0.8, TRUNK_Y, TRUNK_Z);
      const curve = vertical(a, j, (rng() - 0.5) * 0.8);
      defs.push({
        curve,
        radius: 0.03,
        base: TEAL,
        pulse: PULSE_TEAL,
        speed: 0.22 + rng() * 0.1, // data sinking to the bus
        phase: rng(),
        length: curve.getLength(),
      });
      junctionPts.push(j);
    }

    // ── TRUNK: two backbone runs under the whole corridor ──
    const x0 = galleryPosition(0)[0] - 7;
    const x1 = galleryPosition(n - 1)[0] + 7;
    for (const [zOff, r, sp, pulse] of [
      [0, 0.055, 0.42, PULSE_TEAL],
      [-0.55, 0.042, -0.3, PULSE_BLUE],
    ] as const) {
      const pts: THREE.Vector3[] = [];
      const steps = 12;
      for (let s = 0; s <= steps; s++) {
        const x = THREE.MathUtils.lerp(x0, x1, s / steps);
        pts.push(new THREE.Vector3(x, TRUNK_Y + Math.sin(s * 1.7) * 0.12 - 0.05, TRUNK_Z + zOff));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      defs.push({
        curve,
        radius: r,
        base: DARK,
        pulse,
        speed: sp,
        phase: rng(),
        length: curve.getLength(),
      });
    }

    // ── HANGS: thin suspension wires up into the void ──
    // Monitor 0 gets none: the trunk cable from the skills core (WireTunnel)
    // plugs into its back and "carries" it — and the fat pipe would clip
    // these thin wires where it threads past them.
    for (let i = 1; i < n; i++) {
      const p = galleryPosition(i);
      for (const side of [-1.1, 1.1]) {
        const a = new THREE.Vector3(p[0] + side, p[1] + BEZEL_H / 2 - 0.1, -0.1);
        const b = new THREE.Vector3(p[0] + side * 2.2, p[1] + 8.5, -1.6);
        const curve = vertical(a, b, (rng() - 0.5) * 0.5);
        defs.push({
          curve,
          radius: 0.016,
          base: DARK,
          pulse: PULSE_BLUE,
          speed: -(0.04 + rng() * 0.03), // slow power feed trickling down
          phase: rng(),
          length: curve.getLength(),
        });
      }
    }

    const cables = defs.map((d) => ({
      geometry: new THREE.TubeGeometry(d.curve as THREE.Curve<THREE.Vector3>, 48, d.radius, 6, false),
      material: makeCableMaterial({
        base: d.base,
        pulse: d.pulse,
        speed: d.speed,
        phase: d.phase,
        length: d.length,
      }),
    }));
    return { cables, junctionPts };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (const c of cables) c.material.uniforms.uTime.value = t;
    junctions.current.forEach((j, i) => {
      if (!j) return;
      const s = 1 + Math.sin(t * 2.2 + i * 1.9) * 0.28;
      j.scale.setScalar(s);
    });
  });

  return (
    <group>
      {cables.map((c, i) => (
        <mesh key={i} geometry={c.geometry} material={c.material} />
      ))}
      {/* glowing junction nodes where the risers tap the trunk */}
      {junctionPts.map((p, i) => (
        <mesh
          key={`j-${i}`}
          position={p}
          ref={(m) => {
            if (m) junctions.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color="#8cffe9" transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** tiny deterministic PRNG so the loom looks identical every load */
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

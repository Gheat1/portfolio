import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { GALLERY, galleryPosition } from '../../../config/scene';
import { GALLERY_ITEMS } from '../../../config/sections';

/**
 * Everything behind and below the CRT wall:
 *
 *   • a rank of dark server racks at z≈−7.5 with hundreds of randomly blinking
 *     status LEDs (one instanced mesh + one Points draw call)
 *   • a glowing data-center floor grid (drei <Grid>) the trunk cables run over
 *   • the "descent shaft" — a column of additive streaks the camera free-falls
 *     through on the way down from the skills core to the corridor
 */

const RACK_Z = -7.5;
const RACK_W = 1.5;
const RACK_D = 1.1;
const FLOOR_Y = GALLERY.anchor[1] - 3.85;

const dummy = new THREE.Object3D();

export default function Backdrop() {
  const racks = useRef<THREE.InstancedMesh>(null);

  const { rackDefs, midX } = useMemo(() => {
    const rng = mulberry(99);
    const x0 = galleryPosition(0)[0] - 11;
    const x1 = galleryPosition(GALLERY_ITEMS.length - 1)[0] + 11;
    const defs: { x: number; h: number }[] = [];
    for (let x = x0; x <= x1; x += 3.05) {
      defs.push({ x: x + (rng() - 0.5) * 0.5, h: 5.4 + rng() * 2.2 });
    }
    return { rackDefs: defs, midX: (x0 + x1) / 2 };
  }, []);

  // place rack instances once
  useLayoutEffect(() => {
    const m = racks.current;
    if (!m) return;
    rackDefs.forEach((r, i) => {
      dummy.position.set(r.x, FLOOR_Y + r.h / 2, RACK_Z);
      dummy.scale.set(1, r.h / 6, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [rackDefs]);

  // LED cloud: a handful of blinking status lights on each rack face
  const ledGeo = useMemo(() => {
    const rng = mulberry(4242);
    const pts: number[] = [];
    const seeds: number[] = [];
    for (const r of rackDefs) {
      const count = 22 + Math.floor(rng() * 14);
      for (let i = 0; i < count; i++) {
        pts.push(
          r.x + (rng() - 0.5) * (RACK_W * 0.7),
          FLOOR_Y + 0.4 + rng() * (r.h - 0.8),
          RACK_Z + RACK_D / 2 + 0.02,
        );
        seeds.push(rng() * 100);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    return g;
  }, [rackDefs]);

  const ledMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aSeed;
          varying float vSeed;
          void main() {
            vSeed = aSeed;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 90.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying float vSeed;
          float hash(float p) { return fract(sin(p * 127.1) * 43758.5453); }
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float disc = smoothstep(0.5, 0.15, d);
            // each LED blinks on its own clock
            float h = hash(vSeed + floor(uTime * (1.2 + hash(vSeed) * 2.5)));
            float on = step(0.32, h);
            // colour cast per LED: mostly teal, some blue, the odd red alert
            float pick = hash(vSeed * 3.7);
            vec3 col = pick > 0.94 ? vec3(1.0, 0.28, 0.4)
                     : pick > 0.6  ? vec3(0.35, 0.8, 1.0)
                                   : vec3(0.3, 1.0, 0.8);
            gl_FragColor = vec4(col, disc * on * (0.5 + 0.5 * hash(vSeed * 9.1)));
          }
        `,
      }),
    [],
  );

  // descent shaft: vertical additive streaks between the skills core and corridor
  const shaftGeo = useMemo(() => {
    const rng = mulberry(777);
    const verts: number[] = [];
    const cols: number[] = [];
    const teal = new THREE.Color('#00ffcc');
    const blue = new THREE.Color('#18a0ff');
    for (let i = 0; i < 340; i++) {
      const r = 2.5 + rng() * 6.5;
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 1;
      const y = -9 - rng() * 56; // starts below scene 1's sightline
      const len = 0.5 + rng() * 1.9;
      verts.push(x, y, z, x, y - len, z);
      const c = rng() > 0.75 ? blue : teal;
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, []);

  useFrame((state) => {
    ledMaterial.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      {/* rack wall */}
      <instancedMesh ref={racks} args={[undefined, undefined, rackDefs.length]} frustumCulled={false}>
        <boxGeometry args={[RACK_W, 6, RACK_D]} />
        <meshBasicMaterial color="#0a0f15" />
      </instancedMesh>
      <points geometry={ledGeo} material={ledMaterial} />

      {/* data-center floor */}
      <Grid
        position={[midX, FLOOR_Y, -1]}
        args={[10, 10]}
        cellSize={1}
        sectionSize={5}
        cellThickness={0.6}
        sectionThickness={1.1}
        cellColor="#0a2f27"
        sectionColor="#0e8a6e"
        fadeDistance={55}
        fadeStrength={1.6}
        infiniteGrid
        followCamera={false}
      />

      {/* descent shaft streaks */}
      <lineSegments geometry={shaftGeo}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

/** tiny deterministic PRNG so the backdrop looks identical every load */
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

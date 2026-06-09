import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../../config/scene';

/**
 * Scene 1 — a volumetric particle field (THREE.Points) that drifts on its own and
 * subtly tilts toward the pointer, plus a few wireframe polyhedra tumbling through
 * it like debris. Additive blending + bloom turns everything into glowing motes
 * of "infrastructure".
 *
 * Note on the render loop: this component has its own useFrame, but R3F runs every
 * useFrame callback inside ONE shared requestAnimationFrame loop. Splitting logic
 * across components does NOT create extra loops — it's the idiomatic R3F pattern.
 */

const COUNT = 2600;
const RADIUS = 26;

interface Props {
  position?: Vec3;
}

export default function ParticleField({ position = [0, 0, 0] }: Props) {
  const points = useRef<THREE.Points>(null);

  // Generate once. Uniform distribution inside a sphere (cbrt corrects clumping),
  // with per-particle colour: mostly teal, a scatter of electric blue, rare red.
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const teal = new THREE.Color('#00ffcc');
    const blue = new THREE.Color('#18a0ff');
    const red = new THREE.Color('#ff3b6b');
    for (let i = 0; i < COUNT; i++) {
      const r = RADIUS * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const pick = Math.random();
      const c = pick > 0.97 ? red : pick > 0.86 ? blue : teal;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state, delta) => {
    const g = points.current;
    if (!g) return;
    const dt = Math.min(delta, 1 / 30);
    g.rotation.y += dt * 0.02; // constant slow drift
    // Ease the cloud's tilt toward the pointer for a parallax-y "reactive" feel.
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, state.pointer.y * 0.18, 3, dt);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, -state.pointer.x * 0.18, 3, dt);
  });

  return (
    <group position={position}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.09}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* tumbling wireframe debris */}
      <Drifter geo="octa" pos={[-7.5, 2.4, -5]} scale={1.2} speed={0.21} color="#18e0ff" />
      <Drifter geo="icosa" pos={[6.4, -3.2, -7]} scale={0.9} speed={-0.16} color="#00ffcc" />
      <Drifter geo="tetra" pos={[3.2, 4.2, -10]} scale={1.5} speed={0.12} color="#18a0ff" />
      <Drifter geo="octa" pos={[-4.0, -4.6, -3]} scale={0.6} speed={-0.27} color="#00ffcc" />
    </group>
  );
}

const DRIFTER_GEO = {
  octa: new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1)),
  icosa: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1)),
  tetra: new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(1)),
} as const;

function Drifter({
  geo,
  pos,
  scale,
  speed,
  color,
}: {
  geo: keyof typeof DRIFTER_GEO;
  pos: Vec3;
  scale: number;
  speed: number;
  color: string;
}) {
  const ref = useRef<THREE.LineSegments>(null);

  useFrame((state, delta) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(delta, 1 / 30);
    m.rotation.x += dt * speed;
    m.rotation.y += dt * speed * 1.4;
    m.position.y = pos[1] + Math.sin(state.clock.elapsedTime * 0.4 + pos[0]) * 0.5;
  });

  return (
    <lineSegments ref={ref} geometry={DRIFTER_GEO[geo]} position={pos} scale={scale}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

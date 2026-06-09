import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../../config/scene';
import { rig } from '../../state/rig';

/**
 * Scene 2 — an abstract "core" (think server rack / bare-metal node lattice).
 * A 4×4×4 grid of glowing nodes sits inside a wireframe icosahedron shell,
 * cross-wired with a glowing lattice and orbited by two containment rings.
 *
 * As `rig.skills.explode` ramps 0→1 (driven by the scroll timeline), every node
 * flies outward along its own radial vector, the lattice wiring burns away, the
 * rings drift apart and the shell expands and fades — the structure "detonates"
 * to reveal the skill arrays in the overlay.
 */

const GRID = 4;
const SPACING = 1.15;
const SPREAD = 9; // how far nodes travel when fully exploded

const dummy = new THREE.Object3D(); // reused to compose instance matrices

interface NodeDef {
  base: THREE.Vector3;
  dir: THREE.Vector3;
  spin: number;
}

interface Props {
  position?: Vec3;
}

export default function SkillsCore({ position = [0, 0, 0] }: Props) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const shell = useRef<THREE.LineSegments>(null);
  const lattice = useRef<THREE.LineSegments>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const lastExplode = useRef(-1);

  const nodes = useMemo<NodeDef[]>(() => {
    const out: NodeDef[] = [];
    const off = (GRID - 1) / 2;
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        for (let z = 0; z < GRID; z++) {
          const base = new THREE.Vector3((x - off) * SPACING, (y - off) * SPACING, (z - off) * SPACING);
          const dir = base.clone().normalize();
          if (dir.lengthSq() === 0) dir.set(0, 1, 0); // dead-center node
          out.push({ base, dir, spin: Math.random() * Math.PI });
        }
      }
    }
    return out;
  }, []);

  // index pairs of orthogonally adjacent nodes → the lattice wiring
  const latticePairs = useMemo(() => {
    const idx = (x: number, y: number, z: number) => x * GRID * GRID + y * GRID + z;
    const pairs: [number, number][] = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        for (let z = 0; z < GRID; z++) {
          if (x < GRID - 1) pairs.push([idx(x, y, z), idx(x + 1, y, z)]);
          if (y < GRID - 1) pairs.push([idx(x, y, z), idx(x, y + 1, z)]);
          if (z < GRID - 1) pairs.push([idx(x, y, z), idx(x, y, z + 1)]);
        }
      }
    }
    return pairs;
  }, []);

  const latticeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(latticePairs.length * 6), 3));
    return g;
  }, [latticePairs]);

  const nodeGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const nodeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00ffcc' }), []);
  const shellGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.4, 1)), []);

  useFrame((state, delta) => {
    const e = rig.skills.explode;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);

    const m = mesh.current;
    if (m) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        dummy.position.copy(n.base).addScaledVector(n.dir, e * SPREAD);
        dummy.scale.setScalar(THREE.MathUtils.lerp(0.42, 0.16, e)); // shrink as they fly out
        dummy.rotation.set(n.spin + t * 0.4, n.spin + t * 0.25, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }

    // rebuild lattice endpoints only when the explode amount actually moved
    const lat = lattice.current;
    if (lat && Math.abs(e - lastExplode.current) > 1e-4) {
      lastExplode.current = e;
      const attr = lat.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      latticePairs.forEach(([a, b], i) => {
        const na = nodes[a];
        const nb = nodes[b];
        arr[i * 6] = na.base.x + na.dir.x * e * SPREAD;
        arr[i * 6 + 1] = na.base.y + na.dir.y * e * SPREAD;
        arr[i * 6 + 2] = na.base.z + na.dir.z * e * SPREAD;
        arr[i * 6 + 3] = nb.base.x + nb.dir.x * e * SPREAD;
        arr[i * 6 + 4] = nb.base.y + nb.dir.y * e * SPREAD;
        arr[i * 6 + 5] = nb.base.z + nb.dir.z * e * SPREAD;
      });
      attr.needsUpdate = true;
      // wiring burns away early in the detonation
      (lat.material as THREE.LineBasicMaterial).opacity = Math.max(0, 0.5 - e * 1.25);
    }

    if (group.current) group.current.rotation.y += dt * 0.15;

    if (shell.current) {
      shell.current.scale.setScalar(THREE.MathUtils.lerp(1, 3.4, e));
      shell.current.rotation.x = t * 0.08;
      const mat = shell.current.material as THREE.LineBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(0.9, 0.04, e);
    }

    // containment rings precess, then drift apart with the blast
    const ringScale = 1 + e * 1.7;
    if (ringA.current) {
      ringA.current.rotation.x = t * 0.42;
      ringA.current.rotation.y = t * 0.19;
      ringA.current.scale.setScalar(ringScale);
      (ringA.current.material as THREE.MeshBasicMaterial).opacity = (1 - e) * 0.55;
    }
    if (ringB.current) {
      ringB.current.rotation.x = -t * 0.31 + Math.PI / 2.4;
      ringB.current.rotation.z = t * 0.23;
      ringB.current.scale.setScalar(ringScale * 1.12);
      (ringB.current.material as THREE.MeshBasicMaterial).opacity = (1 - e) * 0.4;
    }
  });

  return (
    <group ref={group} position={position}>
      <lineSegments ref={shell} geometry={shellGeo}>
        <lineBasicMaterial
          color="#18e0ff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* node-to-node wiring */}
      <lineSegments ref={lattice} geometry={latticeGeo}>
        <lineBasicMaterial
          color="#00ffcc"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* containment rings */}
      <mesh ref={ringA}>
        <torusGeometry args={[3.15, 0.016, 6, 96]} />
        <meshBasicMaterial
          color="#18e0ff"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[3.5, 0.012, 6, 96]} />
        <meshBasicMaterial
          color="#00ffcc"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <instancedMesh ref={mesh} args={[nodeGeo, nodeMat, nodes.length]} frustumCulled={false} />
    </group>
  );
}

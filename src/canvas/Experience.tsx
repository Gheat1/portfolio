import { CameraRig } from './CameraRig';
import Effects from './Effects';
import ParticleField from './scenes/ParticleField';
import SkillsCore from './scenes/SkillsCore';
import Gallery from './scenes/gallery/Gallery';
import WireTunnel from './scenes/gallery/WireTunnel';
import { PARTICLES_ANCHOR, SKILLS_ANCHOR } from '../config/scene';

/**
 * The R3F scene graph. All three scenes coexist in world space at fixed anchors;
 * the camera (driven by `CameraRig`) is what moves between them, so there are no
 * mount/unmount hitches as the user scrolls.
 */
export default function Experience() {
  return (
    <>
      <color attach="background" args={['#05070a']} />
      {/* Exponential-ish depth fade: distant geometry melts into the background. */}
      <fog attach="fog" args={['#05070a', 22, 150]} />

      {/* Emissive/basic materials carry the look, so lighting stays minimal. */}
      <ambientLight intensity={0.2} />
      <pointLight position={[0, SKILLS_ANCHOR[1] + 6, 8]} intensity={40} color="#00ffcc" distance={60} decay={2} />

      <ParticleField position={PARTICLES_ANCHOR} />
      <SkillsCore position={SKILLS_ANCHOR} />
      <Gallery />
      {/* the trunk cable from the core to CRT-01 — and the ride inside it */}
      <WireTunnel />

      <CameraRig />
      <Effects />
    </>
  );
}

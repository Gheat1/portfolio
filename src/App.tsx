import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Experience from './canvas/Experience';
import Overlay from './overlays/Overlay';
import Hud from './overlays/Hud';
import Boot from './overlays/Boot';
import ScrollController from './components/ScrollController';
import { CAMERA_KEYFRAMES } from './config/scene';

const initial = CAMERA_KEYFRAMES[0].position;

export default function App() {
  return (
    <>
      <Boot />

      {/* Pinned full-screen WebGL canvas. R3F auto-resizes it to its parent. */}
      <div className="canvas-root">
        <Canvas
          dpr={[1, 1.5]} // cap pixel ratio: the post chain is per-pixel — 1.5 is visually identical under grain/scanlines but ~45% fewer pixels than 2
          // antialias OFF: EffectComposer renders to its own multisampled buffers,
          // so canvas MSAA would be paid for and then thrown away on every frame.
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
          camera={{ fov: 55, near: 0.1, far: 400, position: initial }}
        >
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </Canvas>
      </div>

      {/* Crisp HTML text, perfectly legible, fading in/out with the scroll timeline. */}
      <Overlay />

      {/* Terminal-style HUD frame + scroll progress bar. */}
      <Hud />

      {/* Full-page CRT treatment: scanlines, vignette, slow roll-bar. CSS only. */}
      <div className="crt-fx" aria-hidden />

      {/* White-out covering the burst through CRT-01's glass (wire dive exit).
          Opacity driven by the scroll timeline in ScrollController. */}
      <div className="warp-flash" aria-hidden />

      {/* Drives ScrollTrigger → the shared `rig` → camera/overlays. Renders nothing. */}
      <ScrollController />

      {/* Invisible spacer that creates the scrollable height. */}
      <div className="scroll-spacer" aria-hidden />
    </>
  );
}

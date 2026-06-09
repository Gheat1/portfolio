import { useMemo } from 'react';
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

/**
 * Post-processing stack. Order matters — effects compose top-to-bottom.
 *
 *  • Bloom               — the glow. Only pixels brighter than `luminanceThreshold`
 *                          bloom, so emissive teal/cyan materials and the cable
 *                          pulses light up while the dark background stays clean.
 *  • ChromaticAberration — a whisper of RGB fringing at the edges; sells the
 *                          "everything is being shot through a tube" look without
 *                          hurting text legibility (offset is sub-pixel).
 *  • Noise               — subtle animated film grain (SOFT_LIGHT keeps it from
 *                          washing out blacks).
 *  • Vignette            — darkens the frame edges to focus the eye on the center.
 */
export default function Effects() {
  const caOffset = useMemo(() => new THREE.Vector2(0.00045, 0.0003), []);

  return (
    <EffectComposer multisampling={2}>
      <Bloom
        intensity={0.95}
        luminanceThreshold={0.24}
        luminanceSmoothing={0.38}
        mipmapBlur
        radius={0.72}
      />
      <ChromaticAberration offset={caOffset} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.36} />
      <Vignette offset={0.28} darkness={0.86} eskil={false} blendFunction={BlendFunction.NORMAL} />
    </EffectComposer>
  );
}

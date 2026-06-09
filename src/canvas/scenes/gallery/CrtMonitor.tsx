import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { GALLERY, GALLERY_SHIFT, GALLERY_WINDOWS, galleryPosition } from '../../../config/scene';
import type { GalleryItem } from '../../../config/sections';
import { rig } from '../../../state/rig';
import { makeCrtScreenMaterial } from './CrtScreenMaterial';

/**
 * One physical CRT monitor per gallery item.
 *
 *   • bezel + deep tube back + ports + power LED → the silhouette
 *   • curved glass face running the scanline/phosphor shader (CrtScreenMaterial)
 *   • a pinned terminal header, and BELOW it the full description as a single
 *     troika <Text> block that SCROLLS WITH THE PAGE and is clipped to the
 *     glass — long copy simply streams by instead of getting cut off
 *   • screens power on (collapse-line → picture) as the camera arrives
 *
 * The per-frame text scroll works by moving the Text node up while countering
 * its `clipRect` (clipRect lives in text-local coords), so the visible window
 * stays glued to the glass. clipRect is a render-time uniform in troika — no
 * relayout, so this is cheap.
 */

// ── monitor dimensions (world units) ─────────────────────────────────────────
export const SCREEN_W = 4.2;
export const SCREEN_H = 3.1;
export const BEZEL_W = 5.15;
export const BEZEL_H = 4.05;
export const BEZEL_D = 0.6;

const PAD_X = 0.3;
const HEADER_H = 0.62; // pinned title bar inside the glass
const FOOT_H = 0.34; // progress strip zone at the bottom of the glass
const BODY_TOP = SCREEN_H / 2 - HEADER_H;
const BODY_BOT = -SCREEN_H / 2 + FOOT_H;
const BODY_X = -SCREEN_W / 2 + PAD_X;
const BODY_W = SCREEN_W - PAD_X * 2;
const VIEW_H = BODY_TOP - BODY_BOT;
const Z_GLASS = BEZEL_D / 2 + 0.002;
const Z_TEXT = BEZEL_D / 2 + 0.16; // clears the 0.12 glass bulge

const FONT_REGULAR = '/fonts/JetBrainsMono-Regular.ttf';
const FONT_BOLD = '/fonts/JetBrainsMono-Bold.ttf';

/** drei <Text> wraps troika-three-text; these are the live props we drive per frame. */
interface TroikaText extends THREE.Mesh {
  textRenderInfo?: { blockBounds: [number, number, number, number] } | null;
  clipRect: [number, number, number, number] | null;
  fillOpacity: number;
}

// ── shared geometry (identical for every monitor → allocate once) ────────────
const screenGeo = (() => {
  // gently bulged plane: the classic curved tube face
  const g = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H, 32, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i) / (SCREEN_W / 2);
    const ny = p.getY(i) / (SCREEN_H / 2);
    p.setZ(i, 0.12 * (1 - 0.5 * nx * nx - 0.5 * ny * ny));
  }
  g.computeVertexNormals();
  return g;
})();

const glassFrameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(SCREEN_W + 0.14, SCREEN_H + 0.14));
const dividerGeo = new THREE.PlaneGeometry(BODY_W + 0.1, 0.016);
// unit-width bar anchored at its LEFT edge → scale.x is the fill amount
const barGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 0.026);
  g.translate(0.5, 0, 0);
  return g;
})();
const ledGeo = new THREE.CircleGeometry(0.05, 16);
const portGeo = new THREE.BoxGeometry(0.16, 0.3, 0.34);

export default function CrtMonitor({ item, index }: { item: GalleryItem; index: number }) {
  const group = useRef<THREE.Group>(null);
  const bodyText = useRef<TroikaText>(null);
  const headerText = useRef<TroikaText>(null);
  const divider = useRef<THREE.MeshBasicMaterial>(null);
  const barFill = useRef<THREE.Mesh>(null);
  const barMat = useRef<THREE.MeshBasicMaterial>(null);
  const led = useRef<THREE.MeshBasicMaterial>(null);

  const pos = galleryPosition(index);
  const win = GALLERY_WINDOWS[index];

  const screenMat = useMemo(() => makeCrtScreenMaterial(index * 7.31), [index]);

  // mutable per-frame state (no React)
  const fx = useRef({ power: 0, read: 0, clip: [0, 0, 0, 0] as [number, number, number, number] });
  const ledColor = useMemo(
    () => ({ on: new THREE.Color('#46ffd0'), standby: new THREE.Color('#ff9a3c') }),
    [],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);

    // hang-sway: very subtle so the attached cables stay visually connected
    g.position.y = pos[1] + Math.sin(t * 0.5 + index * 1.7) * 0.05;
    g.rotation.y = Math.sin(t * 0.27 + index) * 0.016;

    // proximity focus: 1 when the camera (which sits GALLERY_SHIFT left of its
    // target monitor) is parked at THIS monitor, 0 at its neighbours
    const dx = Math.abs(state.camera.position.x + GALLERY_SHIFT - pos[0]);
    const focus = THREE.MathUtils.clamp(1 - dx / (GALLERY.spacing * 0.6), 0, 1);

    // tube power chases focus — snappy on, slightly slower decay
    const target = THREE.MathUtils.smoothstep(focus, 0.04, 0.55);
    fx.current.power = THREE.MathUtils.damp(fx.current.power, target, target > fx.current.power ? 7 : 4.5, dt);
    const power = fx.current.power;

    screenMat.uniforms.uTime.value = t + index * 3.1;
    screenMat.uniforms.uPower.value = power;

    // text appears only once the tube is basically lit
    const textA = THREE.MathUtils.clamp((power - 0.78) / 0.22, 0, 1);
    if (headerText.current) headerText.current.fillOpacity = textA;
    if (divider.current) divider.current.opacity = textA * 0.6;

    // ── scroll the terminal feed with the page ──
    const readT = THREE.MathUtils.clamp((rig.progress - win.readStart) / (win.readEnd - win.readStart), 0, 1);
    fx.current.read = THREE.MathUtils.damp(fx.current.read, readT, 8, dt);

    const body = bodyText.current;
    if (body) {
      body.fillOpacity = textA;
      const bb = body.textRenderInfo?.blockBounds;
      const textH = bb ? -bb[1] : 0; // anchorY:top → block spans [0, -height]
      const range = Math.max(0, textH - VIEW_H);
      const scroll = fx.current.read * range;

      body.position.y = BODY_TOP + scroll;
      // counter-move the clip window (text-local coords) so it stays on the glass
      const clip = fx.current.clip;
      clip[0] = -0.03;
      clip[1] = BODY_BOT - BODY_TOP - scroll; // glass bottom, in text-local coords
      clip[2] = BODY_W + 0.03;
      clip[3] = -scroll + 0.001; // glass top, in text-local coords
      body.clipRect = clip;

      // progress strip along the bottom of the glass
      if (barFill.current) barFill.current.scale.x = Math.max(fx.current.read * BODY_W, 0.0001);
      if (barMat.current) barMat.current.opacity = (range > 0 ? 0.9 : 0.15) * textA;
    }

    // LED: solid teal when live, slow amber heartbeat on standby
    if (led.current) {
      if (focus > 0.5) {
        led.current.color.copy(ledColor.on);
        led.current.opacity = 1;
      } else {
        led.current.color.copy(ledColor.standby);
        led.current.opacity = Math.sin(t * 2.1 + index * 2.4) > 0.55 ? 0.95 : 0.12;
      }
    }
  });

  return (
    <group ref={group} position={pos}>
      {/* ── housing ── */}
      <RoundedBox args={[BEZEL_W, BEZEL_H, BEZEL_D]} radius={0.09} smoothness={3}>
        <meshBasicMaterial color="#0b1117" />
      </RoundedBox>
      {/* deep tube back — the CRT silhouette */}
      <RoundedBox args={[3.4, 2.7, 1.6]} radius={0.12} smoothness={3} position={[0, 0.1, -(BEZEL_D / 2 + 0.72)]}>
        <meshBasicMaterial color="#080d12" />
      </RoundedBox>

      {/* ── glass ── */}
      <mesh geometry={screenGeo} material={screenMat} position={[0, 0.12, Z_GLASS]} />
      <lineSegments geometry={glassFrameGeo} position={[0, 0.12, Z_GLASS + 0.005]}>
        <lineBasicMaterial color="#1f3038" transparent opacity={0.9} />
      </lineSegments>

      {/* ── on-glass terminal ── */}
      <group position={[0, 0.12, 0]}>
        {/* pinned header bar */}
        <Text
          ref={headerText as never}
          font={FONT_BOLD}
          position={[BODY_X, SCREEN_H / 2 - 0.2, Z_TEXT]}
          fontSize={0.165}
          color="#d9fff3"
          anchorX="left"
          anchorY="middle"
          letterSpacing={0.05}
          whiteSpace="nowrap"
          clipRect={[-0.03, -0.2, BODY_W + 0.03, 0.2]}
          fillOpacity={0}
        >
          {`▌ ${item.eyebrow.toUpperCase()} :: ${item.title.toUpperCase()}`}
        </Text>
        <mesh geometry={dividerGeo} position={[0, SCREEN_H / 2 - 0.44, Z_TEXT - 0.01]}>
          <meshBasicMaterial
            ref={divider}
            color="#18e0ff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* the scrolling feed — full description, clipped to the glass */}
        <Text
          ref={bodyText as never}
          font={FONT_REGULAR}
          position={[BODY_X, BODY_TOP, Z_TEXT]}
          fontSize={0.148}
          color="#a9f0db"
          anchorX="left"
          anchorY="top"
          lineHeight={1.62}
          maxWidth={BODY_W}
          clipRect={[-0.03, -VIEW_H, BODY_W + 0.03, 0.001]}
          fillOpacity={0}
        >
          {item.screen}
        </Text>

        {/* read-progress strip (vim-statusline energy) */}
        <mesh geometry={barGeo} position={[BODY_X, -SCREEN_H / 2 + 0.18, Z_TEXT]} ref={barFill}>
          <meshBasicMaterial
            ref={barMat}
            color="#35ffc9"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ── bezel furniture ── */}
      <mesh geometry={ledGeo} position={[BEZEL_W / 2 - 0.34, -BEZEL_H / 2 + 0.3, BEZEL_D / 2 + 0.004]}>
        <meshBasicMaterial ref={led} color="#ff9a3c" transparent opacity={0.4} />
      </mesh>
      <Text
        font={FONT_REGULAR}
        position={[-BEZEL_W / 2 + 0.34, -BEZEL_H / 2 + 0.3, BEZEL_D / 2 + 0.004]}
        fontSize={0.105}
        color="#52706b"
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.12}
      >
        {`CRT-${String(index + 1).padStart(2, '0')} · ${item.kind.toUpperCase()}`}
      </Text>

      {/* cable ports — the wires in Cables.tsx plug into these world positions;
          the connector blocks ride the monitor's sway so joints never show */}
      <mesh geometry={portGeo} position={[BEZEL_W / 2 + 0.02, -1.05, -0.05]}>
        <meshBasicMaterial color="#060a0e" />
      </mesh>
      <mesh geometry={portGeo} position={[-BEZEL_W / 2 - 0.02, -1.05, -0.05]}>
        <meshBasicMaterial color="#060a0e" />
      </mesh>
      <mesh geometry={portGeo} rotation={[0, 0, Math.PI / 2]} position={[0.7, -BEZEL_H / 2 - 0.02, -0.1]}>
        <meshBasicMaterial color="#060a0e" />
      </mesh>
      <mesh geometry={portGeo} rotation={[0, 0, Math.PI / 2]} position={[-1.1, BEZEL_H / 2 + 0.02, -0.1]}>
        <meshBasicMaterial color="#060a0e" />
      </mesh>
      <mesh geometry={portGeo} rotation={[0, 0, Math.PI / 2]} position={[1.1, BEZEL_H / 2 + 0.02, -0.1]}>
        <meshBasicMaterial color="#060a0e" />
      </mesh>
    </group>
  );
}

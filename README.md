# gheat.net // 3D scrollable portfolio

An ultra-technical, dark-cyberpunk, scroll-driven WebGL portfolio. A single virtual
camera flies through three scenes — a reactive particle field, an exploding skills
core, and a **corridor of CRT monitors strung together with a pulsing cable loom** —
all choreographed to the page scroll via one GSAP timeline.

In the corridor, each experience/project is a physical CRT: curved glass running a
scanline/phosphor shader, a power-on collapse animation as the camera arrives, and
the item's **full description streaming across the glass as a terminal feed, scrolled
by the page itself** (so copy of any length fits — nothing clips). The camera *dwells*
in front of each monitor while its feed plays, then hops to the next; data pulses run
through the link cables, risers, and trunk bus the whole time.

**Stack:** React 19 · TypeScript · Vite 6 · `@react-three/fiber` 9 · `@react-three/drei` 10 · `@react-three/postprocessing` 3 · GSAP 3 (ScrollTrigger).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle to /dist
npm run preview    # serve the built bundle
```

---

## Architecture at a glance

The core idea: **scrolling never re-renders React.** It mutates plain numbers that
the render loop reads. One data flow, no layout thrashing:

```
 page scroll
     │
     ▼
 GSAP ScrollTrigger ──scrub──► master GSAP timeline (total duration = 1)
     │ (writes a number)              │ tweens
     │                                ├─► rig.cam.{px,py,pz, lx,ly,lz}   (camera target)
     │                                ├─► rig.skills.explode             (0 → 1)
     │                                └─► overlay DOM opacity / y         (fade panels)
     │
     ▼
 rig  (plain mutable singleton, src/state/rig.ts)
     │ read every frame
     ▼
 useFrame loop (R3F) ──damp──► real THREE.PerspectiveCamera + meshes
```

`rig` is the bridge: GSAP (outside React) writes it ~60×/s; the R3F `useFrame` loop
reads it and damps the real camera/meshes toward it. Because only numbers change,
React never re-renders on scroll.

### File map

| File | Responsibility |
| --- | --- |
| `src/data/portfolio.ts` | Typed portfolio content (the only place you edit copy). |
| `src/config/sections.ts` | Flattens experience + projects into one ordered `GALLERY_ITEMS` list. |
| `src/config/scene.ts` | **The choreography.** Camera keyframes, overlay timing windows, scene anchors. |
| `src/state/rig.ts` | Shared mutable bridge between GSAP and the render loop. |
| `src/components/ScrollController.tsx` | Builds the one scrubbed GSAP timeline. Renders nothing. |
| `src/canvas/Experience.tsx` | R3F scene graph (fog, lights, the three scenes, rig, effects). |
| `src/canvas/CameraRig.tsx` | The single `useFrame` that moves the real camera. |
| `src/canvas/Effects.tsx` | Post-processing: bloom + film grain + vignette. |
| `src/canvas/scenes/ParticleField.tsx` | Scene 1 — mouse-reactive `THREE.Points` + wireframe debris. |
| `src/canvas/scenes/SkillsCore.tsx` | Scene 2 — instanced node lattice + wiring + rings that explode. |
| `src/canvas/scenes/gallery/Gallery.tsx` | Scene 3 composition root (monitors + cables + backdrop). |
| `src/canvas/scenes/gallery/CrtMonitor.tsx` | One CRT: bezel, tube, glass shader, scroll-synced terminal feed. |
| `src/canvas/scenes/gallery/CrtScreenMaterial.ts` | GLSL for the tube face (scanlines, power-on) + cable pulses. |
| `src/canvas/scenes/gallery/Cables.tsx` | The wiring loom: links, risers, trunk bus, hang wires, junctions. |
| `src/canvas/scenes/gallery/Backdrop.tsx` | Server racks + blinking LEDs, floor grid, descent shaft. |
| `src/overlays/Overlay.tsx` | Crisp HTML text panels (synced to the timeline) + contact finale. |
| `src/overlays/Hud.tsx` | Terminal HUD frame, live telemetry, section warp rail, progress bar. |
| `src/overlays/Boot.tsx` | Terminal POST boot sequence (skippable, reduced-motion aware). |

---

## How the scroll → camera interpolation works (the math)

There are **four** transforms between "user scrolled N pixels" and "camera is here."

### 1. Scroll position → progress `p ∈ [0, 1]`

A tall invisible `.scroll-spacer` (`height: 1150vh`) gives the page its scroll length.
ScrollTrigger linearly normalizes the scroll position into a single scalar:

```
p = (scrollTop − start) / (end − start)
```

where `start`/`end` are the spacer's top-hits-top and bottom-hits-bottom positions.
`p = 0` at the very top, `p = 1` at the very bottom.

### 2. progress → timeline time `t`

The master timeline is built with **total duration = 1** and attached to ScrollTrigger
with `scrub`. Scrub makes the timeline's playhead follow `p`, so:

```
t = p · totalDuration = p · 1 = p
```

This is the trick that makes the code readable: **a tween placed at timeline position
`a` with duration `d` plays over scroll range `[a, a + d]`.** Timeline positions *are*
scroll percentages. See `src/config/scene.ts` — every `at:` value is a scroll fraction.

### 3. timeline time → camera pose (keyframe lerp + easing)

The camera path is a list of keyframes, each a pose at a scroll fraction
(`src/config/scene.ts`):

```ts
{ at: 0.28, position: [0, -33, 16], lookAt: [0, -34, 0], ease: 'power2.inOut' }
```

For each pair of adjacent keyframes A → B, `ScrollController` adds one GSAP tween per
channel (`px, py, pz, lx, ly, lz`) from A's value to B's value, placed at `A.at` with
duration `B.at − A.at`. Inside that span GSAP computes, per channel:

```
α = (t − A.at) / (B.at − A.at)          // 0..1 within the segment
value = A.value + (B.value − A.value) · e(α)
```

That's **linear interpolation (lerp)** of each coordinate, with an **easing function
`e`** reshaping the parameter (`power1.inOut`, `power2.inOut`, …). Position and lookAt
are interpolated independently, which is what lets the camera *swing its gaze* across a
scene while it dollies — e.g. orbiting the skills core while always looking at it.

### 4. target pose → real camera (frame-rate-independent damping)

GSAP writes the *target* into `rig.cam`. The real camera is moved in one `useFrame`
(`src/canvas/CameraRig.tsx`) with exponential smoothing:

```
value += (target − value) · (1 − e^(−λ · dt))
```

This is exactly `THREE.MathUtils.damp(value, target, λ, dt)`. Because the decay uses the
frame delta `dt`, the motion is identical at 30fps or 144fps. Larger `λ` = snappier;
smaller = floatier. This second smoothing pass (on top of GSAP's `scrub`) is what makes
fast scroll-flings feel fluid instead of teleporting.

**Rotation** isn't tweened as Euler angles — we author a `lookAt` *point* per keyframe
and call `camera.lookAt(dampedTarget)` each frame. `lookAt` builds the orientation
quaternion from `(eye, target, up)`, so "where the camera looks" is just another
interpolated 3D point. (Prefer explicit Euler control? Tween `rig.cam.rx/ry/rz` and set
`camera.rotation` instead — the rig pattern is identical.)

Pointer parallax is layered on top: the damp target is `rig.cam.p* + pointer · k`, a
small additive nudge so the eye drifts with the mouse without changing the storyboard.

---

## The in-screen terminal scroll (how descriptions never clip)

Each gallery item's long copy is composed into one terminal feed string
(`sections.ts → item.screen`) and rendered as a single troika `<Text>` block on the
CRT's glass. Per frame, `CrtMonitor`:

1. maps `rig.progress` through the item's `readStart → readEnd` window (from
   `GALLERY_WINDOWS` in `scene.ts`) into a 0–1 read position,
2. measures the laid-out text height from `textRenderInfo.blockBounds`,
3. slides the Text node up by `read · (textHeight − viewHeight)` while
   counter-moving its `clipRect` (clipRect lives in text-local coordinates), so the
   visible window stays glued to the glass.

`clipRect` is a render-time uniform in troika — no text relayout happens during
scroll, so this costs ~nothing. The camera keyframes hold still (dwell) over the same
window, which is what makes the feed readable.

## Customizing

- **Content:** edit `src/data/portfolio.ts`. Add a project and a new CRT monitor,
  camera dwell, cable hookups, and overlay panel all appear automatically (everything
  iterates `GALLERY_ITEMS`).
- **Choreography:** edit `CAMERA_KEYFRAMES`, `GALLERY_WINDOWS` inputs (`DWELL`,
  `GALLERY_SCROLL`), `OVERLAY_TIMINGS`, and `SKILLS_EXPLODE` in `src/config/scene.ts`.
  Keep `at:` values ascending. An overlay timing with `end > 0.999` is "sticky" and
  never fades out (used by the contact card).
- **Contact card:** email + site links live at the bottom of `src/overlays/Overlay.tsx`.
- **Scroll length / pacing:** change `.scroll-spacer { height }` in `src/index.css`
  (more height = slower, longer scroll).
- **Look & feel:** the palette lives in CSS variables at the top of `src/index.css`
  (`--accent`, `--bg`, …); bloom/grain intensity in `src/canvas/Effects.tsx`.
- **Fonts:** the HUD/overlays use JetBrains Mono via Google Fonts (`index.html`); the
  3D `<Text>` labels use the self-hosted copies in `public/fonts/` (referenced in
  `Gallery.tsx`) so they match exactly and work offline.
- **Feel of the fly-through:** `POS_LAMBDA` / `LOOK_LAMBDA` in `CameraRig.tsx` and the
  `scrub` value in `ScrollController.tsx`.

## Performance notes

- Scroll mutates numbers only — **zero React re-renders** during scroll.
- All `useFrame` callbacks share R3F's single `requestAnimationFrame` loop; splitting
  logic across components does not create extra loops.
- The skills core uses an `InstancedMesh` (one draw call for 64 nodes).
- `dpr={[1, 2]}` caps the pixel ratio; `three` / `r3f` / `gsap` are split into separate
  chunks (`vite.config.ts`).
- Respects `prefers-reduced-motion` for the HUD/boot animations.

> Dev tip: in development, the scroll state is exposed as `window.__rig` for debugging
> (stripped from production builds via `import.meta.env.DEV`).

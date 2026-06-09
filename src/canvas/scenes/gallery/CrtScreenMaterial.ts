import * as THREE from 'three';

/**
 * The CRT tube face. A small fragment shader fakes everything a real tube does:
 *
 *   • phosphor base glow + corner vignette (tubes are brighter in the middle)
 *   • horizontal scanlines + faint aperture-grille columns
 *   • a soft "refresh band" forever rolling down the screen
 *   • animated static/noise — heavy while the tube is warming up
 *   • POWER-ON COLLAPSE: below full power the image squeezes into the classic
 *     bright horizontal line, exactly like switching on an old monitor.
 *
 * `uPower` (0 = dead tube, 1 = running) is driven per-frame from camera
 * proximity in CrtMonitor, so screens flick on as you scroll up to them.
 */

export function makeCrtScreenMaterial(seed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 0 },
      uSeed: { value: seed },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPower;
      uniform float uSeed;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec2 uv = vUv;
        vec2 c = uv - 0.5;

        // ── power-on collapse: visible area squeezes to a bright line ──
        float open = smoothstep(0.02, 0.85, uPower);
        float halfH = 0.5 * open;
        float dy = abs(c.y);
        float inside = step(dy, max(halfH, 0.004));
        // line flares DURING the on/off transition, settles to a dim idle
        // afterglow on a dead tube (so 8 standby screens don't blind the finale)
        float flare = 0.18 + 1.5 * smoothstep(0.04, 0.3, uPower) * (1.0 - smoothstep(0.7, 0.95, uPower));
        float collapseGlow = (1.0 - open) * smoothstep(0.05, 0.0, abs(dy - halfH)) * flare;

        // ── running picture ──
        vec3 phosphor = vec3(0.014, 0.082, 0.066);
        float vig = 1.0 - dot(c, c) * 1.4;                       // corner shadow
        float scan = 0.76 + 0.24 * pow(0.5 + 0.5 * sin(uv.y * 565.0), 2.0);
        float cols = 0.93 + 0.07 * sin(uv.x * 720.0);            // aperture grille
        float flicker = 0.965 + 0.035 * sin(uTime * (8.0 + uSeed) + uSeed * 31.0);

        // rolling refresh band drifting down
        float band = fract(uv.y * 0.92 - uTime * 0.055 + uSeed);
        float roll = smoothstep(0.0, 0.28, band) * smoothstep(0.55, 0.28, band);

        // static — almost pure snow while warming up, a whisper when running
        float n = hash(uv * vec2(421.0, 237.0) + floor(uTime * 24.0) + uSeed);
        float snow = mix(0.85, 0.05, smoothstep(0.3, 0.95, uPower));

        vec3 on = phosphor * vig * scan * cols * flicker;
        on += phosphor * roll * 0.5;
        on += vec3(0.45, 0.95, 0.82) * (n * snow * 0.16);
        on *= max(uPower, 0.0);

        // dead-tube glass: near-black with a faint reflective sheen
        vec3 dead = vec3(0.006, 0.012, 0.013) * (0.5 + 0.5 * vig);

        vec3 col = mix(dead, on, inside);
        col += vec3(0.55, 1.0, 0.9) * collapseGlow;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * The inside wall of the trunk cable the camera rides from the skills core to
 * CRT-01. Rendered on a BackSide tube around TUNNEL_CURVE:
 *
 *   • energy rings sweeping past, driven by time AND `uRush` (the camera's
 *     progress through the pipe) — so scrolling faster visibly accelerates
 *     the data rushing by
 *   • dashed packet lanes streaming along the pipe at fixed angles
 *   • a hot glow at the far end: the light at the end of the tunnel is the
 *     back of CRT-01's glass
 *
 * `uFade` feathers the whole wall in/out around the dive window so the tube
 * never pops while it's on screen.
 */
export function makeTunnelInteriorMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uRush: { value: 0 },
      uFade: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uRush;
      uniform float uFade;
      varying vec2 vUv;

      void main() {
        vec3 col = vec3(0.004, 0.012, 0.016);

        // energy rings sweeping down the pipe (kept slim so the packet lanes
        // and tracers read as the "data", not the hoops)
        float ringPhase = vUv.x * 24.0 - uTime * 1.1 - uRush * 46.0;
        float s = fract(ringPhase);
        float ring = smoothstep(0.09, 0.0, min(s, 1.0 - s));
        col += vec3(0.04, 0.34, 0.29) * ring;

        // dashed packet lanes at fixed angles around the wall
        float laneId = floor(vUv.y * 16.0);
        float lane = fract(vUv.y * 16.0);
        float lineMask = smoothstep(0.10, 0.02, min(lane, 1.0 - lane));
        float dash = step(
          0.45,
          fract(vUv.x * 36.0 - uTime * (2.0 + fract(laneId * 0.371) * 3.0) - uRush * 80.0 + laneId * 0.73)
        );
        vec3 laneCol = mix(vec3(0.1, 1.0, 0.8), vec3(0.25, 0.7, 1.0), fract(laneId * 0.618));
        col += laneCol * lineMask * dash * 0.55;

        // light at the end of the tunnel — CRT-01's glass from behind
        float endGlow = smoothstep(0.9, 1.0, vUv.x);
        col += vec3(0.5, 1.0, 0.9) * endGlow * endGlow * 1.7;

        gl_FragColor = vec4(col, uFade);
      }
    `,
  });
}

/**
 * Wire jacket + data pulses. The tube geometry's uv.x runs 0→1 along the cable,
 * so a couple of gaussian-ish bands marching along uv.x read as packets flying
 * through the wire. `uSpeed` may be negative to send traffic the other way.
 */
export function makeCableMaterial(opts: {
  base: THREE.Color;
  pulse: THREE.Color;
  speed: number;
  phase: number;
  /** approximate world length of the cable — keeps pulse width consistent */
  length: number;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: opts.base },
      uPulse: { value: opts.pulse },
      uSpeed: { value: opts.speed },
      uPhase: { value: opts.phase },
      uWidth: { value: THREE.MathUtils.clamp(0.4 / Math.max(opts.length, 1), 0.012, 0.16) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uBase;
      uniform vec3 uPulse;
      uniform float uSpeed;
      uniform float uPhase;
      uniform float uWidth;
      varying vec2 vUv;

      float band(float u, float p, float w) {
        float d = abs(u - p);
        d = min(d, 1.0 - d); // wrap around the ends
        return smoothstep(w, 0.0, d);
      }

      void main() {
        // fake cylindrical shading so the jacket reads as a round wire
        float shade = 0.62 + 0.38 * (0.5 + 0.5 * sin(vUv.y * 6.2831853));
        vec3 col = uBase * shade;

        float t = uTime * uSpeed + uPhase;
        float g = band(vUv.x, fract(t), uWidth)
                + 0.55 * band(vUv.x, fract(t * 0.57 + 0.37), uWidth * 1.7);
        col += uPulse * g * 1.7;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

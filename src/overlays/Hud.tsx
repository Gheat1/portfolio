import { useEffect, useRef, useState } from 'react';
import { rig } from '../state/rig';

/**
 * Fixed terminal-style chrome that frames the canvas:
 *
 *   • corner brackets + top/bottom status rows (presentational)
 *   • LIVE TELEMETRY — sector name, scroll %, camera coords — written straight
 *     to the DOM from a rAF loop reading `rig` (no React re-renders)
 *   • a clickable section rail on the right edge that warps the scroll
 *   • the scroll progress bar, whose scaleX ScrollController drives
 */

const SECTIONS = [
  { id: 'sum', label: '01 · summary', short: '01', at: 0.0 },
  { id: 'skl', label: '02 · capability', short: '02', at: 0.3 },
  { id: 'wrk', label: '03 · work archive', short: '03', at: 0.62 },
  { id: 'end', label: '04 · transmission', short: '04', at: 0.985 },
];

function sectorName(p: number): string {
  if (p < 0.26) return 'SEC.01 — SUMMARY';
  if (p < 0.58) return 'SEC.02 — CAPABILITY MATRIX';
  if (p < 0.955) return 'SEC.03 — WORK ARCHIVE';
  return 'SEC.04 — TRANSMISSION END';
}

export default function Hud() {
  const [scrolled, setScrolled] = useState(false);
  const sectorEl = useRef<HTMLSpanElement>(null);
  const pctEl = useRef<HTMLSpanElement>(null);
  const camEl = useRef<HTMLSpanElement>(null);
  const railEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // telemetry loop — throttled to ~12 fps; cheap textContent writes only
  useEffect(() => {
    let raf = 0;
    let tick = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (tick++ % 5 !== 0) return;
      const p = rig.progress;
      if (sectorEl.current) sectorEl.current.textContent = sectorName(p);
      if (pctEl.current) pctEl.current.textContent = `${String(Math.round(p * 100)).padStart(3, '0')}%`;
      if (camEl.current) {
        const c = rig.cam;
        camEl.current.textContent = `cam[${c.px.toFixed(1)}, ${c.py.toFixed(1)}, ${c.pz.toFixed(1)}]`;
      }
      if (railEl.current) {
        const items = railEl.current.querySelectorAll<HTMLElement>('[data-at]');
        let active = 0;
        SECTIONS.forEach((s, i) => {
          if (p >= s.at - 0.012) active = i;
        });
        items.forEach((el, i) => el.classList.toggle('is-active', i === active));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const jump = (at: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: at * max + 1, behavior: 'smooth' });
  };

  return (
    <>
      <div className="hud">
        <div className="hud__row">
          <span className="hud__brand">gheat.net</span>
          <span className="hud__sector" ref={sectorEl}>
            SEC.01 — SUMMARY
          </span>
          <span>// portfolio_v0.2</span>
        </div>
        <div className="hud__row">
          <span className="hud__status">system online</span>
          <span className="hud__telemetry">
            <span ref={camEl}>cam[0.0, 0.0, 16.0]</span>
            <span className="hud__pct" ref={pctEl}>
              000%
            </span>
          </span>
          <span>bare-metal // arch linux</span>
        </div>
        <span className="hud__corner hud__corner--tl" />
        <span className="hud__corner hud__corner--tr" />
        <span className="hud__corner hud__corner--bl" />
        <span className="hud__corner hud__corner--br" />
      </div>

      {/* section warp rail */}
      <div className="rail" ref={railEl}>
        {SECTIONS.map((s) => (
          <button key={s.id} className="rail__item" data-at={s.at} onClick={() => jump(s.at)} type="button">
            <span className="rail__label">{s.label}</span>
            <span className="rail__dot" />
          </button>
        ))}
      </div>

      {!scrolled && (
        <div className="scroll-hint">
          <span>scroll to traverse ↓</span>
        </div>
      )}

      <div className="hud__progress" />
    </>
  );
}

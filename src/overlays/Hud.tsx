import { useEffect, useRef } from 'react';
import { rig } from '../state/rig';
import { IDENTITY } from '../data/portfolio';
import { RESUME_URL } from './Overlay';

/**
 * Fixed terminal-style chrome that frames the canvas:
 *
 *   • corner brackets + top/bottom status rows (presentational)
 *   • a persistent ⬇ resume.pdf chip — the escape hatch for visitors who
 *     don't want the 3D ride, visible from the first frame
 *   • LIVE TELEMETRY — sector name, scroll %, camera coords — written straight
 *     to the DOM from a rAF loop reading `rig` (no React re-renders)
 *   • a clickable section rail on the right edge that warps the scroll
 *   • the JOURNEY TRACKER — a persistent bottom-center widget showing all four
 *     stops, which one you're at, and a "keep scrolling" prompt so nobody
 *     stalls out halfway down the page
 *   • the scroll progress bar, whose scaleX ScrollController drives
 */

const SECTIONS = [
  { id: 'sum', label: '01 · summary', short: 'summary', at: 0.0 },
  { id: 'skl', label: '02 · skills', short: 'skills', at: 0.3 },
  { id: 'wrk', label: '03 · work experience', short: 'work', at: 0.62 },
  { id: 'end', label: '04 · contact', short: 'contact', at: 0.985 },
];

function sectorName(p: number): string {
  if (p < 0.26) return 'SEC.01 — SUMMARY';
  if (p < 0.58) return 'SEC.02 — CAPABILITY MATRIX';
  if (p < 0.955) return 'SEC.03 — WORK EXPERIENCE';
  return 'SEC.04 — TRANSMISSION END';
}

function activeIndex(p: number): number {
  let active = 0;
  SECTIONS.forEach((s, i) => {
    if (p >= s.at - 0.012) active = i;
  });
  return active;
}

export default function Hud() {
  const sectorEl = useRef<HTMLSpanElement>(null);
  const pctEl = useRef<HTMLSpanElement>(null);
  const camEl = useRef<HTMLSpanElement>(null);
  const railEl = useRef<HTMLDivElement>(null);
  const journeyEl = useRef<HTMLDivElement>(null);
  const hintEl = useRef<HTMLSpanElement>(null);

  // telemetry loop — throttled to ~12 fps; cheap textContent/class writes only
  useEffect(() => {
    let raf = 0;
    let tick = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (tick++ % 5 !== 0) return;
      const p = rig.progress;
      const active = activeIndex(p);

      if (sectorEl.current) sectorEl.current.textContent = sectorName(p);
      if (pctEl.current) pctEl.current.textContent = `${String(Math.round(p * 100)).padStart(3, '0')}%`;
      if (camEl.current) {
        const c = rig.cam;
        camEl.current.textContent = `cam[${c.px.toFixed(1)}, ${c.py.toFixed(1)}, ${c.pz.toFixed(1)}]`;
      }
      if (railEl.current) {
        railEl.current.querySelectorAll<HTMLElement>('[data-at]').forEach((el, i) => {
          el.classList.toggle('is-active', i === active);
        });
      }
      if (journeyEl.current) {
        journeyEl.current.querySelectorAll<HTMLElement>('.journey__stop').forEach((el, i) => {
          el.classList.toggle('is-active', i === active);
          el.classList.toggle('is-done', i < active);
        });
      }
      if (hintEl.current) {
        hintEl.current.textContent = p > 0.985 ? 'end of transmission · scroll up to replay' : 'keep scrolling ↓';
        hintEl.current.classList.toggle('is-end', p > 0.985);
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
          <span className="hud__brand">{IDENTITY.name} · {IDENTITY.site}</span>
          <span className="hud__sector" ref={sectorEl}>
            SEC.01 — SUMMARY
          </span>
          <a className="hud__resume" href={RESUME_URL} download>
            ⬇ resume.pdf
          </a>
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

      {/* journey tracker — persistent "you are here" + keep-scrolling prompt */}
      <div className="journey" ref={journeyEl}>
        <div className="journey__track">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              className="journey__stop"
              type="button"
              onClick={() => jump(s.at)}
              aria-label={`jump to ${s.short}`}
            >
              <span className="journey__dot" />
              <span className="journey__label">{s.short}</span>
              {i < SECTIONS.length - 1 && <span className="journey__link" aria-hidden />}
            </button>
          ))}
        </div>
        <span className="journey__hint" ref={hintEl}>
          keep scrolling ↓
        </span>
      </div>

      <div className="hud__progress" />
    </>
  );
}

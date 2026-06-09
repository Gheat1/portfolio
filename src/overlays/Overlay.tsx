import { PORTFOLIO, SKILL_GROUPS } from '../data/portfolio';
import { GALLERY_ITEMS } from '../config/sections';

/**
 * The HTML overlay layer. Every panel carries a `data-overlay="<id>"` attribute;
 * ScrollController looks each id up in OVERLAY_TIMINGS and drives its opacity/slide
 * from the scroll timeline. The ids here MUST match the keys produced in scene.ts
 * (`summary`, `skill-N`, each GALLERY_ITEMS id, and `contact`).
 *
 * Kept as plain crisp DOM (not drei <Html>) so long-form copy stays perfectly
 * legible and accessible, independent of the WebGL camera.
 *
 * NOTE: each gallery item's long description now streams INSIDE its 3D CRT
 * screen (see CrtMonitor) — the DOM panel is just the title block on the left,
 * so nothing can ever clip or overflow here again.
 */
export default function Overlay() {
  return (
    <div className="overlay-layer">
      {/* ── 01 · SUMMARY ─────────────────────────────────────────────── */}
      <section className="overlay-panel panel--summary" data-overlay="summary">
        <p className="kicker">01 / system summary</p>
        <h1 className="headline">
          <span className="glitch" data-text="SYSTEMS">SYSTEMS</span>
          <br />
          <span className="glitch" data-text="ENGINEER">ENGINEER</span>
        </h1>
        <p className="body">{PORTFOLIO.summary}</p>
      </section>

      {/* ── 02 · SKILLS — one category at a time (sequential reveal) ───── */}
      {SKILL_GROUPS.map((group, i) => (
        <section className="overlay-panel panel--skill" data-overlay={`skill-${i}`} key={group.id}>
          <p className="kicker">
            capability matrix · {String(i + 1).padStart(2, '0')}/
            {String(SKILL_GROUPS.length).padStart(2, '0')}
          </p>
          <h2 className="skill-title">{group.label}</h2>
          <div className="skill-tags">
            {group.items.map((s) => (
              <span className="skill-tag" key={s}>
                {s}
              </span>
            ))}
          </div>
          <div className="skill-count">{group.items.length} modules</div>
        </section>
      ))}

      {/* ── 03 · EXPERIENCE + PROJECTS — title block, left column ─────── */}
      {/* The full description streams across the CRT's glass on the right;
          this column is just the crisp headline + subtitle + a feed hint. */}
      {GALLERY_ITEMS.map((item, i) => (
        <article className="overlay-panel panel--project" data-overlay={item.id} key={item.id}>
          <h2 className="sr-only">
            {item.title} — {item.subtitle}
          </h2>
          <p className="kicker">
            {item.kind} · {String(i + 1).padStart(2, '0')}/{String(GALLERY_ITEMS.length).padStart(2, '0')}
          </p>
          <div className="project__title" aria-hidden>
            {item.title}
          </div>
          <p className="project__subtitle">{item.subtitle}</p>
          <p className="project__hint">
            <span className="project__hint-dot" /> live feed → CRT-{String(i + 1).padStart(2, '0')}
          </p>
        </article>
      ))}

      {/* ── 04 · TRANSMISSION END — contact ───────────────────────────── */}
      <section className="overlay-panel panel--contact" data-overlay="contact">
        <p className="kicker kicker--center">04 / end of transmission</p>
        <h2 className="headline headline--center">
          <span className="glitch" data-text="SIGNAL ME">SIGNAL ME</span>
        </h2>
        <p className="contact__line">open to internships · contracts · interesting problems</p>
        <div className="contact__links">
          <a href="mailto:skyegamer367@gmail.com">skyegamer367@gmail.com</a>
          <span className="contact__sep">//</span>
          <a href="https://gheat.net" target="_blank" rel="noreferrer">
            gheat.net
          </a>
        </div>
        <p className="contact__replay">▲ scroll up to replay the feed</p>
      </section>
    </div>
  );
}

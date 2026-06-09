import { PORTFOLIO, type Experience, type Project } from '../data/portfolio';

/**
 * Flattens EXPERIENCE + PROJECTS into a single ordered list of "gallery items".
 * Scene 3 (the CRT corridor) renders one monitor per item and the DOM overlay
 * renders one title block per item — both iterate THIS array, so the 3D scene,
 * the camera keyframes, and the text panels can never fall out of sync.
 */

export type GalleryKind = 'experience' | 'project';

export interface GalleryItem {
  /** stable id, also used as the overlay's `data-overlay` key */
  id: string;
  kind: GalleryKind;
  /** small label: a period ("Summer 2025") or a project code ("P-03") */
  eyebrow: string;
  /** big label: company or project title */
  title: string;
  /** secondary label: role or project subtitle */
  subtitle: string;
  /**
   * The full terminal feed rendered INSIDE the CRT screen. Composed once here;
   * the monitor scrolls it vertically as the page scrolls, so copy of ANY
   * length fits — nothing ever gets cut off.
   */
  screen: string;
}

/** Experience → a tailing ops log: every bullet becomes a `>` log line. */
function experienceFeed(e: Experience): string {
  const head = `$ tail -f ./operations.log\n\n[role]   ${e.role.toLowerCase()}\n[period] ${e.period.toLowerCase()}\n`;
  const lines = e.bullets.map((b) => `> ${b}`).join('\n\n');
  return `${head}\n${lines}\n\n[EOF] ████ stream closed`;
}

/** Project → `cat readme.md`: the long-form description streams as one doc. */
function projectFeed(p: Project): string {
  return `$ cat ./readme.md\n\n# ${p.title.toLowerCase()}\n:: ${p.subtitle.toLowerCase()}\n\n${p.details}\n\n[EOF] ████ stream closed`;
}

export const GALLERY_ITEMS: GalleryItem[] = [
  ...PORTFOLIO.experience.map<GalleryItem>((e, i) => ({
    id: `exp-${i}`,
    kind: 'experience',
    eyebrow: e.period,
    title: e.company,
    subtitle: e.role,
    screen: experienceFeed(e),
  })),
  ...PORTFOLIO.projects.map<GalleryItem>((p, i) => ({
    id: `project-${i}`,
    kind: 'project',
    eyebrow: `P-${String(i + 1).padStart(2, '0')}`,
    title: p.title,
    subtitle: p.subtitle,
    screen: projectFeed(p),
  })),
];

import { useEffect, useRef, useState } from 'react';

/**
 * Terminal boot sequence. POST lines type out one by one, then a quick CRT
 * power-on flash hands over to the scene. Any click/keypress skips it, and
 * `prefers-reduced-motion` bypasses it entirely. Total runtime ≈ 1.9s — long
 * enough to set the mood, short enough not to gate the content.
 */

const LINES = [
  'GHEAT BIOS v0.2.0 — POST ........ OK',
  'cpu  : quantitative-core ×16 ... OK',
  'mem  : 64GiB ECC ............... OK',
  'gpu  : phosphor accelerator .... OK',
  'mount /dev/portfolio ........... OK',
  'tailscale mesh ................. UP',
  'crt array ×8 ............. SIGNAL LOCKED',
  'starting compositor ............ OK',
];

export default function Boot() {
  const [lineCount, setLineCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const t = timers.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const finish = () => {
      setLineCount(LINES.length);
      setFlash(true);
      t.push(window.setTimeout(() => setFading(true), 180));
      t.push(window.setTimeout(() => setDone(true), 760));
    };

    if (reduced) {
      setDone(true);
      return;
    }

    LINES.forEach((_, i) => {
      t.push(window.setTimeout(() => setLineCount(i + 1), 130 + i * 150));
    });
    t.push(window.setTimeout(finish, 130 + LINES.length * 150 + 220));

    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);

    return () => {
      t.forEach(window.clearTimeout);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, []);

  if (done) return null;

  return (
    <div className={`boot ${flash ? 'boot--flash' : ''}`} style={{ opacity: fading ? 0 : 1 }}>
      <pre className="boot__log" aria-label="loading">
        {LINES.slice(0, lineCount).join('\n')}
        <span className="boot__cursor">█</span>
      </pre>
      <div className="boot__skip">[ press any key ]</div>
    </div>
  );
}
